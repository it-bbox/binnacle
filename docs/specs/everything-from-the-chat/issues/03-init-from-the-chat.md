# 03: /binnacle:init sets a repository up from the chat

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** the `/binnacle:init [path]` skill, which follows the procedure in the spec's *Implementation Decisions*. It runs `binn init --plan --json`, shows the root, the history, the window, every plan item in full and numbered, and the notes, then asks once. A human naming another window gets the plan again with `--window`. Only a clear yes from the human in the chat runs `binn init --apply <id>` with the same window and path. On `init.plan_changed` it shows the new plan and asks again. It shows the Summary and the tracker check. When the daemon was not running, it says that `/binnacle:daemon start` then `/binnacle:init` again adds the registration. It never answers its own question and never commits. It handles a missing `binn` and other failures as `/binnacle:audit` does.

- [ ] The skill exists in the `binnacle` plugin with `disable-model-invocation: true` and an `argument-hint`.
- [ ] A test in `apps/cli/test/pack.test.ts` holds its wording: it runs `--plan --json`, asks once, applies only after the human's yes with the identifier, shows a changed plan again, and never commits.
- [ ] The plugin's description in its manifest and in the marketplace listing names `init`.
- [ ] `docs/03-mcp-and-skills.md` lists `/init` and `/binnacle:init`, and the README, in English and Russian, describes setup from the chat beside the terminal.

## Comments
