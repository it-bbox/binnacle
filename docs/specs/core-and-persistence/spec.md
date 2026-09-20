# Spec: Core and Persistence

Status: READY
Triage: ready-for-agent

Epic 1 of v1, as defined in `docs/05-mvp-plan.md` phase 1. Exit criterion: one local project can be registered and queried.

## Problem Statement

Binnacle has a complete design and no implementation. Everything the product promises — a Product Snapshot for a fresh session, a task brief, usage attribution, an audit — needs two things that do not exist yet: somewhere on the machine to keep runtime state, and a way for a CLI, an MCP client or a dashboard to reach it.

Concretely, today a developer cannot tell Binnacle that a repository exists. There is no `binn`, no `binnd`, no store, no answer to "what does Binnacle currently know about this project". Every later epic would otherwise invent its own storage, its own transport and its own vocabulary, and the first three of them would disagree.

There is a second problem underneath, which is why this epic is not just scaffolding. Binnacle installs on other people's machines and is upgraded by people who do not read changelogs. The storage rules that make that survivable — a database that is a projection and can be thrown away, one copy of anything parsed out of a third-party artifact, a project that keeps working when the daemon is stopped — are decided in ADR-0002 and ADR-0015 but have never been executed. If they are first exercised in epic 4, when there is real telemetry to lose, they get tested by losing it.

## Solution

A developer installs `@binnacle/cli` from npm on Node 24 and runs:

```bash
binn daemon start
binn project register .
binn project status
```

The daemon is a user process listening on loopback, backed by one `node:sqlite` database per machine under the Binnacle home directory. `binn project register` reads the repository's committed `.binnacle/project.yaml`, asks Git for what Git already knows, and records the project. `binn project status` returns manifest facts and current Git facts together. `binn project list` shows every registered project; `binn project unregister` reverses the registration and touches nothing in the repository.

Everything goes through one local HTTP API whose operations carry the same names as the MCP surface in `docs/03-mcp-and-skills.md`, so epic 2 adds transports rather than a translation layer.

Two properties matter as much as the operations:

- **Stopping the daemon costs nothing.** The repository, its docs, its ADRs, its specs and its tracker are untouched and sufficient. Binnacle is never a required runtime (`AGENTS.md` §3).
- **Upgrading costs nothing.** On a schema version change, projections are dropped and rebuilt from sources outside the database; the append-only history is migrated and never recreated (ADR-0015). A rebuild is a normal operation with an event to show for it, not a recovery procedure.

## User Stories

