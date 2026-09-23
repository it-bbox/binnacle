# 01: Daemon lifecycle over an authenticated loopback API

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** a user can start a Binnacle daemon on their own machine, ask whether it is running, and stop it again — and nothing else on the machine or in a browser can talk to it. This is the walking skeleton: the thinnest complete path from the CLI through HTTP to the filesystem, with no project state in it yet. It also establishes the route shape, the error envelope and the test harness every later ticket depends on.

- [x] `binn daemon start` runs a user process bound to loopback and reports the port it took; the port is overridable by environment and accepts `0` for an ephemeral one.
- [x] `binn daemon status` reports whether a daemon is running, on which port, since when, under which pid and at which version.
- [x] `binn daemon stop` stops it cleanly and removes its runtime file.
- [x] A second start against the same Binnacle home reports the running instance and exits without starting a competitor.
- [x] A runtime file whose pid is no longer alive is treated as stale and replaced, not as a blocker.
- [x] A token is generated on first start into the Binnacle home directory, owner-only where the platform enforces file modes; on Windows the documentation says plainly that it is not enforced.
- [x] Every operation call requires that token. A missing or wrong token is rejected.
- [x] A request whose `Host` is not the loopback address and port the daemon bound is rejected; a request carrying an `Origin` outside the allowlist is rejected.
- [x] One unauthenticated liveness endpoint answers whether a Binnacle daemon is listening and its version, and nothing else.
- [x] Operations are addressed by name, one POST per operation, using the names planned for MCP; `daemon.status` is the first.
- [x] Every failure returns the shared error envelope with a stable machine-readable `code` and a human `message`.
- [x] CLI exit codes distinguish success, usage error, operation failure and unreachable daemon.
- [x] A test helper starts a daemon in-process on an ephemeral port against a temporary Binnacle home and exposes one call function taking an operation name and a body. Every later ticket tests through it.
- [x] One smoke test drives the real CLI as a subprocess: start, an operation, stop.
- [x] The daemon opens no outbound connections and invokes no model (ADR-0012).

## Comments

Implemented on `feat/daemon-lifecycle`. `apps/daemon` (`@binnacle/daemon`, binary `binnd`) and `apps/cli` (`@binnacle/cli`, binary `binn`); 32 tests under `node:test`, `tsc --noEmit` clean.

Decisions worth knowing before ticket 02:

- **The test seam is `@binnacle/daemon/testing`.** `startTestDaemon()` starts a daemon in-process on an ephemeral port against a temporary Binnacle home and returns `{ home, token, runtime, url, call, stop }`. `call(operation, body, options)` returns `{ status, body }` rather than throwing, so a rejection is asserted directly. Later tickets test through it.
- **The route shape is `POST /ops/<operation>`**, plus the one unauthenticated `GET /health`. A new operation is one entry in the `operations` record in `apps/daemon/src/server.ts`; the handler signature is `(body: unknown, context: { home, runtime }) => unknown`.
- **`Host` must be exactly the bound address** (`127.0.0.1:<port>`), not `localhost:<port>`. The checkbox says "the loopback address and port the daemon bound", so the allowlist holds one entry; the rejection message names the expected address so a human who curled `localhost` is unblocked.
- **The runtime file is the claim on a Binnacle home**, created with `O_EXCL`. A live pid refuses the start; a dead pid or an unreadable file is stale and replaced. `releaseRuntime(home, pid)` removes it only if it still names that pid, so a failed start never clears a running daemon's claim.
- **`binn daemon start` treats a live pid as running, full stop.** An earlier version also probed `/health` first and would have spawned a competitor against a daemon that was merely busy.
- **`<home>/daemon.log`** carries the detached daemon's stderr. Not in the ticket, but a background process whose start fails is otherwise undiagnosable; `binn daemon start` prints its tail on a failed start.

Deliberately not done here:

- **Both packages are `private: true`.** The spec says publishing is "configured but not exercised"; a `workspace:*` dependency would publish broken, and there is nothing worth publishing until epic 2.
- **`apps/cli` depends on `@binnacle/daemon`** for home, runtime-file and token handling. Daemon lifecycle cannot go over the API — spawning, the runtime file and the pid are all outside it — and the spec already has `binnd` shipping inside `@binnacle/cli`. If a third consumer appears, that module wants to move to `packages/`.

### Review

One defect found and fixed on the branch. The operation table was a plain object literal, so `operations[name]` resolved inherited `Object.prototype` members: `POST /ops/toString` answered `200 "[object Undefined]"`, `/ops/constructor` answered `200 {}`, and `/ops/hasOwnProperty` and `/ops/valueOf` threw into the 500 path. The existing unknown-operation test passed because the name it invented is not on the prototype. Lookup is now guarded by `Object.hasOwn`, and the regression test walks the inherited names rather than one made-up one. This matters beyond the walking skeleton: ticket 02 adds `project.*` to the same table, and epic 2 exposes it over MCP.

One note for ticket 02, not a defect. The `ponytail:` comment on `claimHome` says two starts racing on the same *stale* runtime file are "caught downstream by the store's own locking". Nothing downstream exists yet. When the store lands, either that has to be true of SQLite's locking or the claim needs a different answer.

Merged to `main` in `5812cf5`, review included.
