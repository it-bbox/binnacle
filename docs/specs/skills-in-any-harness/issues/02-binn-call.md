# 02: binn call, and the skills fall back to it

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** `binn call <tool> [json]` calls one of the daemon's MCP tools for the working directory and prints what the tool returns, so a harness with a shell and no Binnacle MCP server runs every skill (spec, *Binnacle without MCP*). It uses the same tool table and daemon call as `binn mcp`: the result as JSON on stdout with exit 0; the daemon's error envelope as JSON on stdout with a non-zero exit, `daemon.unreachable` with the exit code `binn` already uses for a stopped daemon; an unknown tool or arguments that are not JSON, a message on stderr with the usage exit code. `binn call --help` lists the tools and their arguments. Each skill that calls a tool — product, daily, task, status, checkpoint, autopilot — says once: call the `binnacle` MCP tool, and if this session has none, run `binn call` with the same arguments in the shell and read its JSON. `docs/03-mcp-and-skills.md` describes `binn call`.

- [x] A test starts a daemon and checks that `binn call project_snapshot` and `binn call task_get '{"id":…}'` print what the same tools return through `binn mcp`.
- [x] With the daemon stopped, `binn call` prints `daemon.unreachable` and exits with the stopped-daemon code; an unknown tool and invalid JSON exit non-zero with a message.
- [x] `binn --help` lists `binn call`, and `binn call --help` lists every tool.
- [x] The six skills carry the fallback; a wording test holds it.

## Comments

Decisions taken while implementing, within the spec:

- **One function for both paths.** `@binnacle/mcp` exports `toolRequest(name, args, cwd)`, which both the MCP server and `binn call` go through: it finds the tool's operation in the one tool table and builds its body as the server does — a tool with no schema takes no arguments, one with a schema keeps only the fields the schema names, and `path` is always the working directory. `binn mcp` and `binn call` share the daemon call in `apps/cli/src/mcp.ts`. A tool therefore exists in both or in neither, and the two send the daemon the same request.
- **Arguments the tool's schema refuses** are a usage error, as unknown tools and invalid JSON are: a message on stderr naming what the schema refused, and exit 2. The spec names only the unknown tool and invalid JSON. The MCP server refuses these arguments before calling the daemon too, so `binn call` does the same, rather than sending the daemon what the tool would not.
- **Exit codes**: 0 with the result; 3 with any daemon error envelope on stdout, `binn`'s operation-failed code; 4 with `daemon.unreachable`. `binn call --help` lists the tools from the same table, each with its description and its arguments, and says which arguments are optional.
- **The fallback sentence** sits in the first step of each of the six skills, beside the first tool call. Their old line about a missing or disconnected server became the shell's `command not found`, the way `binn` turns out to be missing once the fallback runs. `/binnacle:status`'s rule against shell commands now allows `binn call project_status`.
- **The test** is in the MCP smoke test (`packages/mcp/test/smoke.test.ts`), which already starts a daemon and connects a real `binn mcp`. `binn call`'s output is compared there with the same tools' output, character for character. Only `@binnacle/mcp` has the MCP SDK's client as a dependency.

### Review

Code review against `main`, both axes.

Standards:
- Fixed: `binn call` built the daemon body itself and passed any JSON object through, while the server checked arguments against the schema and gave a tool with no schema none (Duplicated Code, and a divergence between the two paths). Both now go through `toolRequest`.
- Fixed: the wording test repeated the six skills' names; they are one constant now.
- Kept: the fallback sentence appears word for word in six skills, as the neighbouring fix lines do; the wording test requires it exactly once in each.

Spec:
- Fixed: arguments the schema refuses, and arguments to a tool that takes none, were handled differently from `binn mcp` (story 24, "the same JSON the MCP tool returns"). Fixed with the Standards finding above.
- Kept: the missing-server line in the six skills became `command not found`, and `/binnacle:status` allows `binn call project_status`. The ticket does not name these changes, but the fallback needs them.
- Kept: the test also covers a daemon error envelope, from `daily_get` with a bad `since`, with exit 3.
- Left: the ticket's `Status:` and criteria, which the reviewer saw unset; this commit sets them.