1. As a developer adopting Binnacle, I want to install the CLI from npm and run it on Node 24, so that I never wait on `node-gyp` or download a platform binary.
2. As a developer on Windows, macOS or Linux, I want `binn daemon start` to work natively, so that I am not pushed into WSL2 or a container to use a local tool.
3. As a developer, I want the daemon to be a user process I started myself, so that nothing installs a system service behind my back.
4. As a developer, I want `binn daemon status` to tell me whether a daemon is running, on which port and since when, so that I can tell a stalled daemon from a stopped one.
5. As a developer, I want `binn daemon stop` to stop it cleanly and remove its runtime file, so that the next start is not confused by leftovers.
6. As a developer, I want a second `binn daemon start` to report the running instance instead of starting a competitor, so that two processes never write to one database.
7. As a developer, I want a daemon killed without a clean stop to be detected as stale on the next start, so that a leftover runtime file does not block me from restarting.
8. As a developer, I want the daemon to bind loopback only, so that nothing else on my network can reach my project state.
9. As a developer, I want every API call to carry the token from my Binnacle home directory, so that a browser tab reaching `127.0.0.1` cannot read that state.
10. As a developer, I want the token file created owner-only where the operating system enforces file modes, so that other accounts on the machine cannot read it.
11. As a developer on Windows, I want to be told plainly that POSIX modes do not apply there, so that I am not reassured by a protection that is not running.
12. As a developer, I want requests carrying an unexpected `Origin` or `Host` rejected, so that DNS rebinding cannot turn a web page into a client of my daemon.
13. As a developer, I want to point Binnacle at a different home directory through an environment variable, so that I can keep a throwaway instance away from my real one.
14. As a developer, I want one database per machine rather than one per project, so that a cross-project overview is possible at all later.
15. As a developer, I want to register a repository as a Binnacle project by path, so that Binnacle knows it exists.
16. As a developer, I want registering an already-registered project to succeed and change nothing, so that re-running the command is never destructive.
17. As a developer, I want to list every registered project with its name and path, so that I can see what this machine is tracking.
18. As a developer, I want a status operation that returns manifest facts and current Git facts together, so that I can see in one place what Binnacle believes about a project.
19. As a developer, I want to unregister a project without deleting anything in the repository, so that adopting Binnacle is reversible.
20. As an agent session, I want a detect operation that maps my working directory to a project, so that I can identify the project without being told which one it is.
21. As an agent session, I want detect to work from a nested subdirectory of the repository, so that it works wherever the harness happened to start.
22. As an agent session, I want detect on an unregistered directory to say so explicitly, so that I never act on a guess.
23. As a developer, I want registration to fail readably when `.binnacle/project.yaml` is missing, naming the template I can copy, so that I know the next move.
24. As a developer, I want each manifest validation error to name the exact field path and what was expected, so that I can fix the file without reading Binnacle's source.
25. As a developer, I want every manifest problem reported in one pass rather than one per run, so that fixing a manifest is one edit and not five.
26. As a developer, I want an unsupported manifest `version` to be a hard error naming the supported version, so that a format change never gets half-applied.
27. As a developer, I want unknown manifest keys reported as warnings rather than failures, so that a manifest written by a newer Binnacle does not break an older one.
28. As a developer, I want Binnacle to read Git and never write to it, so that registering a project cannot touch my working tree, index or refs.
29. As a developer, I want branch, HEAD, dirty state and remotes reported for a normal repository, so that status reflects reality rather than the manifest's claims.
30. As a developer, I want a detached HEAD, a repository with no commits and a repository with no remote each treated as a normal case, so that ordinary situations are not errors.
31. As a developer whose project is not in Git, I want registration to still succeed with Git facts marked unavailable and a reason, so that the project is degraded, not rejected.
32. As a developer without `git` on PATH, I want the same graceful degradation, so that a missing optional dependency never takes the daemon down.
33. As a developer, I want a mismatch between the manifest's declared tracker and the Git remote surfaced as a diagnostic, so that Binnacle reports the disagreement instead of silently picking a side.
34. As a developer, I want each meaningful state change recorded as an event I can list, so that later views have a history to read rather than a snapshot to guess from.
35. As a developer, I want that history to survive an upgrade, so that the only copy of something parsed or observed is never dropped.
36. As a developer, I want projections rebuilt automatically on a schema version change, so that upgrading never asks me to run a migration.
37. As a developer, I want my list of registered projects to survive that rebuild, so that an upgrade cannot silently unregister my work.
38. As a developer, I want the rebuild itself recorded as an event, so that I can tell "rebuilt" apart from "lost".
39. As a developer, I want deleting the database to cost me runtime history only, so that nothing in Git or the tracker depends on it.
40. As a developer, I want to stop the daemon and keep working normally with my agents and Git, so that Binnacle is never in the critical path.
41. As a developer, I want the daemon to make no network calls and never invoke a model, so that running it cannot spend my tokens or leak my code.
42. As a developer, I want the same state to produce the same answer every time, so that snapshot quality is measurable later rather than atmospheric.
43. As a developer, I want CLI exit codes to distinguish a usage error, an operation failure and an unreachable daemon, so that I can script around them.
44. As a developer, I want errors carrying a stable machine-readable code alongside the human message, so that tooling can branch on the cause.
45. As a maintainer, I want the HTTP operations named exactly as the planned MCP tools, so that epic 2 is a transport shim with no mapping layer to keep in sync.
46. As a maintainer, I want one test harness that starts a daemon against a temporary home directory, so that every later epic tests through the same seam instead of inventing another.
47. As a maintainer, I want the binnacle repository itself registered as project number one, so that the exit criterion is demonstrated on a real project rather than a fixture.

## Implementation Decisions

### Workspace

