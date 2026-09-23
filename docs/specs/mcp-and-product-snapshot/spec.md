# Spec: MCP and Product Snapshot

Status: READY
Triage: ready-for-agent

Epic 2 of v1, as defined in `docs/05-mvp-plan.md` phase 2. Exit criterion: a brand-new Product chat can run `/product` + `/daily` and understand project state without old conversation history.

## Problem Statement

A Product session on this repository starts from nothing. To learn where the project stands, the human or the agent reads `git log`, opens every ticket to find its `Status:` line, reads the roadmap, and reconstructs which epic is current and what can start next. It works, and it is exactly the chat-centric habit this product exists to replace: the reconstruction is repeated in every fresh session, costs context every time, and depends on the reader noticing what changed. `docs/workflow/02-development-workflow.md` describes the manual version under *This repository, until epic 2*, and it records one failure it already caused three times: a merged ticket still marked `READY`.

Epic 1 gave Binnacle a daemon, a store, a registry and `project.status`, but nothing a harness can call. An agent session cannot ask Binnacle anything yet, because there is no MCP server; and if it could, the answer would be wrong in the ordinary case. Claude Code starts sessions in linked worktrees under `.claude/worktrees/`, and inside one `project.status` reports the main checkout's branch — a wrong fact, not a missing one (found in epic 1 as its ticket 08, now this epic's ticket 01).

There is also no daily delta and no checkpoint. Nothing remembers when the last Product session looked, so "what changed since then" is answered from memory or not at all; and nothing marks what a session promoted into canonical sources before it closed.

## Solution

A developer links the CLI once (`pnpm link --global` in the CLI package) and starts the daemon. This repository commits a project-scoped `.mcp.json` that runs `binn mcp`, so any Claude Code session opened in it — in the main checkout or in a worktree — has Binnacle's tools, and three committed skills: `/product`, `/daily` and `/checkpoint`.

- **`/product`** detects the project and loads a **Product Snapshot**: roadmap position, the current focus, Tasks that are in flight or ready to start, Unmet dependencies, recent ADRs, the Git facts of the checkout the session is in, and deterministic attention items. Sections Binnacle cannot fill yet — pending decisions, CI, usage — are present and say so.
- **`/daily`** returns what changed since the previous daily on this machine: commits, Task state transitions, new tickets, roadmap status changes, ADRs, what can start next, and attention items.
- **`/checkpoint`** returns the delta since the last checkpoint, the promotion targets for this project with their paths, and consistency findings. The session drafts the promotions, the human confirms, the session writes and commits them with its own tools, and then records the checkpoint with Binnacle. Binnacle writes nothing into the repository (ADR-0020).

Tasks come from the project's tracker through the first half of the tracker contract — reading Tasks — with the local Markdown tracker as its first adapter. The remote adapters and the rest of the contract stay in epic 3.

Binnacle remains optional. With the daemon stopped, the MCP server still starts and every tool answers with an error naming the command that starts the daemon; the repository and its manual workflow are untouched.

## User Stories

