# 02: `binn init` registers Serena, Context7 and Graphify with every harness

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** each MCP server of the Standard setup registered with every harness init detected, through the harness's own CLI, at user scope (the owner, 2026-10-02), as the `binnacle` plugin already is. Graphify's server serves one project's graph, so it is registered at the harness's per-project scope outside the repository where one exists (Claude Code's local scope), and printed otherwise. A harness with no CLI for adding a server gets the entry printed. A server already registered with a harness, in any scope the audit reads, is reported and left as it is. Init writes no MCP entry for these tools into the repository. The registrations are rows of the tool table from ticket 01, in the same plan, after the installs. Take the exact `mcp add` forms from each harness's current docs through Context7.

- [x] For each detected harness with an `mcp add` CLI, the plan shows the command per missing server, and after a yes the fake harness CLI records it at user scope.
- [x] Graphify's server is registered at Claude Code's local scope, pointing at this project's graph, and printed for a harness without a per-project scope.
- [x] A server already registered is reported and not registered again.
- [x] A harness without such a CLI gets the entry printed, and the Summary says so.
- [x] A tool declared `false`, or left out for a missing prerequisite, gets no registration.
- [x] No file in the repository is created or changed by this step.
- [x] `docs/operations/05-installation-checklist.md` says where init registers the servers.

## Comments

### For the next tickets

- The tool table (`apps/cli/src/tools.ts`) gains `prerequisite` at the tool level (moved out of `install`, which is now the command alone) and a `server` column: the command per harness executable, `project` for a server that serves one project, and the server's own `prerequisite` when it runs through one the tool itself does not need. The harness table (`HARNESSES` in `init.ts`) gains `entry(name, command)`, which also produces the `binnacle` templates, and `add(name, command, scope)`, the harness CLI call or null where it has no such scope. Ticket 03 can add its plugin CLIs the same way.
- The registrations are step 9 of init, one plan item per harness, after the installs; ticket 04's `.gitignore` append and first build go after them.
- The registration reading the audit and init share is `mcpSources`, `registeredIn` and `registeredWith` in `tools.ts`; each file now names its harness. It gained VS Code's `.vscode/mcp.json` and its default profile's `User/mcp.json`, and the `servers` key, so the audit now finds a server registered there too.
- Graphify's server path is the daemon's `GRAPH_DIRECTORY` (ticket 05), now exported from `@binnacle/daemon`.
- Questions answered in the smallest way the spec allows: opencode is printed, since its documented `opencode mcp add` is an interactive wizard (a scripted form appeared in v1.17.0 without a documented scope). VS Code's `code --add-mcp` counts as its `mcp add` CLI, at user scope; VS Code has no per-project scope outside the repository, so Graphify is printed for it, as for Codex. A harness detected by its directory but whose CLI is not on PATH gets the entry printed. Graphify's server runs as `uv run --no-project --with 'graphifyy[mcp]' python -m graphify.serve <root>/graphify-out/graph.json`, so the `[mcp]` extra ticket 01 left open is not added to the install; Graphify's own docs point at the interpreter recorded in `graphify-out/.graphify_python`, which exists only after a first build. Context7 is registered as `npx -y @upstash/context7-mcp`, without an API key, and needs `npm`; a new manifest does not declare `context7`, since init installs nothing for it and the audit finds it by its registration. Serena's context per harness is the one its client docs give: `claude-code`, `codex` and `vscode`, with `--project-from-cwd` except for VS Code, whose documented global form has none; opencode's printed entry has `--project-from-cwd` alone.
- Checked only against fakes: the real harness CLIs. To see them for real, on a machine with `claude` and `codex` and none of these servers registered, in a scratch repository: `BINNACLE_HOME=$(mktemp -d) binn init`, confirm, then `claude mcp list` and `codex mcp list` should list serena and context7, and `claude mcp get graphify` should show local scope with this repository's `graphify-out/graph.json`; `git status` should show only what the other steps wrote. Remove them afterwards with `claude mcp remove <name> -s user` (or `-s local` for graphify) and `codex mcp remove <name>`.

### Review

`/code-review` against `main`, both axes, after rebasing onto `main` (ticket 05 merged meanwhile).

- **Fixed:** Graphify found on PATH but without `uv` was registered with a server that runs through `uv`; a server now has its own prerequisite, and that case is skipped, reported and tested. The printed per-project entry for Codex and VS Code said to add it to "this project's configuration" without saying that is in the repository; it now says so. The XDG config home was computed in both `init.ts` and `tools.ts`; it is `CONFIG_HOME` in `tools.ts` now. The docs' server table said every Serena registration has `--project-from-cwd`, which VS Code's does not. The audit had no test for the VS Code files it now reads; one is added. A second `graphify-out` constant was replaced by the daemon's.
- **Kept:** the non-null assertions on `prerequisite`, `install` and `server` where the tool's state already guarantees them, rather than a type per state. `add` absent for no CLI and `null` for no such scope, documented on the type. The audit reading VS Code's files: the ticket defines "already registered" by what the audit reads, so the reading is shared, not copied. A Graphify registration runs even if its install in the same plan fails, since every item reports its own outcome; the server needs only `uv`.
- **Left:** opencode's user configuration (`~/.config/opencode/opencode.json`) is not read, so an entry already there is printed again; printing changes nothing. The registrations run without a shell, so `code.cmd` on Windows would not start, as for `claude` in the plugin step (marked `ponytail:`). VS Code's non-default profiles keep `mcp.json` elsewhere and are not read (marked `ponytail:`).
