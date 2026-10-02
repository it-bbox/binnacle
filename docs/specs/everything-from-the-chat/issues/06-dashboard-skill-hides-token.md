# 06: /binnacle:dashboard, with the token kept out of the chat

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** `binn dashboard` opens the browser with the address and its token, as today, but prints the address without its `#token=…` fragment. When no browser can be opened, it says to run `binn dashboard --print` at a terminal. `--print` is unchanged. The `/binnacle:dashboard` skill runs `binn dashboard` and shows the token-free address. With the daemon stopped, it names `/binnacle:daemon start`. A skill's shell output reaches the model's provider, and the token authorises the daemon's local API (ADR-0031).

- [ ] In `apps/cli/test/dashboard.test.ts`, with a fake opener on PATH, `binn dashboard` prints an address with no `#token=` and passes the opener the address with it.
- [ ] `--print` keeps its existing test.
- [ ] The skill exists with `disable-model-invocation: true`. A test in `apps/cli/test/pack.test.ts` holds that it never runs `--print` and never shows a token.
- [ ] The CLI help, `docs/04-telemetry-dashboard.md`, the plugin's description and `docs/03-mcp-and-skills.md` say so.

## Comments