1. As a Product Steward starting a fresh session, I want `/product` to load a compact Product Snapshot, so that I understand the project without any earlier chat.
2. As a Product Steward, I want the snapshot to show the roadmap's epic table with each epic's status and spec, so that I see the milestone position at a glance.
3. As a Product Steward, I want the roadmap's current focus included as written, so that the next action recorded by the last session reaches me unchanged.
4. As a Product Steward, I want the current focus cut at a fixed limit with an explicit truncation marker, so that a long focus cannot blow up the snapshot and I know when I have not seen all of it.
5. As a Product Steward, I want the remaining roadmap sections listed by heading only, so that I know what else is there and can read it when I need it.
6. As a Product Steward, I want every Task in `ACTIVE`, `BLOCKED`, `READY_FOR_REVIEW`, `APPROVED` or `MERGE_READY` listed by name, so that nothing in flight is hidden.
7. As a Product Steward, I want `READY` Tasks without Unmet dependencies listed by name, so that I see what can start now.
8. As a Product Steward, I want `BACKLOG`, `DONE` and other states given as counts only, so that a long history does not crowd out current work.
9. As a Product Steward, I want each listed Task to carry its identity, title, state, Unmet dependencies and ticket path, so that I can open exactly the file I need.
10. As a Product Steward, I want each section limited to a fixed number of items with a remainder count, so that the snapshot stays compact as the project grows and I know how much was left out.
11. As a Product Steward, I want the snapshot to distinguish a `BLOCKED` Task from one with an Unmet dependency, so that I do not chase an external blocker that is really just ordering.
12. As a Product Steward, I want the most recent ADRs listed with their titles, so that I know which durable decisions are fresh.
13. As a Product Steward, I want the snapshot to state plainly that pending decisions, CI state and usage are not available in this version, so that absence is never mistaken for "nothing to report".
14. As a Product Steward working in a linked worktree, I want the snapshot's Git facts to describe my worktree, so that the branch and dirty state I see are my own.
15. As a Product Steward, I want the snapshot to say which checkout it describes and whether that is the registered one, so that I can tell the two apart.
16. As a Product Steward, I want the same repository state to produce the same snapshot, so that its quality can be judged and compared.
17. As a Product Steward, I want `/daily` to show only what changed since the previous daily, so that I am not re-reading the whole project every morning.
18. As a Product Steward, I want the daily delta to list commits since then, with a limit and a remainder count, so that I see the shape of the work.
19. As a Product Steward, I want Task state transitions since then, so that I see what completed, started or got blocked.
20. As a Product Steward, I want new tickets since then, so that newly discovered work is visible the day it is filed.
21. As a Product Steward, I want roadmap status changes since then, so that I see an epic move.
22. As a Product Steward, I want ADRs added or changed since then, so that I notice a new decision.
23. As a Product Steward, I want the daily to repeat what can start next, so that the delta ends with an action.
24. As a Product Steward, I want the daily based on committed state only, with a flag when the working tree is dirty, so that the answer does not depend on half-finished edits.
25. As a Product Steward, I want each daily to become the baseline for the next one automatically, so that I never have to remember when I last looked.
26. As a Product Steward, I want to ask for a delta since an explicit commit without moving the baseline, so that I can look back without losing my place.
27. As a Product Steward on a new machine, I want the first daily to fall back to a fixed recent window and say that it did, so that I get a useful answer and know how it was chosen.
28. As a Product Steward whose baseline commit no longer exists after a rebase, I want the daily to fall back the same way and say why, so that a rewritten history never produces a wrong delta or an error.
29. As a Product Steward closing a session, I want `/checkpoint` to show what changed since the last checkpoint, so that I promote from facts rather than recollection.
30. As a Product Steward, I want the checkpoint to list promotion targets — vocabulary, trade-off, new work, product rule, position — with this project's paths, so that each decision lands in the right canonical source.
31. As a Product Steward, I want the checkpoint to include the consistency findings, so that I fix a stale roadmap before the next session reads it.
32. As a Product Steward, I want nothing written until I confirm it, so that I stay in control of canonical sources (ADR-0012).
33. As a Product Steward, I want the session to write and commit the confirmed promotions with its own tools, so that Binnacle never writes into my repository (ADR-0020).
34. As a Product Steward, I want the checkpoint recorded with the commit it was taken at and what was promoted, so that the next checkpoint and daily start from the right place.
35. As a Product Steward, I want recording a checkpoint to warn me when a promoted file still has uncommitted changes, so that a promotion is not silently counted as new work next time.
36. As a Product Steward, I want an attention item when an epic's roadmap status disagrees with its tickets, so that the "merged but still `READY`" failure is caught by a machine.
37. As a Product Steward, I want an attention item when a ticket's `Blocked by` names a ticket that does not exist, so that a dependency typo does not block work forever.
38. As a Product Steward, I want an attention item when a ticket's `Status:` is not a known Task state, so that an unrecognised value is surfaced instead of guessed.
39. As a Product Steward, I want an attention item when an epic that has reached `spec` or later has no spec link, so that the roadmap stays navigable.
40. As a Product Steward, I want the existing manifest and tracker-remote diagnostics carried into the attention list, so that there is one list of things to look at.
41. As an agent session, I want a `project_detect` tool that maps my working directory to a project, so that I never have to be told which project I am in.
42. As an agent session started in a linked worktree inside the repository, I want detect to find the project, so that the ordinary Claude Code worktree case works.
43. As an agent session started in a linked worktree outside the repository, I want detect to find the project through Git, so that a sibling worktree is not reported as unregistered.
44. As an agent session in a nested directory that is a separate repository, I want status to keep reporting the project's own Git facts, so that a vendored repository is not mistaken for a worktree.
45. As an agent session, I want tool results as compact JSON facts, so that I write the prose and spend no tokens parsing someone else's formatting.
46. As an agent session, I want every tool failure to carry the same stable error code as the daemon API, so that I can react to the cause.
47. As an agent session, I want a clear error with the start command when the daemon is not running, so that I can tell the human exactly what to do.
48. As a developer, I want the MCP server to start even when the daemon is down, so that the harness shows Binnacle connected and each call explains itself.
49. As a developer, I want the MCP server never to start the daemon on its own, so that no background process appears without my decision.
50. As a developer, I want one committed `.mcp.json` to connect every session in this repository, so that no per-session setup is needed.
51. As a developer, I want `.mcp.json` to run the linked `binn` rather than a path inside the working tree, so that a half-finished branch cannot break the Product session.
52. As a developer, I want `/product`, `/daily` and `/checkpoint` committed as skills, so that every fresh session has them.
53. As a developer, I want the skills to contain procedure only and no project state, so that they never go stale (`docs/03-mcp-and-skills.md`).
54. As a developer, I want no MCP tool to register, unregister or change anything in my repository, so that the MCP surface cannot do damage.
55. As a developer, I want the tracker read on every call rather than cached, so that a ticket I just edited is reflected immediately.
56. As a developer on the local Markdown tracker, I want Task identities of the form `<spec-slug>/<NN>`, so that two specs' ticket 01s never collide.
57. As a developer, I want a roadmap table that does not parse reported as a diagnostic, so that a formatting mistake is visible rather than silently dropped.
58. As a developer, I want the daily and checkpoint baselines kept in Binnacle's event history, so that they survive a schema rebuild (ADR-0015).
59. As a developer, I want Binnacle to make no network calls and invoke no model while producing any of this, so that it costs me nothing I did not choose (ADR-0012).
60. As a maintainer, I want the tracker's Task-reading contract defined before its first adapter, so that the GitHub and GitLab adapters in epic 3 implement a contract instead of copying an adapter.
61. As a maintainer, I want the MCP protocol handled by the official SDK, so that protocol versions and client quirks are not ours to chase (ADR-0021).
62. As a maintainer, I want each MCP tool to map one-to-one onto a daemon operation, so that there is no second implementation to keep in sync.
63. As a maintainer, I want this epic tested through the same daemon seam as epic 1, plus one MCP smoke test, so that no new seam appears.
64. As a maintainer, I want the exit criterion demonstrated in a real fresh session on this repository, in the main checkout and in a worktree, so that "works" means it worked here.
65. As a maintainer, I want the manual Product workflow section retired when this epic closes, so that the documentation stops describing a workaround.

