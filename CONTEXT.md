# Project Context

## Canonical terms

### Binnacle
The product name. A binnacle is the stand that holds a ship's compass in front of the helm: it does not steer and does not choose the course, it keeps the instruments readable for whoever does. The name is a standing constraint on scope — see `docs/adr/ADR-0009-product-name.md`. CLI: `binn`. Daemon: `binnd`. Packages: `@binnacle/*`.

### AI Development Control Plane
A local layer on top of an existing AI-development workflow. It does not replace coding agents, Git, the tracker or CI. It stores/projects project state, produces snapshots, collects telemetry and exposes MCP/UI/CLI interfaces.

### Project Brain
The sum of a project's long-lived knowledge and current state: docs, ADRs, specs, tracker, Git/CI state and code intelligence. It is not one file and not one database.

### Product Steward
A permanent logical role, but not a permanent chat. A new Product session must rebuild the current picture from a Product Snapshot.

### Product Snapshot
A compact projection of current project state for a fresh Product session: milestone, roadmap position, active tasks, blockers, pending decisions, recent durable decisions, Git/CI state and usage.

### AgentRun
One concrete run of a coding agent in a given role, harness/provider/model/profile. A single Task may have several AgentRuns.

### Checkpoint
An operation that persists only the new durable delta from the current session into canonical project sources. It is not a retelling of the whole chat.

### Scratch workspace
The ephemeral working space of the current task/run. It is not long-term memory and must not be the only tracker/state store.

### Manual-first
In v1 the system analyses and recommends actions, but does not start full AgentRuns, merges or releases without an explicit human decision.

## Current product boundary

Binnacle v1 = Project + Task + AgentRun + Review + Snapshots + Telemetry + Human approvals + Adapters.

Anything beyond that boundary is treated as an integration or a post-MVP capability.