- Code lands in `packages/core`, `packages/adapters`, `apps/daemon` and `apps/cli`. `packages/mcp`, `packages/telemetry` and `apps/dashboard` stay empty until the epic that fills them; the boundaries in `docs/07-initial-repository-layout.md` are already recorded and do not need scaffolding in advance.
- Package names follow ADR-0009: `@binnacle/core`, `@binnacle/adapters`, `@binnacle/daemon`, `@binnacle/cli`. Only `@binnacle/cli` is user-facing; the daemon binary is `binnd` and ships inside it.
- Node 24, TypeScript, pnpm workspace, per ADR-0008. `node:sqlite` per ADR-0015. No native modules and no build step for the user, per ADR-0016.
- Publishing to npm is configured but not exercised in this epic; there is nothing worth publishing until epic 2.

### TypeScript and runtime

- `tsc` produces the published JavaScript. Local development runs the sources directly on Node's built-in type stripping, which requires the compiler's `erasableSyntaxOnly` setting: no `enum`, no parameter properties, no namespaces.
- State values are therefore string-literal union types, not enums. This is also the shape the store and the wire want, so nothing is lost.
- `packages/core` has no runtime dependencies. Parsing YAML, touching the filesystem and spawning `git` all live outside it.

### Domain model

- `packages/core` owns the domain: the entity types from `docs/06-data-model.md` for `Project`, `Task`, `AgentRun` and `Review`, plus the three state machines from `docs/workflow/03-state-machines.md` as pure transition functions — given a current state and a transition, return the next state or a typed rejection.
- **Tables are created by the epic that writes to them.** This epic creates storage for `Project` and for events only. Task, AgentRun and Review get their types and transition logic here so that the tracker and telemetry adapters consume a domain rather than inventing one; their tables arrive with their writers in epics 3 and 4. The rebuild policy below makes adding a projection table free, so nothing is saved by creating them early and a dead schema is avoided.
- Task, AgentRun and Review keep separate state machines. No combined status enum (`docs/06-data-model.md`).

### Storage

- One database per machine at `<BINNACLE_HOME>/binnacle.db`, where `BINNACLE_HOME` defaults to `.binnacle` inside the user's home directory and is overridable by the environment variable of the same name (ADR-0015). Resolution uses `node:path` and the platform's own home convention (ADR-0016).
- The daemon is the only writer and the only process that opens the database. The CLI and, later, the dashboard reach it through the API (`docs/07-initial-repository-layout.md`).
- **Two tiers, as ADR-0015 requires.** Tier 1 is projections, dropped and recreated whenever the stored schema version differs from the running one, then re-derived from sources outside the database. Tier 2 is one append-only table of records with provenance, migrated properly and never recreated.
- This epic's tier 1 is the `Project` projection. Its tier 2 is the event table.
- **The registry of which repositories are registered is a file, not a table**: a small JSON document under the Binnacle home directory listing registered repository paths, written owner-only. It is the one thing in this epic that is genuinely canonical — no source outside Binnacle records that a user chose to register a path — so it must not live in a table that gets dropped, and it should stay readable and repairable when the database is gone. The `Project` projection is derived from this file plus each repository's manifest plus live Git facts.
  - Recorded as ADR-0019, which also states why it is not a third storage tier.
- Whether raw ingested harness records share the event table or sit beside it in the same tier is left to epic 4, which is the first epic with such records. This epic commits only to the tier rule.

### Daemon and API

- `binn daemon start` starts a background user process bound to loopback. The port defaults to an arbitrary fixed value, is overridable by the environment, and accepts `0` so that tests can take an ephemeral port. The actual bound port, the pid, the start time and the version are written to a runtime file under the Binnacle home directory so that the CLI can find a running daemon.
- Exactly one daemon per Binnacle home. A start that finds a live pid in the runtime file reports it and exits without starting. A runtime file whose pid is dead is treated as stale and replaced.
- The API is a single route shape: a POST per operation, named for the operation, with a JSON body and a JSON response. **The operation names are exactly those planned for MCP** — `project.detect`, `project.status`, `project.list` — so epic 2 implements two transports over the same handlers with no name mapping.
- Operations in this epic: `project.detect`, `project.register`, `project.list`, `project.status`, `project.unregister`, `event.list`, `daemon.status`. `project.register` and `project.unregister` are local administrative mutations; whether MCP exposes them at all is epic 2's decision and is deliberately not settled here.
- One unauthenticated liveness endpoint answers whether a Binnacle daemon is listening and its version, and nothing else. Every other call requires the bearer token.
- **Authentication.** The token is generated on first daemon start into a file under the Binnacle home directory, owner-only where the platform enforces modes. Every operation call must present it. Loopback is not an authentication boundary and is not treated as one (`docs/operations/04-security-resilience.md`).
- **Rebinding defence.** A request whose `Host` is not the loopback address and port the daemon bound is rejected. A request carrying an `Origin` header that is not on the allowlist is rejected. There are no accounts; there is one user.
- **Error envelope.** Every failure returns the same shape, with a stable `code` for tooling and a `message` for a human:

```json
{ "error": { "code": "manifest.invalid", "message": "...", "details": [ { "path": "tracker.provider", "message": "expected one of github, gitlab, local" } ] } }
```

- Codes are part of the contract and are not reworded per release; messages may be.

### Project manifest

- `.binnacle/project.yaml` is committed to the repository and is the project's own declaration (`docs/01-architecture.md`). `templates/project/project.yaml.example` is its reference shape.
- YAML text is parsed to an unknown value outside `packages/core`, using one small YAML dependency; validation from unknown to a typed manifest is a pure function inside core with no dependencies.
- Validation collects every problem and returns them all, each with a dotted field path. It never throws for invalid input.
- `version` must be `1`; anything else is a hard error naming the supported version. Unknown keys are warnings, so a manifest from a newer Binnacle degrades instead of failing.
- Secrets are never read from the manifest and never written to it (ADR-0013, `docs/operations/04-security-resilience.md`). Tracker credentials are out of this epic entirely.
- This epic does not generate manifests. Creating one is `binn init`'s job in a later epic; registration without a manifest fails with a message naming the template to copy.

### Git adapter

- Read-only, and read-only by construction: the adapter spawns `git` with explicit argument arrays — never a shell string — and runs only commands that inspect. No fetch, no network, no write, no config change, no ref update.
- It returns repository root, HEAD, current branch or an explicit detached marker, dirty flag, and remotes. A repository with no commits, no branch or no remote is a normal result, not an error.
- Missing `git`, or a directory that is not a repository, returns a typed unavailable result carrying a reason. `project.status` then reports manifest facts with Git facts absent and the reason attached, per the graceful-degradation rule.
- Every spawn has a timeout; a hung `git` degrades to unavailable rather than hanging the API.
- The manifest's declared tracker provider is authoritative. A Git remote that disagrees with it produces a diagnostic on `project.status`; Binnacle reports the disagreement and does not resolve it.
- Reflog reading for run-to-task correlation (ADR-0018) is epic 4 and is not built here.

### Events

- Events are append-only records with a type, a timestamp, optional project reference, a JSON payload and provenance (ADR-0007: nothing invented, everything sourced).
- This epic emits: daemon started, daemon stopped, project registered, project unregistered, manifest changed since last projection, and store rebuilt.
- `event.list` returns them filtered by project and time, newest first, with a limit. No aggregation, no derived metrics — those arrive with the data that justifies them.

### Standing guarantees this epic must not break

- No model invocation and no outbound network traffic anywhere in this epic (ADR-0012).
- No writes to any tracker (ADR-0013). No tracker adapter exists yet, and no code path anticipates one.
- No autonomous action: nothing starts an AgentRun, merges, or changes a repository (ADR-0001).
- The same input state produces the same output. Time and randomness enter only where recorded as data (timestamps, generated identifiers), never in what an operation decides.

## Testing Decisions

### What a good test is here

A test states an externally observable fact about the system: the response an operation returns, the state a later operation reports, the files that appeared under the Binnacle home directory, or the HTTP status a hostile request got. It does not assert which internal function ran, what SQL was issued, or how a module is structured. Any test that would need rewriting because a module was renamed is testing the wrong thing.

### The seam

**One seam: the daemon's HTTP API.** A test helper starts a daemon in-process on an ephemeral port with the Binnacle home directory pointed at a temporary directory, and exposes a single call function taking an operation name and a body. Everything below — manifest validation, the store, the schema rebuild, the Git adapter, authentication, the event log — is exercised through it.

Fixtures are real, not mocked: temporary directories, real `git init` and real commits, real manifest files. There is no mocking library and no dependency-injection seam for tests to reach through; if a behaviour cannot be reached from the API, that is a signal about the API, not a reason for a second seam.

