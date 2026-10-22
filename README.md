# Degenerates With Integrity Fantasy Assistant

Next.js fantasy football assistant using ESPN league data with Xiaomi's `mimo-v2.6-pro` (default), Z.AI's `glm-5.3-flash`, or Anthropic's `claude-haiku-5-5`. All three support thinking, streamed answers, league tools and web search.

## Configuration

Copy `.env.example` to `.env.local` for local development, or set these secrets in your hosting provider:

- `LEAGUE_ID`: numeric ID from your ESPN fantasy league URL (`ESPN_LEAGUE_ID` is also accepted).
- `SEASON_YEAR`: the season you want to inspect, for example `2026`. Historical seasons from 2018 onward are supported.
- `ESPN_SWID` and `ESPN_S2`: for private leagues, copy the **values only** of the `SWID` and `espn_s2` browser cookies while logged into an ESPN account with access to the league. Preserve percent escapes; do not encode the values again. Public leagues need neither cookie. Renew both if ESPN rejects access.
- `ZAI_API_KEY`: Z.AI API key with access to GLM-5.3-Flash and the web search API. Calls use the general API endpoint, `https://api.z.ai/api/paas/v4`.
- `ANTHROPIC_API_KEY`: Anthropic API key with access to Claude Haiku 5.5. Enable web search in your Anthropic organization settings. Calls use `https://api.anthropic.com/v1/messages`. Configure this secret in each Vercel environment where you want to use Haiku, then redeploy. Haiku does not require a Z.AI key.
- `MIMO_API_KEY`: Xiaomi MiMo API key with access to `mimo-v2.6-pro`. Activate the **Web Search Plugin** in the MiMo console. Calls use `https://api.xiaomimimo.com/v1/chat/completions` with `api-key` authentication. MiMo needs neither the Z.AI nor Anthropic key. Set the secret in each Vercel environment where MiMo should work, then redeploy.

Chat history is stored only in this browser’s localStorage, scoped by league and season. There is no database or cloud history storage requirement. Clearing site data deletes local chats; other browsers and devices have separate histories. Relevant messages and league tool results are sent to the selected provider to generate replies, but the app does not persist them server-side. Provider retention is governed by that provider’s policies.

Use the **AI model** selector in the chat header to switch between MiMo V2.6 Pro, GLM Flash and Claude Haiku 5.5, including within an existing chat. The site opens on MiMo, and **New chat** resets to MiMo. Saved chats retain their selected model; older chats without a model retain GLM. Model switching is disabled while an answer is streaming. No credentials belong in Git or browser-exposed `NEXT_PUBLIC_` variables.

With MiMo selected, attach images with the image button or paste a screenshot into the composer. PNG, JPEG, WebP and GIF are supported (up to three images, 2 MB total). Images are sent directly as base64 content parts to MiMo for analysis and displayed in the conversation. They stay in browser chat history, subject to browser storage limits; no public image hosting is used. Relevant earlier images are replayed to MiMo within a 2 MB request budget, prioritizing recent images. Switching to GLM or Haiku replays text history only; pending images must be removed or sent using MiMo. Provider retention follows Xiaomi's policies. If storage is full, the app shows a warning and keeps the chat in memory.

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

Regression tests mock ESPN, Z.AI, Anthropic and Xiaomi MiMo to exercise cookie preservation, error handling, refresh, scoring, provider routing, streamed function calls, retained reasoning, paused search turns, sources, model persistence, and image validation/replay. Live private-league and model validation additionally require your host's credentials.

Web search is on by default and can be toggled. MiMo uses `thinking: { type: "enabled" }`, `max_completion_tokens: 65536`, automatic function calling, and Xiaomi's native `web_search` tool. Its API exposes enabled/disabled thinking rather than a separate adaptive-thinking mode or effort dial; the UI accurately shows **Thinking On**. Reasoning is retained across tool continuations, and web-source annotations are rendered as links. Custom sampling parameters and provider-specific flags from GLM/Haiku are not sent to MiMo.

Haiku explicitly uses `thinking: { type: "adaptive" }`, `output_config: { effort: "max" }`, automatic native tool calling, and a 64,000-token output ceiling with room for thinking. GLM retains its existing max reasoning settings. The assistant can read league standings, teams, rosters, matchups and NFL news. GLM search uses Z.AI's `search-prime` API; Haiku uses Anthropic's native `web_search_20250305` tool with source links. Signed thinking and search blocks are preserved server-side across tool turns. These tools do not make league transactions. The chat route allows up to 300 seconds for responses, subject to the hosting plan's limits.

References: [GLM-5.3-Flash settings](https://docs.z.ai/guides/vlm/glm-5.3-flash), [function calling](https://docs.z.ai/guides/capabilities/function-calling), [web search API](https://docs.z.ai/api-reference/tools/web-search).

Anthropic references: [Haiku 5.5](https://platform.claude.com/docs/en/models/haiku-5-5/overview), [effort](https://platform.claude.com/docs/en/build-with-claude/effort), [web search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool), [server tool continuation](https://platform.claude.com/docs/en/agents-and-tools/tool-use/server-tools).

Xiaomi references: [API](https://mimo.mi.com/docs/en-US/api/chat/openai-api), [deep thinking](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/other/deep-thinking), [web search](https://mimo.mi.com/docs/en-US/usage-guide/tool-calling/web-search), [image understanding](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/multimodal-understanding/image-understanding).
