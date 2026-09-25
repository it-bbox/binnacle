# 09: The exit demonstration

Status: BLOCKED
Triage: ready-for-human
Blocked by: 03, 04, 05, 07, 08, 10, 11, 12
Spec: `docs/specs/telemetry/spec.md`

**What to build:** epic 4's exit criterion, demonstrated on this repository against its own history. Decided in the spec, under *Further Notes*.

- [ ] In a fresh session, `/binnacle:product` shows the usage section: today's and the week's totals, by model, the top Tasks, unassigned, and each harness's level.
- [ ] `usage_get` for tickets 10 and 11, built by autopilot after ticket 12, returns their runs with the `implementation` role and their subagents linked.
- [x] Product sessions on `main` carry the `product` role, as `usage_get`'s `byRole` shows for the project.
- [ ] Whatever is unassigned is explained, and little of the work built after ticket 12 is unassigned.
- [x] The daemon's store holds no message content.
- [ ] Defects are filed as tickets; the roadmap marks epic 4 done only when none is open.

## Comments

- **This ticket is the owner's, and it is not done.** The implementation session on `feat/exit-demonstration` prepared the demonstration and measured everything it could on the owner's real artifacts. It ticked the two criteria that hold and filed tickets 10 and 11 for the defects it found. Criterion 1 needs a fresh Claude Code session. Criteria 2 and 4 need the owner's judgment, and tickets 10 and 11 need the owner's triage. So `Status:` stays `READY` and epic 4 stays `in progress`.
- **How it was measured, on 2026-09-25 at about 16:25 UTC.**
  - The daemon was this branch's code, run as `node apps/cli/src/bin.ts daemon start`, with `BINNACLE_PORT=0` and a new, empty temporary `BINNACLE_HOME`. It registered the main checkout, `/home/mikhail/Projects/dev-control-starter`, and read `~/.claude/projects` and `~/.codex/sessions` under the default 90-day window.
  - Operations were called over the daemon's HTTP API. `usage_get` was also called once through the real `binn mcp` over stdio, for `tracker-and-matt-pocock-integration/11`, and gave the same answer as `usage.get`.
  - The owner's running daemon, `~/.binnacle` and its store were not touched. The main checkout stayed clean.
  - The session's first worktree was removed by the harness when an API rate limit interrupted the session. Nothing had been committed yet. The work resumed in `.claude/worktrees/exit-demonstration`, on the same branch, with a second empty temporary home. The numbers below are all from that second home.
- **Speed.** The first snapshot on the empty store answered in 1.1 s with `importing.incomplete: true`, because the call's budget had run out. The next answered in 0.36 s with the import complete. `usage.get` answers in about 0.1 s.
- **The snapshot's `usage` section (criterion 1's data).** The window starts on 2026-06-28. The attention list is empty. The whole project is younger than a week, so the week covers everything that was read.
  - **Today:** 2,275 records. Input 4,628, cached input 355,193,883, cache creation 8,847,477, output 1,826,654, of which reasoning 615,499 (partial).
  - **Last 7 days:** 4,077 records. Input 8,390, cached input 627,546,764, cache creation 18,789,931, output 3,582,532, of which reasoning 1,286,119 (partial).
  - **By model:** `claude-opus-5-5` 3,742 records, `claude-opus-5` 335. No remainder.
  - **Largest Tasks**, by records, with 13 more:
    - `tracker-and-matt-pocock-integration/06`, 98;
    - `mcp-and-product-snapshot/02`, 92;
    - `core-and-persistence/01`, 91;
    - `core-and-persistence/02`, 63;
    - `mcp-and-product-snapshot/03`, 74;
    - `mcp-and-product-snapshot/06`, 76;
    - `mcp-and-product-snapshot/05`, 64;
    - `core-and-persistence/04`, 77;
    - `core-and-persistence/03`, 37;
    - `core-and-persistence/05`, 64.

    They are ordered by tokens, not by records.
  - **Unassigned:** 2,998 records, with 468,756,238 cached input.
  - **Harnesses:** `claude-code` is at level 3. `codex` has no level, because no Codex session of this project was found under `~/.codex/sessions`. That is correct: the machine's 31 rollouts all ran in other directories.
- **`usage_get` without a Task.** 4,096 records. `unassigned` 3,017. `byRole`:
  - `product`: 2,600 records;
  - `implementation`: 1,079;
  - `unknown`: 417.