## Implementation Decisions

### Workspace

- `packages/mcp` is filled by this epic: the MCP server, its tool definitions and their mapping onto daemon operations. It is the only package that depends on `@modelcontextprotocol/sdk` (ADR-0021).
- `apps/cli` gains `binn mcp`, which starts that server on stdio. The CLI gains no other command in this epic: the new operations are reached through MCP, and through the daemon API for tests.
- The tracker's Task-reading contract lives in `packages/core` as types and pure functions with no dependencies. The local Markdown adapter lives in `packages/adapters`, next to the Git adapter.
- The three skills are committed in this repository's Claude Code skill directory. They are hand-written for one harness; generating wrappers from one procedure description per action waits for a second harness (`docs/03-mcp-and-skills.md`).

### MCP server

- Transport: **stdio only** in this epic. Streamable HTTP from the daemon waits until a harness needs it; Claude Code, Codex and Gemini CLI all spawn stdio servers. This supersedes the "two transports" line in epic 1's out-of-scope list.
- `binn mcp` is a **proxy to the running daemon**. It locates the daemon through the runtime file and authenticates with the token under the Binnacle home directory, exactly as the CLI does. It opens no database.
- It passes its own working directory — where the harness started it — as the path for detect and status.
- If the daemon is not running, the server still completes the MCP handshake and lists its tools; each call returns a tool error carrying the daemon-unreachable code and the `binn daemon start` command. It never starts the daemon.
- **Tools, one per daemon operation**, named with underscores because the Anthropic API accepts only `[a-zA-Z0-9_-]` in tool names:

