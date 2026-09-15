const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, file) => mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
process.env.LEAGUE_ID = '123';
process.env.ESPN_SWID = '{example-swid}';
process.env.ESPN_S2 = 'already%2Fencoded%3D';
process.env.ZAI_API_KEY = 'test-key';
const { getLeagueData, invalidateLeagueCache, findTeam } = require('../src/lib/espn/client.ts');
const { runChat } = require('../src/lib/ai/client.ts');
const { searchWeb } = require('../src/lib/espn/news.ts');
const fixture = { id: 123, seasonId: 2026, settings: { name: 'Test League', scoringSettings: { scoringItems: [{ statId: 53, points: 0.5 }] } }, teams: [{ id: 1, name: 'Jose’s 49ers', record: { overall: { pointsFor: 110.2, pointsAgainst: 95 } } }] };

test('ESPN preserves cookies, parses scoring and records, and refreshes cache', async () => {
  let count = 0;
  global.fetch = async (url, options) => {
    count++;
    assert.match(url, /seasons\/2026\/segments\/0\/leagues\/123/);
    assert.equal(options.headers.Cookie, 'SWID={example-swid}; espn_s2=already%2Fencoded%3D');
    assert.equal(options.cache, 'no-store');
    return Response.json(fixture);
  };
  invalidateLeagueCache();
  const league = await getLeagueData();
  assert.equal(league.status, 'ok');
  assert.equal(league.pointsPerReception, 0.5);
  assert.equal(league.teams[0].pointsFor, 110.2);
  assert.equal(league.teams[0].pointsAgainst, 95);
  assert.equal(findTeam(league, '49ers').id, 1);
  await getLeagueData();
  assert.equal(count, 1);
  invalidateLeagueCache();
  await getLeagueData();
  assert.equal(count, 2);
});

test('ESPN rejects authentication, redirects, HTML and empty payloads', async () => {
  for (const [response, expected] of [
    [new Response('', { status: 403 }), 'auth_error'],
    [new Response('', { status: 302 }), 'auth_error'],
    [new Response('<html>Login</html>'), 'error'],
    [Response.json({}), 'error'],
    [new Response('', { status: 404 }), 'not_found'],
  ]) {
    global.fetch = async () => response;
    invalidateLeagueCache();
    assert.equal((await getLeagueData()).status, expected);
  }
});

function sse(chunks) {
  const bytes = new TextEncoder().encode(chunks.map(delta => 'data: ' + JSON.stringify({ choices: [{ delta }] }) + '\n\n').join('') + 'data: [DONE]');
  return new Response(new ReadableStream({ start(c) {
    for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7));
    c.close();
  } }));
}

test('GLM streams fragmented tools and preserves reasoning for the next turn', async () => {
  const requests = [];
  const executed = [];
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.z.ai/api/paas/v4/chat/completions');
    const body = JSON.parse(options.body);
    requests.push(body);
    return requests.length === 1 ? sse([
      { reasoning_content: 'Need league data' },
      { tool_calls: [{ index: 0, id: 'call1', function: { name: 'get_team', arguments: '{"team":' } }] },
      { tool_calls: [{ index: 0, function: { arguments: '"49ers"}' } }] },
    ]) : sse([{ content: 'Here is your roster.' }]);
  };
  const answer = await runChat({ messages: [{ role: 'user', content: 'My roster?' }], effort: 'max', webSearch: true,
    tools: [{ type: 'function', function: { name: 'get_team', parameters: {} } }],
    executeTool: async (name, args) => { executed.push([name, args]); return '{"roster":[]}'; },
  });
  assert.equal(answer, 'Here is your roster.');
  assert.equal(requests[0].model, 'glm-5.3-flash');
  assert.equal(requests[0].reasoning_effort, 'max');
  assert.equal(requests[0].thinking.clear_thinking, false);
  assert.equal(requests[0].tool_stream, true);
  assert.equal(requests[0].tool_web_search, undefined);
  assert.equal(requests[1].messages[1].reasoning_content, 'Need league data');
  assert.equal(requests[1].messages[2].tool_call_id, 'call1');
  assert.deepEqual(executed, [['get_team', { team: '49ers' }]]);
});

test('disabled search is removed from model tools', async () => {
  global.fetch = async (url, options) => {
    assert.deepEqual(JSON.parse(options.body).tools, []);
    return sse([{ content: 'Hello' }]);
  };
  await runChat({ messages: [], effort: 'max', webSearch: false,
    tools: [{ type: 'function', function: { name: 'search_web', parameters: {} } }],
    executeTool: async () => assert.fail('must not execute search'),
  });
});

test('web search calls Z.AI and preserves citations', async () => {
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.z.ai/api/paas/v4/web_search');
    assert.equal(JSON.parse(options.body).search_query, 'NFL injuries');
    return Response.json({ search_result: [{ title: 'Update', content: 'News', link: 'https://example.com/news' }] });
  };
  assert.deepEqual(await searchWeb('NFL injuries'), [{ title: 'Update', snippet: 'News', url: 'https://example.com/news' }]);
});
