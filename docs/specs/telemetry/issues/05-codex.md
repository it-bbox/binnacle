# 05: Codex usage, with the branch from the reflog

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/telemetry/spec.md`

**What to build:** Codex sessions count, with honest arithmetic, and their branch recovered from Git where Codex records none. Decided in the spec, under *Where the artifacts are*, *Normalised record* and *Ingest*, and in ADR-0028.

- [ ] The daemon's runtime carries the Codex root: `$CODEX_HOME/sessions`, otherwise `~/.codex/sessions`. A rollout's `cwd` comes from its `session_meta` record.
- [ ] A pure Codex reader in `packages/adapters` turns consecutive `total_token_usage` values into differences, `calculated`; input not read from cache is `input_tokens − cached_input_tokens`, `calculated`. A decreasing total is a failure.
- [ ] Provider is `session_meta.model_provider`; model is the turn context's.
- [ ] The branch is resolved at ingest from the `HEAD` reflog of the checkout the `cwd` names, matched by timestamp, and stored with source `reflog`; with no answer it is `null` and the run is unassigned.
- [ ] `harnesses` in the snapshot lists Codex with the level it reached.
- [ ] Fixtures are cut from a real rollout, and the ticket's comments say which.
