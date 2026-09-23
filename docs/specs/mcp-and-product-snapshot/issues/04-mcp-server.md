# 04: The MCP server, connected to this repository

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

**What to build:** a Claude Code session opened in this repository has Binnacle's tools with no per-session setup, and can detect the project, read its status and load its snapshot. The server is a thin stdio proxy to the running daemon, built on the official SDK (ADR-0021), and it degrades to a clear error when the daemon is down. Decided in the spec, under *MCP server* and *Registration in this repository*.

- [ ] `packages/mcp` holds the server, its tool definitions and their mapping onto daemon operations, and is the only package depending on `@modelcontextprotocol/sdk`.
- [ ] `binn mcp` starts the server on stdio, finds the daemon through the runtime file, authenticates with the token as the CLI does, and opens no database.
- [ ] It passes its own working directory as the path for detect and status.
- [ ] Tools `project_detect`, `project_status` and `project_snapshot` map one-to-one onto `project.detect`, `project.status` and `project.snapshot`. No other operation is exposed.
- [ ] Results are compact JSON in the tool's text content; failures carry the daemon's error envelope and codes unchanged.
- [ ] With the daemon stopped, the server completes the handshake and lists its tools, and each call returns a tool error with the daemon-unreachable code and the `binn daemon start` command. It never starts the daemon.
- [ ] A project-scoped `.mcp.json` committed to this repository declares one stdio server, `binnacle`, running `binn mcp`.
- [ ] README.md and README.ru.md explain linking `binn` onto PATH with `pnpm link --global` and why `.mcp.json` does not use a path inside the working tree.
- [ ] One smoke test drives the real `binn mcp` through the SDK's client over stdio: it lists the tools, calls `project_snapshot` against a test daemon, and makes one call with the daemon stopped.
- [ ] Verified by hand once: a fresh Claude Code session in this repository shows the `binnacle` server connected and gets a snapshot.

## Comments
