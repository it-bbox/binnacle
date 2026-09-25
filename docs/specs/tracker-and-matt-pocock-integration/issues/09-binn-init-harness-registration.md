# 09: `binn init` — MCP registration per harness

Status: DONE
Triage: ready-for-agent
Blocked by: 08
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** `binn init` detects the harnesses on the machine and, for each one it knows, proposes the `binnacle` MCP server in that harness's project-scoped configuration; for any other it prints a generic stdio snippet. Supporting a new harness is adding a template. Decided in the spec, under *`binn init`*, step 3.

- [x] A harness is detected by its executable on PATH or its user configuration directory.
- [x] One template each, all declaring a stdio server named `binnacle` that runs `binn mcp`: Claude Code's `.mcp.json`, Codex's `.codex/config.toml`, opencode's project configuration, VS Code's `.vscode/mcp.json`. The exact shape of each is checked against the harness's current documentation (Context7) and noted in this ticket's comments.
- [x] A missing file is created; an existing TOML file gets the table appended; an existing JSON file is left untouched and the entry is printed.
- [x] A configuration that already names `binnacle` is skipped and reported.
- [x] The Codex step says that Codex reads a project's configuration only in a trusted project.
- [x] A generic stdio snippet is printed after the known harnesses.
- [x] Subprocess tests with fake harness directories: a new `.mcp.json`, an existing `.mcp.json` untouched with the entry printed, a Codex TOML appended, an existing `binnacle` entry skipped, only detected harnesses offered.

## Comments

- **What changed.** Step 3 is `harnessStep` in `apps/cli/src/init.ts`, run after registration and before ticket 10's plugin step. Each known harness is one entry in `HARNESSES`: its name, its executable, its user configuration directory, its project configuration file and the entry. Supporting another harness is adding one entry. A detected harness is told which file it reads. A file that already names `binnacle` is skipped and listed as `skipped`. Otherwise the entry goes through `offerFile`, so the writing rules stay in one place. The generic snippet follows the known harnesses, whether or not any was detected. `offerFile` and `Session` are no longer exported. The subprocess tests now reach the append and JSON branches, so the in-process writing-rules test is gone, as ticket 08 asked.
- **Detection.** An executable is found by walking `PATH`, taking `PATHEXT` into account on Windows. The user configuration directories are:
  - `~/.claude` for Claude Code;
  - `~/.codex` for Codex;
  - `$XDG_CONFIG_HOME/opencode` for opencode, with `~/.config` as the default;
  - `$XDG_CONFIG_HOME/Code` for VS Code on Linux, `~/Library/Application Support/Code` on macOS and `%USERPROFILE%\AppData\Roaming\Code` on Windows.
- **The templates, as checked in Context7 on 2026-09-25.**
  - **Claude Code** (`/websites/code_claude`, *MCP installation scopes → Project scope*): a project-scoped server lives in `.mcp.json` at the project root, `{"mcpServers": {"binnacle": {"type": "stdio", "command": "binn", "args": ["mcp"]}}}`. It is the same shape this repository commits.
  - **Codex** (`/openai/codex`, `codex-rs/config`): a `[mcp_servers.binnacle]` table with `command = "binn"` and `args = ["mcp"]`. `.codex/config.toml` at the Git root, and in the directories above the working directory, is "loaded but disabled when untrusted". The step says so.
  - **opencode** (`/websites/opencode_ai`, *Config → Locations → Per project*, and *MCP servers → Local*):
    - The project configuration is `opencode.json` at the project root. `opencode.jsonc` is used when it already exists.
    - The server entry is `{"$schema": "https://opencode.ai/config.json", "mcp": {"binnacle": {"type": "local", "command": ["binn", "mcp"]}}}`. `command` is one array holding the executable and its arguments.
    - The global configuration lives under `~/.config/opencode`.
  - **VS Code** (`/microsoft/vscode-docs`, *MCP configuration reference*): the workspace file is `.vscode/mcp.json`, `{"servers": {"binnacle": {"type": "stdio", "command": "binn", "args": ["mcp"]}}}`.
  - **The generic snippet** is the Claude Code shape, `mcpServers` with the stdio entry, which most MCP clients read.