| MCP tool | Daemon operation |
| --- | --- |
| `project_detect` | `project.detect` |
| `project_status` | `project.status` |
| `project_snapshot` | `project.snapshot` |
| `daily_get` | `daily.get` |
| `checkpoint_prepare` | `checkpoint.prepare` |
| `checkpoint_record` | `checkpoint.record` |

- `project.register`, `project.unregister`, `project.list`, `event.list` and `daemon.status` are not exposed over MCP. They are local administration, done with the CLI.
- No task tools. The snapshot gives each Task's ticket path, and the session reads the file itself. A compact task brief is epic 3's exit criterion.
- Results are compact JSON (no pretty-printing) in the tool's text content. Failures reuse the daemon's error envelope and codes unchanged.

### Registration in this repository

- A committed project-scoped `.mcp.json` declares one stdio server named `binnacle` running `binn mcp`.
- `binn` reaches PATH through `pnpm link --global` from the CLI package, documented in the README (and `README.ru.md`). A repository-relative command is deliberately not used: in a worktree it would run that branch's code.
- `binn init`, which performs this registration for other projects and other harnesses, stays in epic 3.

### Task-reading contract

- The contract returns the project's Tasks. A Task carries: identity, title, state, the identities it is declared blocked by, a reference to its spec, its triage role, and the path or URL of its ticket.
- State is a `TaskState` from `packages/core`, or `null` with a diagnostic when the tracker's value is not one. The adapter never guesses a state.
- Unmet dependencies are computed from the contract, not by the adapter: a declared dependency whose Task is not `DONE`. A dependency naming no known Task is a diagnostic, not an Unmet dependency.
- Tasks are read on every call. There is no Task table in this epic; a projection arrives with the remote adapters in epic 3, if rate limits justify one.

### Local Markdown adapter

- Reads every `<tracker.local.issues>/<spec-slug>/issues/NN-<slug>.md`.
- Identity is `<spec-slug>/<NN>`. Title is the first heading with its `NN:` prefix removed.
- Reads the `Status:`, `Triage:`, `Blocked by:` and `Spec:` lines near the top of the file. `Blocked by: None`, with or without a parenthetical, means no dependencies; a list of numbers refers to tickets in the same spec directory.
- Reads nothing below the header lines. `## Comments` and the body are for the session to read.

### Roadmap

- For the local Markdown tracker the roadmap is `<knowledge.docs>/roadmap.md` (ADR-0017). If it is absent, the roadmap section is absent with a diagnostic.
- **Its format is now a contract**, and this spec records it:
  - one table with the header `# | Epic | Status | Spec`, whose Status values come from the file's own status vocabulary (`not started`, `spec`, `tickets`, `in progress`, `done`), and whose Spec cell is `—` or a link to `specs/<slug>/spec.md`;
  - a `## Current focus` section.
- The table is parsed strictly. A row that does not parse produces a diagnostic and is left out, never repaired.
- The current focus is returned as written, cut at a fixed character limit with an explicit truncation marker. Every other `##` section is returned as its heading only.
- An epic row is linked to its tickets through its spec slug. That link is what the roadmap consistency checks use.

### Product Snapshot (`project.snapshot`)

- Fixed sections, each with a fixed item limit and a remainder count (ADR-0012). Limits are constants in this epic, not configuration.
- **Roadmap**: the epic table, the current focus, the other headings.
- **Tasks in flight**: `ACTIVE`, `BLOCKED`, `READY_FOR_REVIEW`, `APPROVED`, `MERGE_READY`, listed by name.
- **Ready to start**: `READY` Tasks with no Unmet dependencies, listed by name.
- **Task counts**: every other state, including `null`, as counts only.
- Each listed Task carries identity, title, state, Unmet dependencies and ticket path. Ten per section.
- **Recent decisions**: the five most recent ADRs by last commit date, with title and path.
- **Git**: the facts of the caller's checkout (see Linked worktrees).
- **Attention**: the deterministic checks below.
- **Not available in this version**: pending decisions, CI state and usage are present as sections with an explicit unavailable marker and no content. They are never omitted and never filled with a guess (ADR-0007).

### Daily delta (`daily.get`)