That test helper is the deliverable epics 2 to 6 reuse. It is part of this epic's output, not scaffolding around it.

### The one exception

A single smoke test drives the real `binn` binary as a subprocess: start the daemon, run a project operation, stop the daemon. It covers what the in-process seam cannot — process spawn, the runtime file, the token file, exit codes — and it stays one test, not a suite.

### Runner

`node:test` with `node:assert/strict`. It is in the standard library, it needs no configuration, and ADR-0016's whole argument is that this project does not pay for build matrices it can avoid.

### Prior art

None. This repository has no tests yet; this epic establishes the pattern every later epic follows. That makes the harness's shape a review-worthy decision in its own right, not an implementation detail to be settled in passing.

### Behaviour to cover

- Register, list, status and unregister on a normal repository; register twice and observe no change.
- Detect from the repository root, from a nested subdirectory, and on an unregistered directory.
- Register with no manifest; with an unsupported `version`; with several invalid fields at once, asserting that every field path is reported in one response; with unknown keys, asserting a warning and a success.
- Git facts on a clean repository, a dirty one, a detached HEAD, one with no commits, and one with no remote.
- A directory that is not a repository, and a `git` binary absent from PATH: both register successfully with Git facts unavailable and a reason.
- A manifest tracker that disagrees with the Git remote, asserting the diagnostic.
- A schema version bump: the project projection is re-derived, the registry file and the event history survive, and a rebuild event is recorded.
- Requests with no token, a wrong token, a hostile `Origin` and a hostile `Host`, each rejected with the right status.
- A second daemon start against the same home refused; a stale runtime file recovered.
- The CLI smoke test above, asserting exit codes for success, operation failure and an unreachable daemon.

## Out of Scope

- **Epic 2** — the MCP server and its two transports, Product Snapshot, daily delta, checkpoint prepare and commit, client skill wrappers.
- **Epic 3** — the tracker contract and its GitHub, GitLab and local-Markdown adapters; `binn init`, including manifest generation, harness detection and MCP registration; tracker credentials; Matt Pocock layout detection; `.scratch` materialisation.
- **Epic 4** — telemetry ingestion, session-artifact readers, raw ingest records, historical import, run-to-task correlation from `cwd` and reflog, context pressure, OpenTelemetry.
- **Epic 5** — the Nuxt dashboard. Nothing in this epic renders anything.
- **Epic 6** — the read-only audit and adoption analysis.
- Installing the daemon as an auto-starting system service, and standalone binaries (ADR-0016).
- Question, Answer, Checkpoint, Snapshot and AttentionItem entities; budget policy; worktree parallelism recommendations.
- Any remote or multi-user exposure of the daemon. It is loopback-only with one user and no accounts.
- Performance work. Correctness and honest failure behaviour first; there is no data volume yet to optimise against.

## Further Notes

- **ADR-0015 does not list AgentRun among the projections.** This spec reads that as an omission rather than a contradiction: AgentRun is derived from ingested session artifacts, so it belongs in tier 1, rebuilt from the tier-2 records that produced it. Epic 4 should confirm or correct that reading when it has real records in hand; this epic creates no AgentRun storage either way.
- **Question and Answer bodies are agent-authored and derive from nothing outside Binnacle.** The two-tier rule does not cover them, and they are epic 2's first mutation. Epic 2 must decide their tier explicitly; if the answer is "migrated", that is an ADR, not a schema detail.
- **The registry-as-file decision above was the only new durable trade-off this spec introduced**, and it is now ADR-0019. Read that ADR before touching the store; it is the reason a rebuild cannot unregister a project.
- **The branch naming convention that ADR-0018 makes load-bearing is not defined here.** Epic 4 defines it. This epic reads the branch as a fact and attaches no meaning to its shape.
- **Windows file permissions.** `0600` is a POSIX concept. On Windows the token and registry files are protected by the user profile's ACL and nothing Binnacle does. Say so in the documentation rather than implying an enforcement that is not there.
- **This repository is project number one** (`docs/00-scope.md`). Part of closing this epic is committing a `.binnacle/project.yaml` here and registering it, which is how the exit criterion gets demonstrated on something real.