- **Criterion 3 holds.** Every record of the Product sessions has the `product` role: 741 records in the registered checkout, on `main` by its reflog. But `byRole.product` also counts 1,859 records of subagent work in removed worktrees, where Claude Code wrote `main`. That is 72% of the role. Ticket 10.
- **Criterion 2 does not hold on this history.** `usage_get` for epic 3's tickets:

  | Ticket | Records | Runs | Subagent runs, all linked to a parent |
  | --- | --- | --- | --- |
  | 03 | 1 | 1 | 1 |
  | 06 | 98 | 9 | 8 |
  | 09 | 2 | 2 | 2 |
  | 11 | 31 | 3 | 2 |
  | 13 | 2 | 1 | 0 |
  | 01, 02, 04, 05, 07, 08, 10, 12 | 0 | 0 | 0 |

  - Every run returned has the `implementation` role, and every subagent run names its parent run. What the tool gives is right as far as it goes.
  - Every one of those runs took its branch from the harness. Epic 3 was built by autopilot subagents in worktrees that were removed at their merges, before Binnacle had read them. That is ADR-0029's accepted loss: most of epic 3 reads as `main`.
  - Ticket 06's 98 records come from four different worktrees in the same four minutes, so most of them are other tickets' work. Ticket 10.
  - Epic 4 fares the same: only `telemetry/02` and `telemetry/07` have a run, with one record each. Ticket 04 measured 185 records for `telemetry/04` while its worktree still existed. Read after the worktree's removal, they are gone.
  - Ticket 09's own first 25 records were read through the reflog, on `feat/exit-demonstration`, while its worktree existed. They were `unknown`, because that branch maps to two tickets. Ticket 11.
- **Criterion 4, the unassigned share.** It is 74% of records and 75% of cached input. Each of the 4,096 records of `usage_get` falls into exactly one of these groups:

  | Records | Share | Role | What it is |
  | --- | --- | --- | --- |
  | 741 | 18.1% | `product` | Product sessions in the registered checkout, on `main` by its reflog. These are rightly assigned to no Task. |
  | 1,859 | 45.4% | `product` | Work in 28 removed worktrees, 1,831 records of it by subagents, where Claude Code wrote `main` (ADR-0029). This is the part to judge. Ticket 10. |
  | 616 | 15.0% | `implementation` | The registered checkout on a ticket branch, by its reflog. |
  | 463 | 11.3% | `implementation` | Removed worktrees on a ticket branch, from the harness. |
  | 294 | 7.2% | `unknown` | Removed worktrees where Claude Code wrote no usable branch, 287 records of it by subagents. |
  | 51 | 1.2% | `unknown` | The registered checkout between 2026-09-18 14:50 and 2026-09-19 08:45 UTC. The repository's first commit is at 08:52, so there was no branch yet. |
  | 72 | 1.8% | `unknown` | Branches that name no ticket: `claude/*`, the branches of Claude Code's own worktrees, some of them Product sessions (41 records); `spec/*` (25); `docs/*` (4); `tickets/*` (2). |

  - Without the 1,859, the unassigned share would be 1,158 of 2,237 records, 52%, and most of that is Product work.
  - Whether 74% is "small enough to believe" is the owner's call, and it depends on ticket 10.
- **Criterion 5 holds: no message content in the store.**
  - These strings were searched for in `binnacle.db` and its `-wal` and `-shm` files:
    - a sentence from this session's own prompt, which is in two artifact files;
    - `PONYTAIL MODE`, hook text that is in 143 artifact files;
    - `Standard task flow`, `"content"`, `tool_use` and `MUST-NOT-BE-STORED`.
  - None was found. A message id, which should be there, was found.
  - The store has five tables: `meta`, `event` (2 events), `project`, `ingested_record` and `ingest_cursor`. The longest text in `ingested_record` is 201 characters, a file path in `source_ref`.
- **Defects filed.**
  - Ticket 10: work in removed worktrees reads as Product work, or as the wrong Task's.
  - Ticket 11: two tickets with the same slug get one branch, which credits neither.

  Both are `needs-triage`, because each needs the owner's decision. That includes ticket 10's choice to keep ADR-0029 as it is.
- **The owner's store is not a clean demonstration.** The running daemon imported this repository before ADR-0029, while it still ran tickets 01 to 03's code, which took the harness's branch first (ADR-0028). A record is ingested once and never read again. So its store keeps those branches, and its numbers will differ from the ones above.
  - A fresh temporary home reads the artifacts under ADR-0029, as they are now. It is what the script below uses.
  - It does not bring back what the old store may hold from worktrees it read while they still existed. For example, it would give nothing for ticket 04's 185 records.
  - Nothing has to be deleted: the temporary home is new and separate, and `~/.binnacle` stays as it is.
