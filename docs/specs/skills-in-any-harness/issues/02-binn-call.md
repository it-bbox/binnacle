# 02: binn call, and the skills fall back to it

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** `binn call <tool> [json]` calls one of the daemon's MCP tools for the working directory and prints what the tool returns, so a harness with a shell and no Binnacle MCP server runs every skill (spec, *Binnacle without MCP*). It uses the same tool table and daemon call as `binn mcp`: the result as JSON on stdout with exit 0; the daemon's error envelope as JSON on stdout with a non-zero exit, `daemon.unreachable` with the exit code `binn` already uses for a stopped daemon; an unknown tool or arguments that are not JSON, a message on stderr with the usage exit code. `binn call --help` lists the tools and their arguments. Each skill that calls a tool — product, daily, task, status, checkpoint, autopilot — says once: call the `binnacle` MCP tool, and if this session has none, run `binn call` with the same arguments in the shell and read its JSON. `docs/03-mcp-and-skills.md` describes `binn call`.

- [ ] A test starts a daemon and checks that `binn call project_snapshot` and `binn call task_get '{"id":…}'` print what the same tools return through `binn mcp`.
- [ ] With the daemon stopped, `binn call` prints `daemon.unreachable` and exits with the stopped-daemon code; an unknown tool and invalid JSON exit non-zero with a message.
- [ ] `binn --help` lists `binn call`, and `binn call --help` lists every tool.
- [ ] The six skills carry the fallback; a wording test holds it.
