# Degenerates With Integrity Fantasy Assistant

Next.js fantasy football assistant using ESPN league data with a choice of Z.AI's `glm-5.3-flash` or Anthropic's `claude-haiku-5-5`. Both use maximum reasoning, streamed answers, league tools and web search.

## Configuration

Copy `.env.example` to `.env.local` for local development, or set these secrets in your hosting provider:

- `LEAGUE_ID`: numeric ID from your ESPN fantasy league URL (`ESPN_LEAGUE_ID` is also accepted).
- `SEASON_YEAR`: the season you want to inspect, for example `2026`. Historical seasons from 2018 onward are supported.
- `ESPN_SWID` and `ESPN_S2`: for private leagues, copy the **values only** of the `SWID` and `espn_s2` browser cookies while logged into an ESPN account with access to the league. Preserve percent escapes; do not encode the values again. Public leagues need neither cookie. Renew both if ESPN rejects access.
- `ZAI_API_KEY`: Z.AI API key with access to GLM-5.3-Flash and the web search API. Calls use the general API endpoint, `https://api.z.ai/api/paas/v4`.
- `ANTHROPIC_API_KEY`: Anthropic API key with access to Claude Haiku 5.5. Enable web search in your Anthropic organization settings. Calls use `https://api.anthropic.com/v1/messages`. Configure this secret in each Vercel environment where you want to use Haiku, then redeploy. Haiku does not require a Z.AI key.

Chat history is stored only in this browser’s localStorage, scoped by league and season. There is no database or cloud history storage requirement. Clearing site data deletes local chats; other browsers and devices have separate histories. Relevant messages and league tool results are sent to the selected provider to generate replies, but the app does not persist them server-side. Provider retention is governed by that provider’s policies.

Use the **AI model** selector in the chat header to switch between GLM Flash and Claude Haiku 5.5, including within an existing chat. The selection is saved with each conversation; older chats default to GLM. Model switching is disabled while an answer is streaming. No credentials belong in Git or browser-exposed `NEXT_PUBLIC_` variables.

Without a league ID, the app explicitly shows sample data. A configured league that fails to load shows an error rather than fabricated teams. Refresh bypasses the in-process cache and requests fresh ESPN data.

## Run and verify

```sh
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

Regression tests mock ESPN, Z.AI and Anthropic to exercise cookie preservation, error handling, refresh, scoring, provider routing, streamed function calls, retained signed thinking, paused search turns, sources, and model persistence. Live private-league and model validation additionally require your host's credentials.

Reasoning is fixed to `max`; web search is on by default and can be toggled. Haiku explicitly uses `thinking: { type: "adaptive" }`, `output_config: { effort: "max" }`, automatic native tool calling, and a 64,000-token output ceiling with room for thinking. GLM retains its existing thinking settings. The assistant can read league standings, teams, rosters, matchups and NFL news. GLM search uses Z.AI's `search-prime` API; Haiku uses Anthropic's native `web_search_20250305` tool with source links. Signed thinking and search blocks are preserved server-side across tool turns. These tools do not make league transactions. The chat route allows up to 300 seconds for maximum-effort responses, subject to the hosting plan's limits.

References: [GLM-5.3-Flash settings](https://docs.z.ai/guides/vlm/glm-5.3-flash), [function calling](https://docs.z.ai/guides/capabilities/function-calling), [web search API](https://docs.z.ai/api-reference/tools/web-search).

Anthropic references: [Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview), [effort](https://platform.claude.com/docs/en/build-with-claude/effort), [web search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool), [server tool continuation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools).