- **Merged with ticket 10**, which landed first. This branch was rebased onto it.
  - The steps run in the spec's order: manifest, registration, harnesses, plugin.
  - `pluginStep` now detects Claude Code with the harness detector, so its `ponytail:` note is gone.
  - As ticket 10 asked, a Claude Code found only by `~/.claude`, with no `claude` on PATH, skips the plugin and says why. A test covers that case.
  - The tests share one `makeHome`, whose `bin` is the whole `PATH`. Claude Code is installed there with ticket 10's recording `fakeClaude`, and other harnesses with `installExecutable`.
  - A fake `claude` now also makes the harness step offer `.mcp.json`, so the plugin tests answer that question first.
  - `XDG_CONFIG_HOME` points into the temporary home.
- **Questions answered in the smallest way the spec allows.**
  - *What counts as "already names `binnacle`"?* This is a textual check, not a parse, and it is marked `ponytail:`:
    - in JSON, a `"binnacle":` key anywhere;
    - in TOML, a `[mcp_servers.binnacle]` table, or a `binnacle` or `mcp_servers.binnacle` key at the start of a line.
    
    It errs towards a skip. Missing an entry would make the append a duplicate key, which Codex rejects, while a skip writes nothing and is reported.
  - *Which opencode file?* `opencode.jsonc` when only that exists, `opencode.json` otherwise. The JSON rule now covers `.jsonc`, so a JSONC file is never appended to.
  - *Does an existing JSON file get the whole file printed, or only the entry?* The whole template, which is exactly `offerFile`'s text, so it shows where the entry goes.
  - *Is the Codex trust note given when the step is skipped?* No. It is given with the offer.
  - *Which output shows no harness?* When none is detected, init says `No known harness is installed`, lists the four it knows, and still prints the generic snippet.
  - *Is the generic snippet listed in the summary?* No. The summary lists files, commands and declined steps, and the snippet is none of those.

### Review

`/code-review` ran against `main` on both axes.

**Standards: no hard violations, and eight judgement calls.**

1. A regex kept `["mcp"]` on one line in the printed JSON: clever for a cosmetic gain. **Fixed**: it is plain `JSON.stringify`.
2. The generic snippet repeated the Claude Code entry. **Fixed**: `STDIO_SERVER` is shared by Claude Code, VS Code and the snippet.
3. `how` held the detection reason. **Fixed**: it is `reason`.
4. `files: string[]` serves only opencode. **Kept**: it stops init from creating `opencode.json` beside an existing `opencode.jsonc`.
5. Blank lines were written two different ways. **Fixed**.
6. The test `PATH` is `home.bin` alone, not a fake `claude` first on the real `PATH` as Seam 3 describes. **Kept**: a harness installed on the test machine would otherwise be detected.
7. The fake executables and the `git` link are POSIX-only. **Left**: the CLI tests already assume POSIX.
8. The `read` helper sat between tests. **Fixed**: it sits with the other helpers.

**Spec: every criterion is met, and nothing out of scope was added.**

1. The Context7 check was not recorded in this ticket. **Fixed** above.
2. Closed stdin was never tested with a harness detected. **Fixed**: that test now detects Claude Code and Codex, and asserts that `.mcp.json` is not created and the TOML is not extended.
3. Nothing checked that an existing JSON file is never asked about. **Fixed**: the test asserts that no question names it.
4. Platform branches for `PATHEXT` and VS Code's directory. **Kept**: ADR-0016 supports Linux, macOS and Windows natively.
5. The custom JSON formatter. **Fixed**, as Standards 1.
6. The "No known harness" message. **Kept**: it says why nothing was offered.
7. A Codex file declaring `binnacle` as a key under `[mcp_servers]` was not recognised, so the append would have duplicated the key. **Fixed**: the key forms are recognised, and a test covers one.
8. The Codex trust note was given even when the step was skipped. **Fixed**.
9. `XDG_CONFIG_HOME` was ignored. **Fixed**: opencode and VS Code on Linux are looked for under it.
