# Scope and Product Boundary

## Product statement

Binnacle is a local, provider-agnostic AI Engineering Control Plane that keeps project state outside chats, provides compact current context to fresh agents, measures AI development usage, and keeps humans in control of execution.

## Problems in scope

### Context continuity
Fresh Product/Developer agents should understand current project state without inheriting a weeks-long conversation.

### Token/usage visibility
Usage should be attributable where possible to Project → Task → AgentRun → Role → Harness/Provider/Model.

### Project knowledge routing
Agents should know where to look instead of repeatedly scanning large repositories.

### Workflow observability
The user should always know what is running, what is waiting, what requires attention, and how much it consumed.

### Existing-project adoption
A project should be auditable and adoptable without destructive migration.

## Explicit non-goals for v1

- autonomous project management;
- automatic hiring/spawning of role agents, except `/autopilot`: started by a human, for one already planned epic (ADR-0022);
- automatic model selection/routing;
- replacement of GitHub/GitLab Issues;
- replacement of Git, CI/CD, deployment platforms or observability backends;
- production SRE/incident platform;
- Kubernetes management;
- multi-user/team SaaS;
- central cloud service;
- universal equal-cost normalization across providers;
- mandatory Obsidian/Graphify dependency;
- building our own vector DB/RAG stack.

## Success criteria

V1 is successful if it can demonstrate on a real existing project that:

1. a fresh Product session can resume work from a compact generated snapshot;
2. tasks/runs/reviews are visible without reading old chats;
3. usage can be analyzed per project/task/run with source quality marked;
4. long Product-session context can be rotated safely;
5. existing Git/docs/issues remain sufficient to continue work if Binnacle is unavailable;
6. the system can compare baseline vs optimized workflow using real data.

## Validation

Binnacle is built by being used on itself. The `binnacle` repository is project number one from Phase 1 onward, and the workflow claims above are tested there first.

Adopting an existing large third-party repository as a baseline case is **post-v1 activity**. It is what the product is for, not what building it depends on. When it happens, historical sessions may be imported at project level even where exact task attribution cannot be established.
