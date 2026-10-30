const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
process.env.OPENAI_API_KEY = 'test-openai-key';
delete process.env.ZAI_API_KEY; delete process.env.ANTHROPIC_API_KEY; delete process.env.MIMO_API_KEY;
const { runChat, MissingApiKeyError } = require('../src/lib/ai/client.ts');
const { env } = require('../src/lib/env.ts');
const { CHAT_MODELS, DEFAULT_MODEL, supportsImageInput } = require('../src/lib/ai/models.ts');
const { REASONING_EFFORTS, reasoningEffortFor } = require('../src/lib/ai/reasoning.ts');
const image = { name: 'test.png', dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBb0AAAAASUVORK5CYII=' };
const options = {
  model: 'gpt-6.1-terra', effort: 'high', webSearch: true,
  messages: [{ role: 'system', content: 'Trusted prompt' }, { role: 'assistant', content: 'Earlier answer' }, { role: 'user', content: 'Analyze roster', images: [image] }],
  tools: [
    { type: 'function', function: { name: 'get_team', description: 'Roster', parameters: { type: 'object', properties: { team: { type: 'string' } }, required: ['team'] } } },
    { type: 'function', function: { name: 'get_league_overview', description: 'League', parameters: { type: 'object', properties: {}, required: [] } } },
    { type: 'function', function: { name: 'search_web', parameters: {} } },
  ],
  executeTool: async () => '{"roster":[]}',
};
const message = (text, annotations = [], phase = 'final_answer') => ({ type: 'message', id: 'msg1', role: 'assistant', status: 'completed', phase, content: [{ type: 'output_text', text, annotations }] });
const call = (id = 'call1', name = 'get_team', args = '{"team":"49ers"}') => ({ type: 'function_call', id: 'fc_' + id, call_id: id, name, arguments: args, status: 'completed' });
function stream(events) {
  const bytes = new TextEncoder().encode(events.map(event => `event: ${event.type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`).join(''));
  return new Response(new ReadableStream({ start(controller) {
    for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
    controller.close();
  } }));
}
const complete = output => ({ type: 'response.completed', response: { status: 'completed', output } });
const reply = (text = 'Hello') => stream([{ type: 'response.output_text.delta', delta: text }, complete([message(text)])]);

test('model registry preserves all five models, defaults to Terra, and scopes reasoning/image support', () => {
  assert.equal(DEFAULT_MODEL, 'gpt-6.1-terra');
  assert.deepEqual(CHAT_MODELS.map(m => m.id), ['gpt-6.1-terra', 'gpt-6.1-sol', 'mimo-v2.6-pro', 'glm-5.3-flash', 'claude-haiku-5-5']);
  assert.deepEqual(REASONING_EFFORTS.map(e => e.id), ['high', 'xhigh', 'max']);
  for (const model of ['gpt-6.1-sol', 'gpt-6.1-terra']) {
    assert.equal(supportsImageInput(model), true);
    for (const effort of ['high', 'xhigh', 'max']) assert.equal(reasoningEffortFor(model, effort), effort);
    assert.equal(reasoningEffortFor(model, 'none'), 'high');
    assert.equal(reasoningEffortFor(model, undefined), 'high');
  }
  assert.equal(reasoningEffortFor('glm-5.3-flash', 'high'), 'max');
  assert.equal(reasoningEffortFor('claude-haiku-5-5', 'xhigh'), 'max');
  assert.equal(supportsImageInput('glm-5.3-flash'), false);
});

test('both OpenAI models send each requested effort through Responses and accept images', async () => {
  for (const model of ['gpt-6.1-sol', 'gpt-6.1-terra']) for (const effort of ['high', 'xhigh', 'max']) {
    global.fetch = async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.headers.Authorization, 'Bearer test-openai-key');
      const body = JSON.parse(init.body);
      assert.equal(body.model, model);
      assert.deepEqual(body.reasoning, { effort });
      assert.equal(body.instructions, 'Trusted prompt');
      assert.equal(body.store, false);
      assert.equal(body.stream, true);
      assert.equal(body.max_output_tokens, 65536);
      assert.equal(body.tool_choice, 'auto');
      assert.equal(body.parallel_tool_calls, true);
      assert.deepEqual(body.tools.at(-1), { type: 'web_search', external_web_access: true });
      assert.equal(body.tools.some(t => t.name === 'search_web'), false);
      assert.equal(body.tools[0].strict, false);
      assert.deepEqual(body.input[0], { role: 'assistant', phase: 'final_answer', content: 'Earlier answer' });
      assert.deepEqual(body.input[1].content[1], { type: 'input_image', image_url: image.dataUrl, detail: 'auto' });
      for (const field of ['thinking', 'reasoning_effort', 'temperature', 'top_p', 'max_tokens', 'previous_response_id']) assert.equal(body[field], undefined);
      return reply();
    };
    assert.equal(await runChat({ ...options, model, effort }), 'Hello');
  }
});

