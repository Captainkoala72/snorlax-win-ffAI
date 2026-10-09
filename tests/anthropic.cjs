const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
delete process.env.ZAI_API_KEY;
const { runChat, MissingApiKeyError } = require('../src/lib/ai/client.ts');
const { env } = require('../src/lib/env.ts');
const options = {
  model: 'claude-haiku-5-5', effort: 'max', webSearch: true,
  messages: [{ role: 'system', content: 'Trusted system prompt' }, { role: 'user', content: 'Check roster and injuries' }],
  tools: [
    { type: 'function', function: { name: 'get_team', description: 'Roster', parameters: { type: 'object', properties: { team: { type: 'string' } }, required: ['team'] } } },
    { type: 'function', function: { name: 'search_web', parameters: {} } },
  ],
  executeTool: async () => '{"roster":[]}',
};
function stream(events, complete = true) {
  const bytes = new TextEncoder().encode([...events, ...(complete ? [{ type: 'message_stop' }] : [])]
    .map(event => `event: ${event.type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`).join(''));
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
    controller.close();
  } }));
}
const start = (index, content_block) => ({ type: 'content_block_start', index, content_block });
const delta = (index, delta) => ({ type: 'content_block_delta', index, delta });
const stop = index => ({ type: 'content_block_stop', index });
const finish = stop_reason => ({ type: 'message_delta', delta: { stop_reason } });
const textReply = text => stream([start(0, { type: 'text', text: '' }), delta(0, { type: 'text_delta', text }), stop(0), finish('end_turn')]);

