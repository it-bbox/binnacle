# 06: The audit reads Serena, Graphify and Context7, and telemetry readiness

Status: DONE
Triage: ready-for-agent
Blocked by: 03
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** the last two areas of `binn audit`. Serena, Graphify and Context7: whether each looks configured, from configuration files only, in the repository (`.binnacle/project.yaml`'s `capabilities`, which is the repository's own declaration, `.mcp.json`, `.codex/config.toml`, `.serena/` and the like) and in the user-scope files only where a harness defines one. Nothing found is `unknown`, not `gap`, since the tool may be configured in user settings, and the finding names the files it looked in. Telemetry readiness: whether the session artifacts Binnacle reads, Claude Code's and Codex's, exist on this machine for this repository, by counting sessions without reading their content. A machine with none is `unknown` or an `ok` that says no work has been recorded yet, never a `gap`.

- [x] A fixture with a tool's configuration file gets `ok` for it, and one without any gets `unknown`, naming the files looked in.
- [x] A declared capability in `.binnacle/project.yaml` is taken as the declaration and not re-derived.
- [x] Session artifacts are counted for the repository with no content read, and none found is not a `gap`.
- [x] A test points the harnesses' artifact roots at an empty directory, as the init tests do, so that this machine's own sessions are never shown.

## Comments

### Decisions

- **Where things live.** The two areas are `capabilities()` and `telemetry()` in `apps/cli/src/audit-tools.ts`, added to `audit()`'s one array; the finding type is unchanged. The session-history reader that was inside `init.ts` moved to `apps/cli/src/history.ts`, so that init and the audit count sessions with one piece of code and the daemon's own location logic (`claudeCodeSessions`, `codexSessions`, `resolveArtifactRoots`).
- **Check codes.** `capabilities.serena`, `capabilities.graphify`, `capabilities.context7`; `telemetry.claude_code`, `telemetry.codex`. The test that checks a code's shape now allows digits.
- **Order of reading, per tool.** First `.binnacle/project.yaml`'s `capabilities` (a valid manifest only): a declared tool is `ok` whatever it says (`true` installed, `"optional"` optional, `false` not used) and no file is read. Then the repository's files (`.serena/project.yml` for Serena; an MCP server of that exact name, case aside, in `.mcp.json`, `.codex/config.toml`, `opencode.json`, `opencode.jsonc`), then the user-scope files of the two harnesses that define one: Claude Code's `.claude.json` (under `CLAUDE_CONFIG_DIR`, else `~`) and Codex's `config.toml` (under `CODEX_HOME`, else `~/.codex`). Nothing found is `unknown`, and its reason lists every file looked in, user paths written with `~`.
- **Declared `false` and `optional` are `ok`.** The spec says a declared capability is `ok` and not re-derived; the reason says what was declared. A malformed or absent manifest declares nothing, and the files are read.
- **Telemetry.** One finding per harness, from the init reader: sessions whose `cwd` is this repository or a linked worktree of it. None is `unknown` ("no work has been recorded yet, or the harness keeps its sessions elsewhere"), never a `gap`, naming the root looked in and the variable that moves it. The reader looks at each file's first lines only for where and when a session started and keeps no content; subagent sessions are not counted separately.
- **Tests** point `CLAUDE_CONFIG_DIR`, `CODEX_HOME` and `HOME` at temporary directories (the shared `audit()` helper does it by default), so this machine's own sessions and settings are never shown.
- **Not done.** opencode's user-scope file and Graphify's own output directory are not read: nothing in the spec defines them as configuration.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.**

1. **Substring name matching (`serena-fork` counted as Serena); opencode's keys read from the whole text.** **Fixed**: exact name, and opencode keys are read only after `"mcp"`; a test covers look-alike names.
2. **The harness's environment variable was chosen by a ternary on its display name.** **Fixed**: it sits beside the code and root in the one lookup.
3. **`sources()` resolves `CLAUDE_CONFIG_DIR` and `CODEX_HOME` beside `resolveArtifactRoots()`.** **Left**: the daemon exposes the session roots, not the configuration directories; widening its API for two lines was not worth it.
4. **The telemetry lookup is keyed by the harness's display name.** **Kept**: two entries, one reader.
5. **`registeredIn`'s `base: string | null`.** **Kept**: one call site each way.

**Spec:**

1. **Counting reads up to 100 lines of each session file to find its `cwd`.** **Kept**: that is the readers' own location logic the ticket asks to reuse; only `cwd` and the start time are taken, nothing is kept or shown (a test checks a prompt is not in the output).
2. **Declared `false` and `optional` are `ok`.** **Kept**: see Decisions.
3. **opencode's user-scope file, `.serena/` beyond `project.yml`, Graphify files.** **Left**: no harness-defined file in the spec.