test('OpenAI preserves encrypted reasoning, phases, parallel tool outputs and clickable web citations', async () => {
  const reasoning = { type: 'reasoning', id: 'rs1', encrypted_content: 'opaque-reasoning', summary: [] };
  const preamble = message('Checking league data.\n\n', [], 'commentary');
  const search = { type: 'web_search_call', id: 'ws1', status: 'completed', action: { type: 'search', query: 'NFL injuries' } };
  const first = [reasoning, preamble, search, call(), call('call2', 'get_league_overview', '')];
  const executed = [], events = [], requests = [];
  let displayed = '';
  global.fetch = async (_, init) => {
    const body = JSON.parse(init.body); requests.push(body);
    if (requests.length === 1) return stream([
      { type: 'response.reasoning_summary_text.delta', delta: 'Hidden reasoning' },
      { type: 'response.output_text.delta', delta: 'Checking league data.\n\n' },
      { type: 'response.output_item.added', item: { ...search, status: 'in_progress' } },
      { type: 'response.output_item.done', item: search },
      { type: 'response.function_call_arguments.delta', delta: '{"team":' },
      { type: 'response.function_call_arguments.delta', delta: '"49ers"}' },
      complete(first),
    ]);
    assert.deepEqual(body.input.slice(2, 7), first);
    assert.deepEqual(body.input.slice(-2), [
      { type: 'function_call_output', call_id: 'call1', output: '{"team":"49ers"}' },
      { type: 'function_call_output', call_id: 'call2', output: '{"league":"DWI"}' },
    ]);
    const text = 'José’s roster is ready.';
    const citations = [{ type: 'url_citation', url: 'https://example.com/update', title: 'Injury update', start_index: 0, end_index: text.length }];
    return stream([{ type: 'response.output_text.delta', delta: text }, complete([message(text, citations)])]);
  };
  const result = await runChat({ ...options, executeTool: async (name, args) => { executed.push([name, args]); return name === 'get_team' ? '{"team":"49ers"}' : '{"league":"DWI"}'; },
    callbacks: { onDelta: delta => displayed += delta, onReplace: text => displayed = text, onToolCall: (...event) => events.push(event), onToolResult: (...event) => events.push(event) },
  });
  assert.deepEqual(executed, [['get_team', { team: '49ers' }], ['get_league_overview', {}]]);
  assert.equal(displayed, result);
  assert.match(result, /José’s roster is ready\. \[1\]\(https:\/\/example.com\/update\)/);
  assert.match(result, /Sources: \[Injury update\]/);
  assert.doesNotMatch(result, /Hidden reasoning|opaque-reasoning/);
  assert.equal(events.filter(e => e[0] === 'ws1' && e[1] === 'web_search').length, 2);
});

test('OpenAI disabled search cannot execute either provider search tool', async () => {
  let count = 0;
  global.fetch = async (_, init) => {
    const body = JSON.parse(init.body);
    assert.deepEqual(body.tools.map(tool => tool.name), ['get_team', 'get_league_overview']);
    if (++count === 1) return stream([complete([call('bad', 'search_web')])]);
    assert.match(body.input.at(-1).output, /Tool is not enabled/);
    return reply('Search is disabled.');
  };
  assert.equal(await runChat({ ...options, webSearch: false, executeTool: async () => assert.fail('disabled search ran') }), 'Search is disabled.');
});

test('OpenAI returns tool errors and invalid arguments as valid continuation outputs', async () => {
  for (const args of ['{bad', '[]', 'null', '{}']) {
    let count = 0;
    global.fetch = async (_, init) => {
      const body = JSON.parse(init.body);
      if (++count === 1) return stream([complete([call('call1', 'get_team', args)])]);
      assert.match(body.input.at(-1).output, /^Error:/);
      return reply('Cannot load the roster.');
    };
    assert.equal(await runChat({ ...options, executeTool: async () => { assert.equal(args, '{}'); throw new Error('ESPN unavailable'); } }), 'Cannot load the roster.');
  }
});

test('OpenAI surfaces API, failed, incomplete, truncated, refusal and empty-answer errors', async () => {
  for (const [response, expected] of [
    [new Response('secret upstream details', { status: 401 }), /OPENAI_API_KEY/],
    [new Response('', { status: 429 }), /HTTP 429/],
    [stream([{ type: 'response.failed' }]), /could not complete/],
    [stream([{ type: 'error' }]), /could not complete/],
    [stream([{ type: 'response.incomplete', response: { incomplete_details: { reason: 'max_output_tokens' } } }]), /response limit/],
    [stream([{ type: 'response.output_text.delta', delta: 'Partial' }]), /ended unexpectedly/],
    [stream([complete([])]), /empty answer/],
    [stream([complete([message('I will check.', [], 'commentary')])]), /before giving a final answer/],
    [stream([complete([{ type: 'message', content: [{ type: 'refusal', refusal: 'Declined' }] }])]), /declined/],
  ]) { global.fetch = async () => response; await assert.rejects(runChat(options), expected); }
});

test('OpenAI default needs only OPENAI_API_KEY and missing keys never reach the network', async () => {
  global.fetch = async (_, init) => { assert.equal(JSON.parse(init.body).model, 'gpt-6.1-terra'); return reply(); };
  assert.equal(await runChat({ ...options, model: undefined }), 'Hello');
  const key = env.openaiApiKey; env.openaiApiKey = '';
  global.fetch = async () => assert.fail('network called without key');
  try { await assert.rejects(runChat(options), e => e instanceof MissingApiKeyError && e.keyName === 'OPENAI_API_KEY'); }
  finally { env.openaiApiKey = key; }
});

test('OpenAI tool loops stop at the configured budget', async () => {
  let requests = 0;
  global.fetch = async () => { requests++; return stream([complete([call(`call${requests}`, 'get_league_overview', '{}')])]); };
  await assert.rejects(runChat(options), /tool-call limit/);
  assert.equal(requests, 12);
});