test('Haiku uses native Anthropic settings and preserves signed thinking, tool input, paused search, and sources', async () => {
  const requests = [], executed = [], tools = [], deltas = [];
  const thinking = { type: 'thinking', thinking: 'Read roster', signature: 'signed-data' };
  global.fetch = async (url, init) => {
    assert.equal(url, 'https://api.anthropic.com/v1/messages');
    assert.equal(init.headers['x-api-key'], 'test-anthropic-key');
    assert.equal(init.headers['anthropic-version'], '2023-06-01');
    const body = JSON.parse(init.body);
    requests.push(body);
    if (requests.length === 1) return stream([
      start(0, { type: 'thinking', thinking: '', signature: '' }),
      delta(0, { type: 'thinking_delta', thinking: 'Read roster' }),
      delta(0, { type: 'signature_delta', signature: 'signed-data' }), stop(0),
      start(1, { type: 'tool_use', id: 'tool1', name: 'get_team', input: {} }),
      delta(1, { type: 'input_json_delta', partial_json: '{"team":' }),
      delta(1, { type: 'input_json_delta', partial_json: '"49ers"}' }), stop(1), finish('tool_use'),
    ]);
    if (requests.length === 2) {
      assert.deepEqual(body.messages[1].content[0], thinking);
      assert.deepEqual(body.messages[1].content[1].input, { team: '49ers' });
      assert.deepEqual(body.messages[2].content, [{ type: 'tool_result', tool_use_id: 'tool1', content: '{"roster":[]}' }]);
      return stream([start(0, { type: 'server_tool_use', id: 'search1', name: 'web_search', input: { query: 'NFL injuries' } }), stop(0), finish('pause_turn')]);
    }
    assert.deepEqual(body.messages[3].content, [{ type: 'server_tool_use', id: 'search1', name: 'web_search', input: { query: 'NFL injuries' } }]);
    assert.deepEqual(body.tools, requests[0].tools);
    return stream([
      start(0, { type: 'web_search_tool_result', tool_use_id: 'search1', content: [{ type: 'web_search_result', title: 'Injury update', url: 'https://example.com/news', encrypted_content: 'opaque' }] }), stop(0),
      start(1, { type: 'text', text: '' }), delta(1, { type: 'text_delta', text: 'José’s roster is ready.' }),
      delta(1, { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.com/news', title: 'Injury update', encrypted_index: 'opaque-index', cited_text: 'Update' } }),
      stop(1), finish('end_turn'),
    ]);
  };
  const answer = await runChat({ ...options,
    executeTool: async (name, args) => { executed.push([name, args]); return '{"roster":[]}'; },
    callbacks: { onDelta: d => deltas.push(d), onToolCall: (...args) => tools.push(args), onToolResult: (...args) => tools.push(args) },
  });
  assert.equal(requests.length, 3);
  const body = requests[0];
  assert.equal(body.model, 'claude-haiku-5-5');
  assert.deepEqual(body.thinking, { type: 'adaptive' });
  assert.deepEqual(body.output_config, { effort: 'max' });
  assert.equal(body.max_tokens, 64000);
  assert.equal(body.stream, true);
  assert.equal(body.system, 'Trusted system prompt');
  for (const field of ['temperature', 'top_p', 'top_k', 'reasoning_effort']) assert.equal(body[field], undefined);
  assert.deepEqual(body.tools.map(t => t.name), ['get_team', 'web_search']);
  assert.equal(body.tools[1].type, 'web_search_20250305');
  assert.deepEqual(body.tool_choice, { type: 'auto' });
  assert.deepEqual(executed, [['get_team', { team: '49ers' }]]);
  assert.match(answer, /José’s roster is ready/);
  assert.match(answer, /\[Injury update\]\(https:\/\/example.com\/news\)/);
  assert.equal(deltas.join(''), answer);
  assert.doesNotMatch(answer, /Read roster|signed-data|opaque/);
  assert.ok(tools.some(t => t[0] === 'search1' && t[2] === true));
});

test('disabled Haiku web search cannot execute either provider search tool', async () => {
  let count = 0;
  global.fetch = async (_, init) => {
    const body = JSON.parse(init.body);
    assert.deepEqual(body.tools.map(t => t.name), ['get_team']);
    if (++count === 1) return stream([start(0, { type: 'tool_use', id: 'forged', name: 'search_web', input: { query: 'NFL' } }), stop(0), finish('tool_use')]);
    assert.equal(body.messages.at(-1).content[0].is_error, true);
    return textReply('Search is disabled.');
  };
  assert.equal(await runChat({ ...options, webSearch: false, executeTool: async () => assert.fail('disabled tool executed') }), 'Search is disabled.');
});

test('tool failures return Anthropic error results and allow a useful reply', async () => {
  let count = 0;
  global.fetch = async (_, init) => {
    const body = JSON.parse(init.body);
    if (++count === 1) return stream([start(0, { type: 'tool_use', id: 't1', name: 'get_team', input: { team: '49ers' } }), stop(0), finish('tool_use')]);
    assert.deepEqual(body.messages.at(-1).content, [{ type: 'tool_result', tool_use_id: 't1', content: 'ESPN unavailable', is_error: true }]);
    return textReply('ESPN is unavailable.');
  };
  assert.equal(await runChat({ ...options, executeTool: async () => { throw new Error('ESPN unavailable'); } }), 'ESPN is unavailable.');
});

test('Haiku surfaces upstream errors, truncation, incomplete streams, and empty answers', async () => {
  for (const [response, expected] of [
    [new Response('secret upstream details', { status: 401 }), /rejected the API key/],
    [new Response('secret upstream details', { status: 429 }), /HTTP 429/],
    [stream([{ type: 'error', error: { type: 'overloaded_error' } }]), /overloaded_error/],
    [stream([finish('max_tokens')]), /response limit/],
    [stream([finish('refusal')]), /declined/],
    [stream([finish('end_turn')], false), /ended unexpectedly/],
    [textReply(''), /empty response/],
  ]) {
    global.fetch = async () => response;
    await assert.rejects(runChat(options), expected);
  }
});

test('Haiku needs only the Anthropic key; missing credentials never reach the network', async () => {
  const key = env.anthropicApiKey;
  env.anthropicApiKey = '';
  global.fetch = async () => assert.fail('network called without key');
  try { await assert.rejects(runChat(options), err => err instanceof MissingApiKeyError && err.keyName === 'ANTHROPIC_API_KEY'); }
  finally { env.anthropicApiKey = key; }
});

test('paused server-tool loops are bounded', async () => {
  let requests = 0;
  global.fetch = async () => { requests++; return stream([finish('pause_turn')]); };
  await assert.rejects(runChat(options), /tool-call limit/);
  assert.equal(requests, 12);
});
