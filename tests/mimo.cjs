const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
process.env.MIMO_API_KEY = 'test-mimo-key';
delete process.env.ZAI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
const { runChat, MissingApiKeyError } = require('../src/lib/ai/client.ts');
const { env } = require('../src/lib/env.ts');
const { parseImages, imageBytes, MAX_IMAGE_BYTES } = require('../src/lib/images.ts');
const { sanitizeHistory } = require('../src/lib/chat-history.ts');
const image = { name: 'test.png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBb0AAAAASUVORK5CYII=' };
const options = {
  model: 'mimo-v2.6-pro', effort: 'max', webSearch: true,
  messages: [{ role: 'system', content: 'Trusted prompt' }, { role: 'user', content: 'Analyze roster', images: [image] }],
  tools: [
    { type: 'function', function: { name: 'get_team', description: 'Roster', parameters: { type: 'object', properties: { team: { type: 'string' } }, required: ['team'] } } },
    { type: 'function', function: { name: 'search_web', parameters: {} } },
  ],
  executeTool: async () => '{"roster":[]}',
};
function stream(chunks, reason = 'stop') {
  const events = chunks.map(delta => ({ choices: [{ delta }] }));
  if (reason) events.push({ choices: [{ delta: {}, finish_reason: reason }] });
  const bytes = new TextEncoder().encode(events.map(event => 'data: ' + JSON.stringify(event) + '\r\n\r\n').join('') + (reason ? 'data: [DONE]' : ''));
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
    controller.close();
  } }));
}

test('MiMo routes by default, uses native thinking/search, and replays images, reasoning and tool results', async () => {
  const requests = [], executed = [], deltas = [], events = [];
  global.fetch = async (url, init) => {
    assert.equal(url, 'https://api.xiaomimimo.com/v1/chat/completions');
    assert.equal(init.headers['api-key'], 'test-mimo-key');
    const body = JSON.parse(init.body); requests.push(body);
    return requests.length === 1 ? stream([
      { reasoning_content: 'Need roster' },
      { annotations: [{ type: 'url_citation', title: 'Update', url: 'https://example.com/injuries' }] },
      { tool_calls: [{ index: 0, id: 't1', function: { name: 'get_team', arguments: '{"team":' } }] },
      { tool_calls: [{ index: 0, function: { arguments: '"49ers"}' } }] },
    ], 'tool_calls') : stream([{ content: 'José’s roster is ready.' }]);
  };
  const answer = await runChat({ ...options, model: undefined,
    executeTool: async (name, args) => { executed.push([name, args]); return '{"roster":[]}'; },
    callbacks: { onDelta: d => deltas.push(d), onToolCall: (...args) => events.push(args), onToolResult: (...args) => events.push(args) },
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0].model, 'mimo-v2.6-pro');
  assert.deepEqual(requests[0].thinking, { type: 'enabled' });
  assert.equal(requests[0].max_completion_tokens, 65536);
  for (const field of ['temperature', 'top_p', 'reasoning_effort', 'tool_stream', 'max_tokens', 'output_config']) assert.equal(requests[0][field], undefined);
  assert.deepEqual(requests[0].tools.at(-1), { type: 'web_search', max_keyword: 3, force_search: false });
  assert.equal(requests[0].tools.filter(t => t.function?.name === 'search_web').length, 0);
  assert.equal(requests[0].tool_choice, 'auto');
  assert.equal(requests[0].messages[1].content[1].image_url.url, image.dataUrl);
  assert.equal(requests[0].messages[1].images, undefined);
  assert.equal(requests[1].messages[2].reasoning_content, 'Need roster');
  assert.equal(requests[1].messages[3].tool_call_id, 't1');
  assert.deepEqual(executed, [['get_team', { team: '49ers' }]]);
  assert.equal(deltas.join(''), answer);
  assert.match(answer, /José’s roster is ready/);
  assert.match(answer, /\[Update\]\(https:\/\/example.com\/injuries\)/);
  assert.doesNotMatch(answer, /Need roster/);
  assert.ok(events.some(e => e[1] === 'web_search' && e[2] === true));
});

