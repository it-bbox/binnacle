# 04: The daemon and registration from the chat

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** `/binnacle:daemon [start|stop|status]` runs `binn daemon <action>`, `status` by default, and shows what it printed, including the log tail of a failed start. `/binnacle:register [path]` runs `binn project register` with the path, or else with the main checkout (the first path `git worktree list` prints), and says when that differs from the session's checkout. Both handle a missing `binn` and other failures as `/binnacle:audit` does. Where `/binnacle:product`, `/binnacle:daily`, `/binnacle:task`, `/binnacle:checkpoint` and `/binnacle:autopilot` meet `daemon.unreachable` or `project.not_registered`, they name `/binnacle:daemon start` or `/binnacle:register` beside the `binn` command.

- [x] Both skills exist in the `binnacle` plugin with `disable-model-invocation: true` and an `argument-hint`.
- [x] A test in `apps/cli/test/pack.test.ts` holds their wording, and that every daemon-dependent skill names `/binnacle:daemon start` and `/binnacle:register`.
- [ ] By hand: after `/binnacle:daemon start` in a session whose daemon was stopped, the MCP tools answer in that same session. If they do not, it is recorded under `## Comments` as a question for the owner.
- [x] The plugin's description and `docs/03-mcp-and-skills.md` name both skills, and say that they need no daemon.

## Comments

- **The same-session check, at the process level.** `binn mcp` reads the runtime file and the token on every call (`apps/cli/src/mcp.ts`), so a daemon started after the harness connected is found. The implementation session drove one `binn mcp` process over stdio against a temporary home: `project_detect` answered `daemon.unreachable`, then `binn daemon start` (with `BINNACLE_PORT=0`), then the same process's `project_detect` reached the daemon and answered `project.not_registered`. The criterion stays unticked: only a Claude Code session shows that the harness keeps the server connected after a failed call. The owner's check, in a Claude Code chat at this repository:

  ```text
  /binnacle:daemon stop      # if it is running; "Binnacle daemon stopped (pid …)."
  /binnacle:daemon           # status: "Binnacle daemon is not running."
  /binnacle:product          # stops at daemon.unreachable and names /binnacle:daemon start
  /binnacle:daemon start     # "Binnacle daemon started." with its address
  /binnacle:product          # same session, no restart: the snapshot is shown
  ```

  If the last step still reports `daemon.unreachable` or a disconnected `binnacle` server, record it here as a question for the owner.
- **A missing manifest names `binn init`, not `/binnacle:init`.** Story 29 asks for the skill that fixes a failed registration. `/binnacle:init` does not exist until ticket 03, so `/binnacle:register` names `binn init` for a missing or invalid manifest. Ticket 03 can add `/binnacle:init` beside it.
- **`binn daemon status` exits 4 when nothing runs.** `/binnacle:daemon` treats that as its answer, not a failure; `stop` on a stopped daemon exits 0.

### Review

Code review against `main`, both axes.

- **Fixed.** The one-line descriptions of the plugin, the marketplace listing and `/binnacle:register` said "need no daemon", which reads as if registering works without one. Both axes raised it. They now say no daemon needs to be started and that registering needs a running one.
- **Fixed.** `pack.test.ts` added a `skillText` helper while the autopilot tests still read the file by hand. Every test now uses the helper.
- **Kept.** The two error lines are repeated in five skills, and the exit-127 bullet in three. Plugin skills cannot include shared text, and `pack.test.ts` holds the five copies in step.
- **Kept.** The tests pin `argument-hint` and "needs no daemon". These are criteria of this ticket.
- **Left.** The marketplace listing and `plugin.json` still word the plugin's actions differently. This predates the ticket.
- **Left.** Story 29 names `binn init` until ticket 03 adds `/binnacle:init`, as noted above.
