# Existing Project Adoption

_Русская версия: [02-existing-project-adopt.ru.md](02-existing-project-adopt.ru.md)._

Adopting restructures nothing. Binnacle first reads the conventions, docs and tracker already there, then adds only what is missing, and moves or rewrites nothing without your yes. There is no automatic large-scale rewrite.

## The short path

1. `binn audit` — read-only findings; it writes nothing.
2. `binn init` — the same one plan as for a new project, confirmed once.
3. `/binnacle:roadmap` — epics proposed from the code, the history and the docs.
4. `/binnacle:product` — the first Product session.

There is no `binn adopt`: the audit reads, `binn init` writes, and the roadmap skill plans.

## 1. Audit

`binn audit [path]` reads the Git repository containing the path, the working directory by default, and prints findings, as text or with `--json`. It writes nothing, needs no daemon or registration, makes no network call and runs nothing but Git. Gaps never fail it: it exits non-zero only when it could not run.

In Claude Code, `/binnacle:audit [path]` runs it from the chat and shows the gaps first, then what it cannot tell. The rules are in its spec, `docs/specs/audit-and-adopt/spec.md`.

Each finding has a code, an area, a status — `ok`, `gap` or `unknown` — and a reason; a gap or an unknown also has a recommendation. There is no overall score. The areas, in the order it prints them:

| Area | What it reads |
| --- | --- |
| `git-and-tracker` | the repository and its branch; `.binnacle/project.yaml`; the tracker the remote names, and whether a token for it exists |
| `docs` | `CONTEXT.md`, `docs/adr`, `docs/`; the roadmap and whether it is in Binnacle's format; the stranded documents |
| `matt-pocock-layout` | the planning conventions under `docs/agents/`, the spec directories, and the ticket-header section |
| `scratch` | whether Git ignores `.scratch`, and any spec or ticket whose only copy is there |
| `capabilities` | whether Serena, Graphify and Context7 look configured; Binnacle's skills at another version than `binn` |
| `instructions` | `AGENTS.md` and `CLAUDE.md`, and whether they make one instruction set |
| `structure` | a test setup, a CI configuration, and the project's shape |
| `telemetry` | Claude Code and Codex sessions for this repository; whether each detected harness exports OpenTelemetry to Binnacle |
| `docker` | each tracked `Dockerfile`, `Containerfile` or compose file, and whether the `.dockerignore` beside it excludes `.env` and `.git`; a project with none has no container setup, which is not a gap |

Whether a tracker token works is known only from the network, so the audit leaves it unknown; `binn init` reads the tracker once and says. Each missing Binnacle file, such as the manifest, the roadmap or a convention file, comes with the recommendation to run `binn init`.

A stranded document is a tracked plan, spec, decision, TODO, notes, backlog, design, RFC, PRD, roadmap or ADR outside Binnacle's places. The audit only lists them, as `docs.stranded`; `/binnacle:roadmap` proposes where each goes.

## 2. Set up with `binn init`

