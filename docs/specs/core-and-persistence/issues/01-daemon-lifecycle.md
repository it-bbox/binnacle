# 01: Daemon lifecycle over an authenticated loopback API

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** a user can start a Binnacle daemon on their own machine, ask whether it is running, and stop it again — and nothing else on the machine or in a browser can talk to it. This is the walking skeleton: the thinnest complete path from the CLI through HTTP to the filesystem, with no project state in it yet. It also establishes the route shape, the error envelope and the test harness every later ticket depends on.

- [ ] `binn daemon start` runs a user process bound to loopback and reports the port it took; the port is overridable by environment and accepts `0` for an ephemeral one.
- [ ] `binn daemon status` reports whether a daemon is running, on which port, since when, under which pid and at which version.
- [ ] `binn daemon stop` stops it cleanly and removes its runtime file.
- [ ] A second start against the same Binnacle home reports the running instance and exits without starting a competitor.
- [ ] A runtime file whose pid is no longer alive is treated as stale and replaced, not as a blocker.
- [ ] A token is generated on first start into the Binnacle home directory, owner-only where the platform enforces file modes; on Windows the documentation says plainly that it is not enforced.
- [ ] Every operation call requires that token. A missing or wrong token is rejected.
- [ ] A request whose `Host` is not the loopback address and port the daemon bound is rejected; a request carrying an `Origin` outside the allowlist is rejected.
- [ ] One unauthenticated liveness endpoint answers whether a Binnacle daemon is listening and its version, and nothing else.
- [ ] Operations are addressed by name, one POST per operation, using the names planned for MCP; `daemon.status` is the first.
- [ ] Every failure returns the shared error envelope with a stable machine-readable `code` and a human `message`.
- [ ] CLI exit codes distinguish success, usage error, operation failure and unreachable daemon.
- [ ] A test helper starts a daemon in-process on an ephemeral port against a temporary Binnacle home and exposes one call function taking an operation name and a body. Every later ticket tests through it.
- [ ] One smoke test drives the real CLI as a subprocess: start, an operation, stop.
- [ ] The daemon opens no outbound connections and invokes no model (ADR-0012).
