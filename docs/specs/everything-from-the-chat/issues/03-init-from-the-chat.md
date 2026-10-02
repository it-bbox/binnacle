# 03: /binnacle:init sets a repository up from the chat

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** the `/binnacle:init [path]` skill, which follows the procedure in the spec's *Implementation Decisions*. It runs `binn init --plan --json`, shows the root, the history, the window, every plan item in full and numbered, and the notes, then asks once. A human naming another window gets the plan again with `--window`. Only a clear yes from the human in the chat runs `binn init --apply <id>` with the same window and path. On `init.plan_changed` it shows the new plan and asks again. It shows the Summary and the tracker check. When the daemon was not running, it says that `/binnacle:daemon start` then `/binnacle:init` again adds the registration. It never answers its own question and never commits. It handles a missing `binn` and other failures as `/binnacle:audit` does.

- [x] The skill exists in the `binnacle` plugin with `disable-model-invocation: true` and an `argument-hint`.
- [x] A test in `apps/cli/test/pack.test.ts` holds its wording: it runs `--plan --json`, asks once, applies only after the human's yes with the identifier, shows a changed plan again, and never commits.
- [x] The plugin's description in its manifest and in the marketplace listing names `init`.
- [x] `docs/03-mcp-and-skills.md` lists `/init` and `/binnacle:init`, and the README, in English and Russian, describes setup from the chat beside the terminal.

## Comments

### For the next tickets

- **The skill** is `.claude/skills/binnacle/skills/init/SKILL.md`. It passes the human's path and window, the same, to `--plan --json` and to `--apply <id>`, and goes back to `--plan` on another window or on `init.plan_changed`.
- **Ticket 08's demonstration** needs the `binnacle` plugin installed in Claude Code before `/binnacle:init` exists in a fresh repository's chat. The first `binn init` on a machine installs it at user scope; the README says so.

### Decided while implementing

- **The window is offered, not asked.** The spec says the skill "asks for another window only if the human wants one". The one question, whether to write this plan, says that another window can be named instead; it asks nothing else.
- **An empty plan stops before `--apply`**, as the spec's procedure says ("say there is nothing to write and stop"), so the chat shows no tracker check for it. `binn init` at a terminal still runs it on an empty plan (ticket 02).

### Review

Code review against `main` on two axes, Standards and Spec. No hard violations, and no missing requirement.

- Fixed: the new test repeated the frontmatter and failure checks that `/binnacle:daemon`'s and `/binnacle:register`'s test runs in a loop. `init` joined that loop, which also holds its "needs no daemon".
- Fixed: the `/init` line in `docs/03-mcp-and-skills.md` restated the skill step by step. It is one line now, as the sibling lines are.
- Fixed: the plugin's description in `plugin.json` was one run-on sentence. It reads as two.
- Kept: the test that the manifest's and the marketplace's descriptions name `init`. It holds the ticket's third criterion.
- Kept: step 6 names `/binnacle:daemon start` then `/binnacle:init` again, rather than `/binnacle:register`, because the spec says so in those words.
- Kept: on a failed `--apply` other than `init.plan_changed`, the skill quotes stdout as well as stderr, since some writes may have been made before the failure.
- Kept: the window offered in the question, and the empty plan stopping before `--apply`, as decided above.
- Left: the "no usable manifest" note (`binn project register` named by init) gets no `/binnacle:register` pointer from the skill. The spec does not ask for one, and the skill shows the note as printed.
- Left: "quote both for the shell" also covers the window, which is digits or `all`. It does no harm.
