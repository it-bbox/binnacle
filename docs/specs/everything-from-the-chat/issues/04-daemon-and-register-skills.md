# 04: The daemon and registration from the chat

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** `/binnacle:daemon [start|stop|status]` runs `binn daemon <action>`, `status` by default, and shows what it printed, including the log tail of a failed start. `/binnacle:register [path]` runs `binn project register` with the path, or else with the main checkout (the first path `git worktree list` prints), and says when that differs from the session's checkout. Both handle a missing `binn` and other failures as `/binnacle:audit` does. Where `/binnacle:product`, `/binnacle:daily`, `/binnacle:task`, `/binnacle:checkpoint` and `/binnacle:autopilot` meet `daemon.unreachable` or `project.not_registered`, they name `/binnacle:daemon start` or `/binnacle:register` beside the `binn` command.

- [ ] Both skills exist in the `binnacle` plugin with `disable-model-invocation: true` and an `argument-hint`.
- [ ] A test in `apps/cli/test/pack.test.ts` holds their wording, and that every daemon-dependent skill names `/binnacle:daemon start` and `/binnacle:register`.
- [ ] By hand: after `/binnacle:daemon start` in a session whose daemon was stopped, the MCP tools answer in that same session. If they do not, it is recorded under `## Comments` as a question for the owner.
- [ ] The plugin's description and `docs/03-mcp-and-skills.md` name both skills, and say that they need no daemon.

## Comments
