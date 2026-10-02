# 06: /binnacle:dashboard, with the token kept out of the chat

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** `binn dashboard` opens the browser with the address and its token, as today, but prints the address without its `#token=…` fragment. When no browser can be opened, it says to run `binn dashboard --print` at a terminal. `--print` is unchanged. The `/binnacle:dashboard` skill runs `binn dashboard` and shows the token-free address. With the daemon stopped, it names `/binnacle:daemon start`. A skill's shell output reaches the model's provider, and the token authorises the daemon's local API (ADR-0031).

- [x] In `apps/cli/test/dashboard.test.ts`, with a fake opener on PATH, `binn dashboard` prints an address with no `#token=` and passes the opener the address with it.
- [x] `--print` keeps its existing test.
- [x] The skill exists with `disable-model-invocation: true`. A test in `apps/cli/test/pack.test.ts` holds that it never runs `--print` and never shows a token.
- [x] The CLI help, `docs/04-telemetry-dashboard.md`, the plugin's description and `docs/03-mcp-and-skills.md` say so.

## Comments

- **No `argument-hint`.** The spec gives each new skill one, but `/binnacle:dashboard` takes no argument, as ticket 05 found for `/binnacle:status`. A hint would advertise an argument that does nothing.
- **What "no browser can be opened" covers.** `binn dashboard` reports it when the platform's opener cannot be started at all, such as no `xdg-open` on PATH, the case its test holds. An opener that starts and then fails is not waited for: the opener is detached so that `binn` returns at once, and waiting on it could hold `binn` until the browser exits. The skill therefore says, when no failure was printed, that `binn dashboard --print` at a terminal gives the address if no browser appeared.
- **docs/04 gains a short *Opening it* section.** It had no word on `binn dashboard`, and the ticket asks it to say so.
- **The README is unchanged.** Its line on `binn dashboard` stays true; the setup from the chat is ticket 03's and 08's.

### Review

Code review against `main`, both axes.

- **Fixed.** The skill told the agent to say the dashboard opened, with no condition, before it read a failure to open one. It now says a browser opened only when `binn` printed no such failure, and names `binn dashboard --print` at a terminal if none appeared.
- **Fixed.** The token-free address was named `plain`; it is now `bareAddress`.
- **Fixed.** The two new tests checked for the token differently, one for the word `token`; both now check for the token itself.
- **Left.** An opener that starts and then fails, `xdg-open` without a display, is not reported, as above. This predates the ticket, and catching it means waiting on the opener.
- **Kept.** `binn` in `dashboard.test.ts` delegates to `binnWith`, so that the existing calls stay as they are.
- **Kept.** The reason, a skill's shell output reaches the model's provider, is given in the code, the skill, `docs/03` and `docs/04`, each for its own reader, with ADR-0031 cited.
- **Kept.** Adding a skill touches `plugin.json`, the marketplace listing, `docs/03` and `pack.test.ts`, as ticket 05's review found.