`binn init` shows one plan and asks once, as for a [new project](01-new-project.md#2-set-it-up-with-binn-init); from the chat, `/binnacle:init` does the same (*[From the chat](01-new-project.md#from-the-chat)*). On an existing project it adds only what is missing:

- A valid manifest is left as it is. One with problems is named and left for you to fix, and the project is not registered until it is.
- An existing roadmap is never rewritten. One not in Binnacle's format is named in the Summary, and `binn audit` says what it lacks.
- An existing `docs/agents/issue-tracker.md` only gets its missing ticket-header section. An *Agent skills* block already in `AGENTS.md` or `CLAUDE.md` is left alone.
- An existing JSON file is never rewritten: the entry to add is printed instead.
- A tool already on `PATH`, or declared `false` under `capabilities`, is left alone.

## The plan, item by item

What the plan can hold, in its order. Most items are there only when something is missing; the registration, while the daemon runs, and the three skill sets of item 5 are planned on every run. Each write outside the repository says so in its heading.

1. **The manifest**, for a repository without one: the project's id, the tracker from the remote (GitHub, GitLab, or local tickets under `docs/specs`), the knowledge paths, the workflow, the tools found or to install under `capabilities`, and the import window.
2. **The registration** with the running daemon. With the daemon stopped, init names `binn daemon start` and `binn project register` instead.
3. **The `binnacle` MCP server**, in the project file of each detected harness: `.mcp.json` for Claude Code, `.codex/config.toml` for Codex, `opencode.json` for opencode, `.vscode/mcp.json` for VS Code. A file that already names `binnacle` is left alone.
4. **The `binnacle` plugin**, into Claude Code at user scope, from this Binnacle package, unless Claude Code lists it or the project provides its own.
5. **Binnacle's skills, Matt Pocock Skills and Ponytail**, into every harness the `skills` CLI detects, at user scope, through `npx skills`, when a harness is detected. Each set is then removed from Claude Code, which has it as a plugin, and from each `--skip-harness <id>`. Without `npx`, the commands are printed.
6. **The planning conventions** the planning skills read, so that no setup skill runs first: `docs/agents/issue-tracker.md` for the detected tracker, with the ticket header, the Epic brief and the contested points; `triage-labels.md`; `domain.md`. Then the *Agent skills* block that points to them, in `AGENTS.md`, or in `CLAUDE.md` when only it exists.
7. **The layout**: the issues directory the local tracker reads, and a `<knowledge.docs>/roadmap.md` skeleton in Binnacle's format, whose Next action is `/binnacle:roadmap`.
8. **The tools**: Matt Pocock Skills and Ponytail as Claude Code plugins at user scope, unless Claude Code lists them; Serena and Graphify through `uv tool install`; ast-grep through npm. Without `uv`, init names the command that installs it, and leaves Serena and Graphify out; without npm, Context7 and ast-grep.
9. **The tools' MCP servers**: Serena, Context7 and Graphify, registered with each detected harness through its own CLI, never in the repository. Graphify serves one project, so it goes into Claude Code's local scope, and its entry is printed for the others.
10. **The OpenTelemetry export** of Claude Code, Codex and Gemini CLI, pointed at the daemon's address in their user settings (below).
11. **`graphify-out/` in `.gitignore`**, with Graphify found or installed, unless Git already ignores it.
12. **The Obsidian vault** the daemon projects the Project Brain into, in `~/.binnacle/settings.json`, when Obsidian lists exactly one vault and none is set. With none or several, init names those it found and says how to set the path.
13. **Graphify's first graph** and its report, code-only, with no API key and no model: `graphify extract . --code-only --allow-dedup-shrink`, then `graphify cluster-only . --no-label`. A failure is reported in the Summary, and the daemon builds them later.
14. **Autostart**, after a yes to its question: `binn daemon autostart on`.

### MCP servers already registered

A server already registered with a harness, in any scope the audit reads, is left as it is. The exception is Serena in Codex's user file with Claude Code's context: the plan registers it again with Codex's. Where a harness has no command for adding a server, as opencode has none, or its CLI is not on `PATH`, init prints the entry to add yourself.

### The OpenTelemetry export

The export is JSON over HTTP, with prompt logging off, in each harness's user-scope settings:

| Harness | Where |
| --- | --- |
| Claude Code | `env` in its settings |
| Codex | the `[otel]` table in `~/.codex/config.toml` |
| Gemini CLI | the `telemetry` block in `~/.gemini/settings.json` |

An export already configured, to Binnacle or elsewhere, is left as it is and named. A detected harness that cannot export, such as opencode, is named in the Summary with its reason. `binn audit` reports, for each detected harness, whether it exports to Binnacle.

## 3. The roadmap from the code

Run `/binnacle:roadmap`. It needs no daemon, and takes the existing-project entry when Git tracks source code or holds commits beyond `binn init`'s; `/binnacle:roadmap existing` takes it anyway.

1. It reads the README, the instruction files, the vision, the docs, the specs with their tickets' `Status:` lines, `git log` and the code, and `binn audit --json` once.
2. It proposes the epics in dependency order, each `done`, `in progress` or `not started`, with what shows it and one line of scope. An epic an existing spec describes links it, and takes its status from that spec's tickets.
3. For each stranded document, it proposes one place: a spec, an ADR, `CONTEXT.md`, the product inbox, the roadmap, or stale. A stale one stays where it is unless you say to delete it.
4. A roadmap not in Binnacle's format is proposed rewritten into it, keeping its content.
5. It shows every change and the commit, and waits. On your yes, it writes and moves, checks that the audit's `docs.roadmap` is `ok`, and commits only what it wrote. It never pushes.

The Next action it writes grills the first epic not done. Run again, it proposes additions and reorders among the epics not started, never changes a `done` epic, and never removes a row that links a spec. Then `/binnacle:product` starts the first Product session.

## Historical telemetry

The import window `binn init` asks for is how much of the harnesses' session history the daemon imports, `telemetry.import.window_days` in the manifest. A session that cannot be attributed to a Task exactly is kept as the project's, unassigned, never guessed.
