# Existing Project Adoption

_Русская версия: [02-existing-project-adopt.ru.md](02-existing-project-adopt.ru.md)._

## Goals

Adopt without destructive restructuring. Existing conventions/docs/tracker should be discovered first.

## Commands

The short path, as the README gives it:

```text
binn audit
    ↓
binn init
    ↓
/binnacle:roadmap
    ↓
/binnacle:product
```

There is no `binn adopt`: adopting is the audit, which reads, followed by `binn init`, which writes, and `/binnacle:roadmap` (`binnacle-roadmap` in another harness), which plans. `/binnacle:roadmap` needs no daemon. It reads the code, `git log`, the docs and specs and `binn audit --json`, and proposes the epics as `done`, `in progress` or `not started` with their specs linked; a destination for each stranded document — a spec, an ADR, `CONTEXT.md`, the product inbox, the roadmap, or stale — moved only on the owner's yes, a stale one left in place unless the owner says delete; and a roadmap not in Binnacle's format rewritten into it, keeping its content. On the owner's yes it writes the rows, a `## Epics` section with each epic's line of scope and a Next action that grills the first epic not done, and commits only what it wrote, never pushing. Run again, it proposes additions and reorders among the epics not started, and never touches a `done` epic or a row that links a spec. Then `/binnacle:product` starts the first Product session.

`binn init` should:

- register repository;
- detect remote and tracker;
- detect languages/package manager;
- detect Matt Pocock layout/config;
- inspect `.scratch` usage;
- detect Serena/Graphify/Context7 where possible;
- configure telemetry adapters when supported;
- create only minimal Binnacle manifest/config after one confirmation of the plan `binn init` shows (ADR-0034), at a terminal or, through `binn init --apply <id>`, as the human's yes in the chat (ADR-0037).

Setup from the chat is in [New project](01-new-project.md#from-the-chat), *From the chat*.

## What `binn audit` and `binn init` do

`binn audit` also lists, read-only, the plans, notes and TODO files it finds outside Binnacle's places. `/binnacle:roadmap` reads the code, the history, the docs and the audit's findings, proposes the epics as `done`, `in progress` or `not started` with their specs linked, a place for each of those documents, and a roadmap not in Binnacle's format rewritten into it, keeping its content. It moves and writes nothing without your yes.

`binn audit [path]` reads the repository and prints findings, as text or with `--json`. It writes nothing and needs no daemon. In Claude Code, `/binnacle:audit [path]` runs it from the chat and shows the findings there, gaps first. `binn init` is the command that writes into the repository: it shows one plan and asks once. Where they are missing, the plan creates the issues directory the local tracker reads and a `<knowledge.docs>/roadmap.md` skeleton in Binnacle's format, whose Next action is `/binnacle:roadmap`, and a new manifest declares `knowledge.docs`; an existing roadmap is never rewritten, and one not in the format is named in the Summary and explained by `binn audit`. It also writes the conventions the planning skills read, so that no setup skill runs first: `docs/agents/issue-tracker.md` for the tracker it detected, with the ticket header, the Epic brief and the contested points, `triage-labels.md` and `domain.md`, and the *Agent skills* block that points to them, in `AGENTS.md`, or in `CLAUDE.md` when only it exists; a file that exists only gets a missing ticket-header section, and a block already there is left alone. The plan also installs what is missing of Serena and Graphify (through `uv tool install`) and ast-grep (through npm), outside the repository; a tool already on `PATH`, or declared `false` under `capabilities`, is left alone, and without `uv` init names the command that installs it and leaves Serena and Graphify out. It then registers the MCP servers of Serena, Context7 and Graphify with each harness it detects, through the harness's own CLI and never in the repository, leaving one already registered as it is, except Serena in Codex's user file with Claude Code's context, which it offers to register again with Codex's, and printing the entry where a harness has no such command. For Claude Code, Codex and Gemini CLI, when detected, the plan points their OpenTelemetry export at the daemon's address in their user-scope settings — Claude Code's settings `env`, Codex's `[otel]` table in `~/.codex/config.toml`, Gemini CLI's `telemetry` block in `~/.gemini/settings.json` — as JSON over HTTP, with prompt logging off; an export already configured, to Binnacle or elsewhere, is left as it is and named, and a detected harness that cannot export, such as opencode, is named in the Summary with its reason. `binn audit` reports, per detected harness, whether it exports to Binnacle. With Claude Code detected, it installs the Matt Pocock Skills and Ponytail plugins through Claude Code's plugin CLI at user scope, unless Claude Code already lists them; with any harness detected, it installs both into every other harness the `skills` CLI detects, from their repositories, as it installs Binnacle's own skills, unless the manifest declares one `false`. When Obsidian lists exactly one vault on this machine and `~/.binnacle/settings.json` names none, the plan sets it there, outside the repository, as the vault the daemon projects the Project Brain into; with none or several, init names those it found and says how to set the path. Last, with Graphify found or installed, it adds `graphify-out/` to `.gitignore` unless Git already ignores it, and builds the first graph with `graphify extract . --code-only --allow-dedup-shrink`, which lets the graph shrink when Graphify's deduplication merges nodes, then its report with `graphify cluster-only . --no-label`, neither of which needs an API key or calls a model; a failed build or report is reported in the Summary, and the daemon builds it later.

## Audit

`binn audit [path]` (`specs/audit-and-adopt/spec.md`) needs no registration or daemon, and recommends `binn init` for each Binnacle file that is missing.

Audit is read-only by default and reports findings grouped by severity/type rather than an arbitrary single health score.

Initial audit areas:

- Git state/branch conventions;
- tracker presence/config;
- docs/ADR/CONTEXT coverage and duplication;
- durable knowledge stranded in `.scratch`;
- Serena memory duplication risks;
- Graphify readiness/ignore rules;
- tests/typecheck/lint presence;
- CI visibility;
- secrets/basic security hygiene;
- telemetry readiness;
- project structure.

## Output

Audit should produce a migration plan, e.g.:

1. Git/tracker safety;
2. knowledge normalization: the audit's list of stranded documents (`docs.stranded`), and `/binnacle:roadmap`'s proposal of a place for each;
3. context tooling;
4. telemetry;
5. snapshot/product workflow;
6. optional worktree parallelism.

No automatic large-scale rewrite.

## Historical telemetry

Historical sessions may be imported where supported. If exact task attribution cannot be established, preserve them as project-level/unassigned rather than guessing.
