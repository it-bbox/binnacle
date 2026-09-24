# 09: `binn init` — MCP registration per harness

Status: READY
Triage: ready-for-agent
Blocked by: 08
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** `binn init` detects the harnesses on the machine and, for each one it knows, proposes the `binnacle` MCP server in that harness's project-scoped configuration; for any other it prints a generic stdio snippet. Supporting a new harness is adding a template. Decided in the spec, under *`binn init`*, step 3.

- [ ] A harness is detected by its executable on PATH or its user configuration directory.
- [ ] One template each, all declaring a stdio server named `binnacle` that runs `binn mcp`: Claude Code's `.mcp.json`, Codex's `.codex/config.toml`, opencode's project configuration, VS Code's `.vscode/mcp.json`. The exact shape of each is checked against the harness's current documentation (Context7) and noted in this ticket's comments.
- [ ] A missing file is created; an existing TOML file gets the table appended; an existing JSON file is left untouched and the entry is printed.
- [ ] A configuration that already names `binnacle` is skipped and reported.
- [ ] The Codex step says that Codex reads a project's configuration only in a trusted project.
- [ ] A generic stdio snippet is printed after the known harnesses.
- [ ] Subprocess tests with fake harness directories: a new `.mcp.json`, an existing `.mcp.json` untouched with the entry printed, a Codex TOML appended, an existing `binnacle` entry skipped, only detected harnesses offered.
