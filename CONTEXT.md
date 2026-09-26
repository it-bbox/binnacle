# Project Context

## Canonical terms

### Binnacle
The product name. A binnacle is the stand that holds a ship's compass in front of the helm: it does not steer and does not choose the course, it keeps the instruments readable for whoever does. The name is a standing constraint on scope — see `docs/adr/ADR-0009-product-name.md`. CLI: `binn`. Daemon: `binnd`. Packages: `@binnacle/*`.

### AI Engineering Control Plane
The product category. A local layer on top of an existing AI-development workflow. It does not replace coding agents, Git, the tracker or CI. It stores/projects project state, produces snapshots, collects telemetry and exposes MCP/UI/CLI interfaces.

This term replaced the earlier "AI Development Control Plane". Both named the same thing; "Engineering" is the canonical form and the one used in public positioning.

### Project Brain
The sum of a project's long-lived knowledge and current state: docs, ADRs, specs, tracker, Git/CI state and code intelligence. It is not one file and not one database.

### Project registry
The list of repository paths registered with Binnacle on one machine. It is canonical — no source outside Binnacle records that this machine tracks a given path — so it is a file, not a table, and the `Project` table is a projection of it (`docs/adr/ADR-0019-registry-is-a-file.md`).

### Checkout
One working directory of a repository: the registered one, or a linked worktree of the same repository (`git worktree add`), which has its own branch, HEAD and dirty state and shares the repository's Git common directory. Git facts always describe the caller's checkout and say which one it is. A separate repository nested inside a project is not a checkout of it.

### Product Steward
A permanent logical role, but not a permanent chat. A new Product session must rebuild the current picture from a Product Snapshot.

### Product Snapshot
A compact projection of current project state for a fresh Product session: milestone, roadmap position, active tasks, blockers, pending decisions, recent durable decisions, Git/CI state and usage.

### Next action
The step the roadmap's current focus ends with, and the command the owner types to take it. The Product session writes it: it is the course, and Binnacle only reads it.

### Suggested step
Binnacle's own reading of what comes next, computed from the Tasks, their AgentRuns and the roadmap's epic statuses, and labelled as a calculation. It stands beside the Next action and never replaces it: the Next action comes first, and the Suggested step offers the other ways to go on as a list of up to three alternatives, each with its reason — wait for a Task being worked on, a second Task beside it, one Task by hand, the whole epic with autopilot — leaving out any whose command is the Next action's, so none when it agrees with the Next action. A Next action that is missing, or names work already done, is an attention item.

### Harness
The coding client a run happens inside: Claude Code, Codex, Gemini CLI and others. A harness is not a provider — the same harness can be pointed at different backends.

### Provider
The backend serving the model to a harness: Anthropic, OpenAI, Z.ai, Google, a local runtime. GLM is a provider, not a harness.

### Harness support level
How far Binnacle can see into a given harness, graded rather than binary:

1. **Context** — the harness can call an MCP server. This is the only requirement for a harness to count as supported, and it needs no adapter.
2. **Attribution** — a session artifact carries a working directory and a session identifier.
3. **Usage** — that artifact also carries token counts.
4. **Live** — the harness exposes a stream that can be observed while it runs.

### Session artifact
What a harness writes to local disk about a session. The primary source of telemetry, because it exists without configuration and covers work already done.

### Context pressure
The normalised signal for a session outgrowing its context: cumulative input plus explicit compaction markers where a harness emits them. Harnesses express this differently; the signal is normalised, the underlying values are never invented.

### AgentRun
One concrete run of a coding agent in a given role, harness/provider/model/profile. A single Task may have several AgentRuns.

An AgentRun observed in a session artifact is one unbroken stretch of a session in one checkout on one branch: a session that switches branch becomes two AgentRuns, each attributed on its own. A subagent's session is an AgentRun of its own, linked to the run that started it. Its role comes from its branch — the default branch is Product work, a ticket's branch is implementation, anything else is unknown. An observed AgentRun has no lifecycle state, because an artifact cannot tell a finished run from an abandoned one; whether it is active is read from its latest activity.

### Unassigned
Usage attributed to a Project but to no Task, because no branch mapping to a Task can be proven for it. It is a first-class outcome, never a guess.

### Spec
A durable document describing intended behaviour. It lives in Git, next to the code it describes.

### Ticket
A unit of work. It lives in the project's tracker, and references its Spec. A Spec is not a Ticket and a Ticket is not a Spec.

### Ticket header
The `Status:`, `Blocked by:` and `Spec:` lines at the top of a ticket, whether it is a Markdown file or the body of a GitHub or GitLab issue. It is where a Task's state, dependencies and spec are read from on every tracker. On a remote tracker, closing the issue outranks the `Status:` line (ADR-0024).

### Task
Binnacle's view of a Ticket: its identity, title, lifecycle state and dependencies. The Ticket is canonical; a Task has no existence of its own and is always re-read from the tracker. On the local Markdown tracker its identity is `<spec-slug>/<NN>`, because ticket numbers are unique only within one Spec.

### Task brief
What a session needs to start one Task: its fields, its dependencies with their titles and states, its spec's path, the ticket body without comments, and the branch name that maps to it. It is compact by construction; the comments and the spec are read separately, when needed.

### BLOCKED
A Task state: work started and now waits on something. It is not the same as an Unmet dependency, and a snapshot reports the two separately.

### Unmet dependency
A Ticket this Task is declared to be blocked by, which is not yet done. A Task with one can be in any state, `READY` included.

### In progress
A Task in flight by its state (`ACTIVE`, `BLOCKED`, `READY_FOR_REVIEW`, `APPROVED` or `MERGE_READY`), or a `READY` Task with an AgentRun attributed to it. The second is Binnacle's reading of the runs: it is shown as such and never written back to the ticket.

### Review
One review of a Task's work: its findings, and what was fixed or kept. It is recorded in the ticket, under a `### Review` heading.

### Checkpoint
An operation that persists only the new durable delta from the current session into canonical project sources. It is not a retelling of the whole chat. The calling session writes the delta after the human confirms it; Binnacle computes what to consider and records that the checkpoint happened, and writes nothing into the repository itself.

### Scratch workspace
The ephemeral working space of the current task/run. It is not long-term memory, it is not the tracker, and it never holds the only copy of anything durable.

### Manual-first
In v1 the system analyses and recommends actions, but does not start full AgentRuns, merges or releases without an explicit human decision. Binnacle also never invokes a model itself.

### Autopilot
A human-started skill that runs the remaining tickets of one already planned epic to the end: one agent per ticket, each branch verified before it is merged. Starting it is the explicit human decision for that epic's AgentRuns and merges. It stops at any question only the owner can answer, and never plans an epic or moves to the next one (ADR-0022).

## Current product boundary

Binnacle v1 = Project + Task + AgentRun + Review + Snapshots + Telemetry + Human approvals + Adapters.

Binnacle reads the tracker and never writes to it. Anything beyond that boundary is treated as an integration or a post-MVP capability.