- The delta runs from a baseline commit to the caller's HEAD and covers **committed state only**, plus the dirty flag.
- Contents: commits (count and subjects, limited); Task state transitions, computed by comparing each ticket's `Status:` at the baseline and at HEAD; tickets that did not exist at the baseline; roadmap table status changes; ADRs added or changed; ready-to-start Tasks; attention items.
- **Baseline**: the head commit recorded by the most recent `daily` or `checkpoint` event for this project on this machine.
- **`daily.get` records a `daily` event** carrying the caller's HEAD, which becomes the next baseline. A second call in a row returns an empty delta, which is the truthful answer. `docs/03-mcp-and-skills.md` therefore no longer counts it as read-only.
- An explicit `since` commit overrides the baseline and records nothing.
- With no prior event, or when the baseline commit is not reachable (rewritten or garbage-collected history), the delta falls back to the last seven days of commits, and the response states which fallback was used and why.
- The Git adapter gains `log` and `show` at a revision. Both are inspecting commands, and the adapter stays read-only by construction.

### Checkpoint (`checkpoint.prepare`, `checkpoint.record`)

- `checkpoint.prepare` returns:
  - the delta since the most recent `checkpoint` event, computed by the same code as the daily and with the same fallback;
  - the **promotion targets** from the knowledge promotion rule (`docs/02-project-brain.md`), each with its type and this project's path from the manifest's `knowledge` section: vocabulary → context, trade-off → ADR directory, new work → tracker, product rule → specs, position → roadmap;
  - the attention items.
- It records nothing. It returns facts and candidates, and never prose (ADR-0012).
- `checkpoint.record` takes the promoted items as `{ type, path }` pairs reported by the session, and records a `checkpoint` event carrying the caller's HEAD and those items. For each listed path with uncommitted changes it returns a diagnostic, because the baseline is HEAD and an uncommitted promotion would reappear as new work.
- Binnacle writes no file and makes no commit (ADR-0020). The `/checkpoint` skill's order is: prepare → the session drafts → the human confirms → the session writes and commits → record.

### Attention items

Computed on every call, deterministic, and never stored. There is no `AttentionItem` table.

1. **Roadmap and tickets disagree**: an epic `done` with a ticket that is not `DONE` or `CANCELLED`; an epic `not started` whose spec already has tickets; an epic at `tickets` or `in progress` whose tickets are all `DONE`.
2. **Dangling dependency**: `Blocked by` names a ticket that does not exist.
3. **Unknown state**: a `Status:` value that is not a Task state.
4. **Missing spec link**: an epic at `spec` or later with `—` in its Spec cell.
5. **Existing diagnostics**: manifest warnings and `tracker.remote_mismatch`.

Heuristic checks are deliberately excluded, such as a ticket `DONE` on an unmerged branch or a Task `ACTIVE` for too long. They produce false positives, and a noisy attention list gets ignored.

### Linked worktrees (ticket 01, formerly epic 1's ticket 08)

- **Resolution.** Detect tries directory containment first, with no Git involved. Only when no registered project contains the path does it ask Git for the path's common directory and match it against the common directories of registered projects. That finds a sibling worktree outside the repository.
- **Whose facts.** `project.status` and the snapshot report the Git facts of the **caller's** checkout, and name that checkout's root and whether it is the registered one.
- **Nested repository.** A directory inside the project whose Git common directory differs from the project's is a separate repository, not a worktree: status reports the project's own facts for it. Telling the two apart costs one extra read-only `git` call per status, which is accepted.

### Events

- New event types: `daily`, carrying the head commit; and `checkpoint`, carrying the head commit and the promoted items.
- Both are tier 2 under ADR-0015: they live in the append-only event table, are migrated, and survive a projection rebuild. Nothing else in this epic adds storage.

### Standing guarantees this epic must not break

- No model invocation and no outbound network traffic (ADR-0012).
- No writes to the tracker (ADR-0013) and no writes to the repository (ADR-0020). The Git adapter gains only inspecting commands.
- Binnacle is not a required runtime (`AGENTS.md` §3). With the daemon stopped, the repository and its manual workflow are unaffected.
- Same state, same answer. The only inputs that vary between calls are the recorded baseline and the repository itself.

## Testing Decisions

### What a good test is here

As in epic 1: a test states an externally observable fact, such as the response an operation returns, the baseline a later operation uses, or the event that was recorded. It does not assert which function ran or how a module is structured.

### The seam

**Still one seam: the daemon's HTTP API**, through the existing in-process test daemon helper and its single call function. Fixtures are real: temporary repositories created with `git init`, real commits, real ticket and roadmap files, and real `git worktree add`. There is no mocking. The ticket parser, the roadmap parser and the attention checks are exercised through `project.snapshot`, `daily.get` and `checkpoint.prepare`, not tested in isolation.