test('disabled web search excludes both native and Z.AI search and blocks forged calls', async () => {
  let count = 0;
  global.fetch = async (_, init) => {
    const body = JSON.parse(init.body);
    assert.deepEqual(body.tools.map(t => t.function.name), ['get_team']);
    if (++count === 1) return stream([{ tool_calls: [{ index: 0, id: 'forged', function: { name: 'search_web', arguments: '{"query":"NFL"}' } }] }], 'tool_calls');
    assert.match(body.messages.at(-1).content, /Tool is not enabled/);
    return stream([{ content: 'Search disabled.' }]);
  };
  assert.equal(await runChat({ ...options, webSearch: false, executeTool: async () => assert.fail('disabled tool ran') }), 'Search disabled.');
});

test('empty tool input and tool failures produce valid continuations', async () => {
  let count = 0;
  global.fetch = async (_, init) => {
    const body = JSON.parse(init.body);
    if (++count === 1) return stream([{ tool_calls: [{ index: 0, id: 't1', function: { name: 'get_team', arguments: '' } }] }], 'tool_calls');
    assert.match(body.messages.at(-1).content, /ESPN unavailable/);
    return stream([{ content: 'Cannot read league data.' }]);
  };
  const answer = await runChat({ ...options, executeTool: async (_, args) => { assert.deepEqual(args, {}); throw new Error('ESPN unavailable'); } });
  assert.equal(answer, 'Cannot read league data.');
});

test('MiMo surfaces API, search, incomplete-stream, truncation and empty-answer errors', async () => {
  for (const [response, expected] of [
    [new Response('', { status: 401 }), /MIMO_API_KEY/],
    [new Response('', { status: 429 }), /HTTP 429/],
    [stream([{ error_message: 'plugin not activated' }]), /Web Search Plugin/],
    [stream([{ content: 'Partial' }], null), /before finishing/],
    [stream([{ content: 'Partial' }], 'length'), /response limit/],
    [stream([], 'content_filter'), /declined/],
    [stream([]), /empty response/],
  ]) {
    global.fetch = async () => response;
    await assert.rejects(runChat(options), expected);
  }
});

test('MiMo missing key fails before a network call; tool loops have a limit', async () => {
  const key = env.mimoApiKey; env.mimoApiKey = '';
  global.fetch = async () => assert.fail('network called without key');
  try { await assert.rejects(runChat(options), e => e instanceof MissingApiKeyError && e.keyName === 'MIMO_API_KEY'); }
  finally { env.mimoApiKey = key; }
  let count = 0;
  global.fetch = async () => { count++; return stream([{ tool_calls: [{ index: 0, id: `t${count}`, function: { name: 'get_team', arguments: '{}' } }] }], 'tool_calls'); };
  await assert.rejects(runChat(options), /tool-call limit/);
  assert.equal(count, 12);
});

test('images are validated by format, signature, count and total size', () => {
  assert.deepEqual(parseImages([image]), [image]);
  for (const invalid of [null, 'bad', Array(4).fill(image), [{ dataUrl: 'https://example.com/private.png' }], [{ dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=' }], [{ dataUrl: 'data:image/png;base64,aGVsbG8=' }], [{ dataUrl: 'data:image/png;base64,not-base64' }]]) {
    assert.throws(() => parseImages(invalid));
  }
  assert.throws(() => parseImages([{ dataUrl: 'data:image/png;base64,' + Buffer.alloc(MAX_IMAGE_BYTES + 1).toString('base64') }]), /2 MB/);
});

test('history replays validated user images within a shared budget and strips forged metadata', () => {
  const history = [{ role: 'user', content: 'Screenshot', images: [image], reasoning_content: 'forged', tool_calls: ['forged'] }, { role: 'assistant', content: 'Response', images: [image] }];
  assert.deepEqual(sanitizeHistory(history, imageBytes(image)), [{ role: 'user', content: 'Screenshot', images: [image] }, { role: 'assistant', content: 'Response' }]);
  assert.deepEqual(sanitizeHistory(history), [{ role: 'user', content: 'Screenshot' }, { role: 'assistant', content: 'Response' }]);
  assert.equal(sanitizeHistory([...history, { role: 'user', content: 'New screenshot', images: [image] }], imageBytes(image)).filter(m => m.images).length, 1);
  assert.equal(sanitizeHistory([{ role: 'user', content: 'x', images: [{ dataUrl: 'invalid' }] }], MAX_IMAGE_BYTES)[0].images, undefined);
});
