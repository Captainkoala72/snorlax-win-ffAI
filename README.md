# Degenerates With Integrity Fantasy Assistant

Next.js fantasy football assistant using ESPN league data and Z.AI's `glm-5.3-flash` with maximum reasoning, streamed answers, league tools and web search.

## Configuration

Copy `.env.example` to `.env.local` for local development, or set these secrets in your hosting provider:

- `LEAGUE_ID`: numeric ID from your ESPN fantasy league URL (`ESPN_LEAGUE_ID` is also accepted).
- `SEASON_YEAR`: the season you want to inspect, for example `2026`. Historical seasons from 2018 onward are supported.
- `ESPN_SWID` and `ESPN_S2`: for private leagues, copy the **values only** of the `SWID` and `espn_s2` browser cookies while logged into an ESPN account with access to the league. Preserve percent escapes; do not encode the values again. Public leagues need neither cookie. Renew both if ESPN rejects access.
- `ZAI_API_KEY`: Z.AI API key with access to GLM-5.3-Flash and the web search API. Calls use the general API endpoint, `https://api.z.ai/api/paas/v4`.
Chat history is stored only in this browser’s localStorage, scoped by league and season. There is no database or cloud history storage requirement. Clearing site data deletes local chats; other browsers and devices have separate histories. Relevant messages are still sent to the server and Z.AI to generate replies, but the app does not persist them server-side. Provider retention is governed by Z.AI’s policies.

The former provider's keys and model settings are no longer used. Configure the Z.AI key before restarting/redeploying. No credentials belong in Git or browser-exposed `NEXT_PUBLIC_` variables.

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

Regression tests mock ESPN and Z.AI to exercise cookie preservation, error handling, refresh, scoring, streamed function calls, retained reasoning and source URLs. Live private-league and model validation additionally require your host's credentials.

Reasoning is fixed to `max`; web search is on by default and can be toggled per conversation. The assistant can read league standings, teams, rosters, matchups and NFL news. Search uses Z.AI's `search-prime` API and returns source URLs. These tools do not make league transactions.

References: [GLM-5.3-Flash settings](https://docs.z.ai/guides/vlm/glm-5.3-flash), [function calling](https://docs.z.ai/guides/capabilities/function-calling), [web search API](https://docs.z.ai/api-reference/tools/web-search).