### The one exception

A single MCP smoke test drives the real `binn mcp` as a subprocess through the SDK's client over stdio. It lists the tools, calls `project_snapshot` against a test daemon, and makes one call with the daemon stopped, asserting the unreachable error. It covers what the in-process seam cannot: the handshake, tool naming, result encoding and the proxy path. It stays one test.

### Not automated

The skills. They are procedure text for an agent, and a test that asserts their wording would test nothing. They are verified by the exit demonstration.

### Prior art

`apps/daemon/test/status.test.ts` and `projects.test.ts` for real-repository fixtures through the seam; `apps/cli/test/smoke.test.ts` for the one subprocess test.

### Behaviour to cover

- Snapshot on a fixture with tickets in every Task state: which are listed, which are counted, section limits and remainder counts.
- `READY` with and without Unmet dependencies; `BLOCKED` versus an Unmet dependency.
- An unknown `Status:` value, a dangling `Blocked by`, and each of the four roadmap checks, each producing its attention item.
- A roadmap row that does not parse; a missing roadmap; a current focus over the limit, with the truncation marker.
- The unavailable sections present and marked.
- Daily: first call with no event (fallback declared), a second call in a row (empty delta), an explicit `since` (no event recorded), a baseline removed by history rewrite (fallback declared), a dirty working tree (flag set, uncommitted edits ignored).
- Daily transitions: a ticket moving `READY` → `DONE` between baseline and HEAD, a new ticket, a roadmap status change, a new ADR.
- Checkpoint: prepare returns the targets with the manifest's paths; record stores the head and the items; record with an uncommitted promoted path returns the diagnostic; the next prepare starts from that head.
- Worktrees: status inside a worktree under the repository reports that worktree's branch and names it; detect from a sibling worktree outside the repository finds the project; a nested separate repository keeps reporting the project's facts.
- The `daily` and `checkpoint` events survive a schema rebuild.
- The MCP smoke test above.

## Out of Scope

- **Epic 3**: the GitHub and GitLab adapters, the rest of the tracker contract (dependency mapping beyond `Blocked by`, parent and subtask relations), a Task projection, the compact task brief and `task_get`, `binn init` including MCP registration for other projects and harnesses, tracker credentials, Matt Pocock layout detection, `.scratch` materialisation, and CI state.
- **Epic 4**: usage, context pressure, AgentRuns, and everything read from session artifacts.
- The Streamable HTTP transport.
- `Question` and `Answer`, and with them the `question_*` tools and real pending decisions. Epic 1's note that their tier must be decided explicitly carries forward to whichever epic introduces them.
- `/task`, `/status` and `/audit` skills.
- Skill wrappers for any harness other than Claude Code, and generation of wrappers from one procedure description.
- Configurable snapshot limits.
- Any MCP tool that mutates something other than Binnacle's own event history.

## Further Notes

- **Decided while specifying this epic**: ADR-0020, under which Binnacle writes nothing into a project's repository and `checkpoint.commit` becomes `checkpoint.record`; and ADR-0021, under which the MCP server uses the official SDK. `CONTEXT.md` gained **Task**, **BLOCKED** and **Unmet dependency**.
- **Epic 3 inherits a contract, not a blank page.** Its GitHub and GitLab adapters must implement the Task-reading contract defined here. Where a remote tracker cannot express a field, the field is `null`, not a guess. If the contract turns out to have been shaped by the local adapter in a way a remote cannot satisfy, epic 3 changes the contract and records why.
- **The roadmap format is now load-bearing.** Editing its table header or renaming `Current focus` breaks the snapshot's roadmap section, visibly, through a diagnostic. `docs/roadmap.md`'s own *Keeping this current* section should say so.
- **The daily baseline is per machine.** A second machine starts with the fallback window. That is correct under the registry model (ADR-0019), not a defect.
- **Exit demonstration.** The closing ticket opens a fresh Claude Code session on this repository, once in the main checkout and once in a worktree, and runs `/product` → `/daily` → `/checkpoint` for real. Defects found are filed as tickets, as ticket 07 did in epic 1. The same ticket retires *This repository, until epic 2* in `docs/workflow/02-development-workflow.md` and the matching paragraph in `CLAUDE.md`.