- **The owner's script**, superseded by the owner's decision below. Run it from `main` after merging this branch. This branch changes no code, so `main`'s code is the code measured here.
  1. In a terminal, start a second daemon on an empty home, beside the running one:

     ```sh
     export BINNACLE_HOME="$(mktemp -d)" BINNACLE_PORT=0
     binn daemon start
     binn project register ~/Projects/dev-control-starter
     ```

  2. **Criterion 1.** From the same terminal, so that `binn mcp` inherits `BINNACLE_HOME`, run `cd ~/Projects/dev-control-starter && claude`, and sign in if it asks. In that fresh session, run `/binnacle:product`. The desktop app does not inherit the variable; it would read the running daemon's store instead.
     - Check that the usage section takes two or three lines.
     - It gives today's and the last seven days' input, cached input, cache creation and output, with reasoning as part of output and marked partial.
     - It gives the two models, the largest Tasks by id and title, with the unassigned total beside them, and `claude-code` at level 3 with Codex's reason.
     - If it says the import is still running, run `/binnacle:product` again in a new session.
     - Tick criterion 1 if all of this holds.
  3. **Criteria 2 to 4, optional.** In the same session, ask for `usage_get` without arguments, and with `task` set to `tracker-and-matt-pocock-integration/11`. Compare with the numbers above. They will be slightly higher, because the artifacts grow.
  4. **Decide.** Triage tickets 10 and 11. Tick criterion 4 if the unassigned share, as explained above, is believable. The last criterion, and marking epic 4 `done` on the roadmap, wait until neither ticket is open.
  5. **Clean up, if you choose.** Run `binn daemon stop` in the same terminal. The temporary home can then be removed with `rm -rf "$BINNACLE_HOME"`; it holds only what this demonstration read.
- **Decided by the owner on 2026-09-25, in a Product session.**
  - Tickets 10 and 11 are triaged, ADR-0030 records ticket 10's decision, and ticket 12 is part of this epic. This ticket waits for all three. Its `Status:` is `BLOCKED`, so that autopilot does not start it.
  - Criteria 2 and 4 read new work. Epic 3's runs were in worktrees removed before Binnacle read them, and under ADR-0030 they are unassigned, so criterion 2 cannot hold on them. It reads tickets 10 and 11 instead, built by autopilot after ticket 12. Criterion 4 judges the unassigned share on that work, and asks of history only that its unassigned part be explained.
  - The demonstration reads the owner's running daemon, not a temporary home. A new store cannot read the reflog of a worktree that is gone, so only the running one can credit tickets 10 and 11. Under ADR-0030, the harness branches it stored under ADR-0028 attribute nothing, which answers *The owner's store is not a clean demonstration* above.
- **The owner's script, after the decision.**
  1. Build ticket 12 in a fresh session, and merge it.
  2. Just before `/binnacle:autopilot`, in the session that will run it, ask for `usage_get` without arguments and note its total records.
  3. Run `/binnacle:autopilot` for epic 4. It builds tickets 10 and 11. Do little else meanwhile: every other session's records count as new work too.
  4. Restart the daemon on `main`'s code: `binn daemon stop`, then `binn daemon start`.
  5. **Criterion 1.** In a fresh session, which may be the desktop app's, run `/binnacle:product`. Check the usage section as step 2 of the superseded script says.
  6. **Criterion 2.** Ask for `usage_get` with `task` set to `telemetry/10`, then to `telemetry/11`. Each returns runs with the `implementation` role, and every subagent run names its parent.
  7. **Criterion 4.** Ask for `usage_get` without arguments. The new work is its total records less the total noted in step 2. Its unassigned part is that, less the two tickets' records, and should be about the autopilot session's own records on `main`. The other unassigned records are the groups of the table above, with the removed worktrees now `unknown` rather than `product`.
  8. Tick what holds. Epic 4 is marked `done` on the roadmap once none of its tickets is open.

### Review

- This branch changes no code: only this ticket, tickets 10 and 11, and the roadmap's current focus. So the two-axis `/code-review` was not run.
- The text was checked by hand:
  - every number against the daemon's answers and a read-only query of the temporary store;
  - the ticket format against tickets 04, 12 and 13;
  - the rules that the owner's steps stay unticked, `Status:` is not `DONE`, and epic 4 is not marked done.
- One claim in the first draft of ticket 10 was wrong. It said most of the removed worktrees also hold their ticket's branch. It was **fixed** against the store: in 12 of the 28, Claude Code wrote nothing but `main`.

Typecheck is clean, and the full suite passes: 307 of 307.
