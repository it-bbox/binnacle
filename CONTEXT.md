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

### Product Steward
A permanent logical role, but not a permanent chat. A new Product session must rebuild the current picture from a Product Snapshot.

### Product Snapshot
A compact projection of current project state for a fresh Product session: milestone, roadmap position, active tasks, blockers, pending decisions, recent durable decisions, Git/CI state and usage.

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

### Spec
A durable document describing intended behaviour. It lives in Git, next to the code it describes.

### Ticket
A unit of work. It lives in the project's tracker, and references its Spec. A Spec is not a Ticket and a Ticket is not a Spec.

### Checkpoint
An operation that persists only the new durable delta from the current session into canonical project sources. It is not a retelling of the whole chat.

### Scratch workspace
The ephemeral working space of the current task/run. It is not long-term memory, it is not the tracker, and it never holds the only copy of anything durable.

### Manual-first
In v1 the system analyses and recommends actions, but does not start full AgentRuns, merges or releases without an explicit human decision. Binnacle also never invokes a model itself.

## Current product boundary

Binnacle v1 = Project + Task + AgentRun + Review + Snapshots + Telemetry + Human approvals + Adapters.

Binnacle reads the tracker and never writes to it. Anything beyond that boundary is treated as an integration or a post-MVP capability.
