# 04: The MCP server, connected to this repository

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

**What to build:** a Claude Code session opened in this repository has Binnacle's tools with no per-session setup, and can detect the project, read its status and load its snapshot. The server is a thin stdio proxy to the running daemon, built on the official SDK (ADR-0021), and it degrades to a clear error when the daemon is down. Decided in the spec, under *MCP server* and *Registration in this repository*.

- [x] `packages/mcp` holds the server, its tool definitions and their mapping onto daemon operations, and is the only package depending on `@modelcontextprotocol/sdk`.
- [x] `binn mcp` starts the server on stdio, finds the daemon through the runtime file, authenticates with the token as the CLI does, and opens no database.
- [x] It passes its own working directory as the path for detect and status.
- [x] Tools `project_detect`, `project_status` and `project_snapshot` map one-to-one onto `project.detect`, `project.status` and `project.snapshot`. No other operation is exposed.
- [x] Results are compact JSON in the tool's text content; failures carry the daemon's error envelope and codes unchanged.
- [x] With the daemon stopped, the server completes the handshake and lists its tools, and each call returns a tool error with the daemon-unreachable code and the `binn daemon start` command. It never starts the daemon.
- [x] A project-scoped `.mcp.json` committed to this repository declares one stdio server, `binnacle`, running `binn mcp`.
- [x] README.md and README.ru.md explain linking `binn` onto PATH with `pnpm link --global` and why `.mcp.json` does not use a path inside the working tree.
- [x] One smoke test drives the real `binn mcp` through the SDK's client over stdio: it lists the tools, calls `project_snapshot` against a test daemon, and makes one call with the daemon stopped.
- [ ] Verified by hand once: a fresh Claude Code session in this repository shows the `binnacle` server connected and gets a snapshot.

## Comments

- **What exists.** `packages/mcp` exports `serveStdio(version, cwd, call)`: the three tools, each calling its daemon operation with `{ path: cwd }` and no arguments of its own. Reaching the daemon is the caller's job, through the `CallDaemon` function it passes in, which answers `{ result }` or the daemon's error envelope and never throws. `apps/cli/src/mcp.ts` supplies it from the CLI's own `callOperation` and `requireToken`, so the server reads the runtime file and the token exactly as the CLI does, on every call. A daemon started after the harness connected is therefore found without restarting the session.
- **Adding a tool** (tickets 05 and 06) is one entry in `TOOLS` in `packages/mcp/src/index.ts`, plus one name in the smoke test's tool list. Nothing in the CLI changes.
- **A code not named in the spec.** `daemon.unreachable`: no daemon is running (no runtime file, or its pid is gone), or the one the runtime file names did not answer. The daemon cannot emit it, so the CLI's proxy does. Its message always ends with `binn daemon start`. Every other failure is the daemon's envelope unchanged, `auth.missing` included when the token file is absent.
- **Where the smoke test lives.** `packages/mcp/test/smoke.test.ts`, because the SDK's client is only resolvable from the one package that depends on the SDK (ADR-0021). It spawns `apps/cli/src/bin.ts mcp` by path. It connects with no daemon running, lists the tools and gets `daemon.unreachable`, then starts a test daemon on the same home and gets a snapshot through the same session.
- **`tsconfig.json`** now typechecks `packages/*/test`, which it silently skipped before; the existing core and adapters tests pass it unchanged.
- **Still to do by hand**, and the one box left unticked: link `binn` from the main checkout (`cd apps/cli && pnpm link --global`, after `pnpm setup` if pnpm has no global bin directory), start the daemon, open a fresh Claude Code session in this repository, and check that `binnacle` shows as connected and `project_snapshot` answers. The linked shim and the stdio handshake were checked from an isolated `PNPM_HOME`; a real session was not.

### Review

`/code-review` ran against `main` on both axes.

**Standards: no hard violations.** Judgement calls:

1. `mcp.ts` repeats the "is the daemon running" check and the start-command wording of `callAndReport` in `project-commands.ts`. **Left**: the two report to different places (a tool result, stderr with an exit code), and sharing the check would be a helper for two lines.
2. `mcp.ts` rebuilds the envelope from `OperationFailedError`'s fields, as `OperationError.toEnvelope()` does in the daemon. **Left**: one line, and the classes live on opposite sides of the API.
3. The smoke test drives the CLI from `packages/mcp`. **Kept**: see *Where the smoke test lives* above.
4. `@binnacle/daemon` was a dev dependency of `packages/mcp` although the public `CallDaemon` type uses its `ErrorEnvelope`. **Fixed**: it is a runtime dependency.

**Spec: every acceptance criterion an implementer can meet is implemented.** Findings:

1. `daemon.unreachable` is not a daemon code, though the spec says failures reuse the daemon's codes. **Kept, and written down above**: the daemon cannot report its own absence, and the spec asks for "the daemon-unreachable code".
2. The unreachable call is made before any daemon has run, not after one stopped. **Kept**: a clean stop removes the runtime file, which is the same state; a stale pid and a dead port go through `isAlive` and `DaemonUnreachableError`, the checks `binn project` commands already rely on, and are not tested separately here.
3. Finding a daemon started after the server connected, the extra README guidance (`pnpm setup`, link from the main checkout) and `binn mcp` in the help text go beyond the ticket. **Kept**: each follows from the spec's own reasoning and costs a line.
4. Turning errors into envelopes sits in the CLI, not in `packages/mcp`. **Kept**: it reuses the CLI's client, which is what "exactly as the CLI does" asks for.
