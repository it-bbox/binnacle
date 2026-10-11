# Binnacle

_Русская версия: [README.ru.md](README.ru.md)._

**One project memory. Any coding agent.**
**Claude today. Codex tomorrow. Your project never starts from zero.**

**Binnacle** is a local, provider-agnostic **AI Engineering Control Plane**: persistent project context, workflow and observability across Claude Code, Codex, Gemini, GLM and other coding agents. It keeps project state **outside chat sessions**, hands fresh agents a compact and current context, collects spend telemetry, and leaves the human in charge of the process.

> A binnacle is the stand that holds a ship's compass in front of the helm. It does not steer and it does not pick the course — it keeps the instruments where the helmsman can read them. That is the whole design brief.

## The problem

Modern AI development hits a ceiling in context management, not only in model quality:

- long Product sessions grow and become expensive;
- compaction loses or distorts details;
- every new Claude/Codex/GLM/Gemini re-explores the project from scratch;
- different agents re-read the same files;
- it is hard to see where tokens, cache, tool calls and rework went;
- switching models means carrying context over by hand;
- parallel agents without dependency control cause merge conflicts and duplicated work.

The Control Plane moves project state into durable sources: Git, Markdown documentation, ADRs, the tracker, and a local reconstructable event/telemetry layer. A chat becomes temporary working context, not the project's memory.

## Core principle

> **Project knowledge and task state belong to the project — not to a particular model, chat or coding harness.**

Claude Code, Codex, GLM, Gemini and future/local agents are replaceable executors.

## In scope for v1

- local daemon `binnd`;
- CLI `binn`;
- local MCP server;
- small Nuxt web dashboard;
- project registry;
- Project / Task / AgentRun / Review entities;
- Product Snapshot and Daily Snapshot;
- checkpoint instead of conversation handoff;
- telemetry ingestion from coding agents, read from the session artifacts they already write to disk, and received from the OpenTelemetry of those that export it;
- read-only GitHub/GitLab tracker adapters plus a local markdown fallback;
- audit/adopt for an existing project;
- integration with Matt Pocock Skills;
- integration with Ponytail;
- Serena, Graphify, Context7 and ast-grep as context/coding capabilities;
- Obsidian as a human-facing projection of the Project Brain;
- manual-first execution: the system recommends, the human launches. Binnacle never calls a model itself.

## Supporting any coding agent

Agents differ enormously in what they expose, so support is graded rather than binary:

| Level | Requirement | What you get |
| --- | --- | --- |
| 1 — Context | the agent can call an MCP server | project memory: snapshots, tasks, checkpoints, questions and answers |
| 2 — Attribution | it writes a session artifact with a working directory and session id | session-to-project attribution, timings, history |
| 3 — Usage | that artifact carries token counts | spend analytics, cost, rework metrics |
| 4 — Live | it exposes an observable stream | current activity |

**Level 1 is all it takes to be supported, and it needs no adapter.** An agent released tomorrow gets project memory on the day it can speak MCP. See `docs/adr/ADR-0014-harness-support-levels.md`.

The harnesses Binnacle reads today, the highest level each reaches, and how:

| Harness | Level | How it is reached |
| --- | --- | --- |
| Claude Code (CLI and desktop) | 4 — Live | its session files under `~/.claude/projects`, and the OpenTelemetry export `binn init` enables in its settings |
| Codex (CLI and desktop) | 4 — Live | its rollouts under `~/.codex/sessions`, and the OpenTelemetry export `binn init` enables in `~/.codex/config.toml` |
| Gemini CLI | 4 — Live, not verified | its session files under `~/.gemini/tmp`, and the OpenTelemetry export `binn init` enables in `~/.gemini/settings.json` |
| opencode | 3 — Usage | its database in `~/.local/share/opencode`; it documents no OpenTelemetry export |
| ZCode | 3 — Usage | its database in `~/.zcode/cli/db`; it documents no OpenTelemetry export |
| pi | 3 — Usage | its session files under `~/.pi/agent/sessions`; it has no built-in OpenTelemetry export |
| Antigravity | 2 — Attribution, not verified | its window state, which names each conversation's workspace; its conversations are encrypted, so no model or tokens |
| any other | 1 — Context | MCP, or `binn call` in its shell |

Level 4 holds while a harness's events arrive; without the export, Claude Code, Codex and Gemini CLI are read at level 3 from their files, and a call seen both ways is counted once. Gemini CLI and Antigravity are built from their sources, as neither could run a session on the owner's machine, and are marked not verified. Each project's actual levels, with the reason a harness stays below the next one, are on the dashboard's usage page. Details: `docs/03-mcp-and-skills.md`, *Harnesses and their levels*.

## Out of scope for v1

- an autonomous "virtual company" of agents;
- automatic launching of Architect/QA/Security/Reviewer;
- automatic model routing;
- our own Git/task tracker/CI;
- a Kubernetes/SRE/incident platform;
- a full Release Captain subsystem;
- LiteLLM as a mandatory gateway;
- team/server mode;
- a complex AI optimization advisor;
- a hard dependency of the project on Binnacle.

## Stack

- **TypeScript** — all of our own application code;
- **Node.js 24 LTS** — runtime baseline;
- **pnpm** — package manager / workspace;
- **Nuxt** — web dashboard;
- **`node:sqlite`** — local projection/cache, no native modules and no build step;
- **MCP** — agent-facing API, and the stable contract for every harness;
- **local session artifacts** — the primary telemetry source; OpenTelemetry is an optional addition where a harness supports it;
- Markdown/YAML/JSON — portable formats for project knowledge/config.

Python/Go/Rust are not used in our own core. External tools may ship their own runtime (Serena/Graphify, for example); Binnacle only integrates them.

## Install

Binnacle is distributed through npm and needs Node 24. It runs natively on Linux, macOS and Windows.

```bash
npm i -g @binnacle/cli
```

The daemon runs as a user process started by `binn daemon start`. Installing it as an auto-starting service is not part of v1.

### From this repository

Until the npm package is published, `binn` comes from a checkout. Link it onto PATH once, from the main checkout rather than a worktree:

```bash
pnpm install
cd apps/cli && pnpm link --global
```

If pnpm has no global bin directory yet, run `pnpm setup` first and open a new shell. Then start the daemon with `binn daemon start` and register the repository with `binn project register`.

The daemon also serves a read-only dashboard at its own address, `http://127.0.0.1:7717/` by default. Generate it once in the main checkout with `pnpm dashboard:generate`, and again after pulling a change to `apps/dashboard`; until then the address answers with a page naming that command. `binn dashboard` opens the dashboard in the default browser, already authorised, and `binn dashboard --print` prints its address without opening anything. After the first time, the plain address works as a bookmark in that browser.

The link runs the CLI out of the main checkout, with that checkout's `node_modules`. So after pulling or merging a change that touches the workspace — a new package, a changed dependency, `pnpm-lock.yaml` — run `pnpm install` in the main checkout again. Until then a package the CLI now imports is missing there, `binn` fails with `ERR_MODULE_NOT_FOUND`, and every session's MCP tools go with it. Installing in a worktree does not help: each checkout has its own `node_modules`.

Once `binn init` has installed the `binnacle` plugin, Claude Code loads that installed `binnacle@binnacle` here, not the skills in `.claude/skills/binnacle/`, so a merged change to those skills does not reach a new session by itself. After pulling or merging one, run in the main checkout the first command below, and the other two only when `claude plugin list --json` lists `binnacle@binnacle`:

```bash
pnpm --filter @binnacle/cli run prepare
claude plugin marketplace update binnacle
claude plugin update binnacle@binnacle
```

The first copies the skills into the CLI package and gives the plugin a version drawn from the plugin's files, so it changes whenever a skill does; the other two have Claude Code update its copy to that version. Every other harness runs the `binnacle-<action>` copy the first command also writes, so when `~/.agents/skills` holds a `binnacle-*` skill, reinstall that copy too, and take it back out of Claude Code, naming after `claude-code` any harness you keep it out of with `binn init --skip-harness`:

```bash
npx skills add ./apps/cli/skills -g -y
npx skills remove -g -a claude-code -s $(ls apps/cli/skills) -y
```

A new session then loads the changed skills. `/binnacle:autopilot` does this itself after each merge of its own that changed them.

`pnpm typecheck` and `pnpm test` check a change. `pnpm test` is offline; the adapters' live tests, which need read-only tokens, run apart with `pnpm test:live`. CI runs the typecheck and the tests in GitHub Actions on every push to `main` and every pull request (`.github/workflows/ci.yml`), without the live tests and without any secret.

`pnpm setup` puts its global bin directory on PATH in your shell's startup file, such as `~/.bashrc`, which the Claude Code desktop app does not read, so in the desktop app `.mcp.json` cannot find `binn`. Make `binn` visible there with a wrapper script named `binn`, made executable, in a directory already on the app's PATH — `~/.local/bin` on Linux:

```sh
#!/bin/sh
exec "$HOME/.local/share/pnpm/binn" "$@"
```

The path is pnpm's global bin directory, written out because the app has no `$PNPM_HOME` either: take it from `echo $PNPM_HOME` in a shell where pnpm works; on Linux it defaults to `~/.local/share/pnpm`. A symlink to pnpm's `binn` does not work instead: that file is a shim that finds the CLI relative to its own location, and through a symlink it resolves from the link's directory and finds nothing.

The committed `.mcp.json` runs `binn mcp`, so every Claude Code session opened in this repository, in the main checkout or in a worktree, has Binnacle's MCP tools with no per-session setup. It names the linked `binn` and not a path inside the working tree on purpose: in a worktree, a path would run that branch's half-finished code, and a broken branch would take the Product session's tools down with it. With the daemon stopped the server still connects, and each tool answers with an error naming `binn daemon start`.

## Target repository layout

```text
binnacle/
├── apps/
│   ├── daemon/
│   ├── dashboard/
│   └── cli/
├── packages/
│   ├── core/
│   ├── mcp/
│   ├── telemetry/
│   └── adapters/
├── docs/
├── templates/
├── AGENTS.md
├── CLAUDE.md
└── CONTEXT.md
```

## New project: the short path

```text
idea / discussion
    ↓
initial Markdown docs
    ↓
binn init
    ↓
setup Matt Pocock Skills
    ↓
grill-with-docs
    ↓
to-spec
    ↓
to-tickets
    ↓
/product
    ↓
/task <id>
    ↓
Developer → Review → Merge
```

## Existing project: the short path

```text
binn audit
    ↓
read the findings and their recommendations
    ↓
binn init
    ↓
/product
```

`binn audit [path]` reads the repository and prints findings, as text or with `--json`. It writes nothing and needs no daemon. In Claude Code, `/binnacle:audit [path]` runs it from the chat and shows the findings there, gaps first. `binn init` is the command that writes into the repository: it shows one plan and asks once. Where they are missing, the plan creates the issues directory the local tracker reads and a `<knowledge.docs>/roadmap.md` skeleton in Binnacle's format, whose Next action is `/grill-with-docs`, and a new manifest declares `knowledge.docs`; an existing roadmap is never rewritten, and one not in the format is named in the Summary and explained by `binn audit`. The plan also installs what is missing of Serena and Graphify (through `uv tool install`) and ast-grep (through npm), outside the repository; a tool already on `PATH`, or declared `false` under `capabilities`, is left alone, and without `uv` init names the command that installs it and leaves Serena and Graphify out. It then registers the MCP servers of Serena, Context7 and Graphify with each harness it detects, through the harness's own CLI and never in the repository, leaving one already registered as it is, except Serena in Codex's user file with Claude Code's context, which it offers to register again with Codex's, and printing the entry where a harness has no such command. For Claude Code, Codex and Gemini CLI, when detected, the plan points their OpenTelemetry export at the daemon's address in their user-scope settings — Claude Code's settings `env`, Codex's `[otel]` table in `~/.codex/config.toml`, Gemini CLI's `telemetry` block in `~/.gemini/settings.json` — as JSON over HTTP, with prompt logging off; an export already configured, to Binnacle or elsewhere, is left as it is and named, and a detected harness that cannot export, such as opencode, is named in the Summary with its reason. `binn audit` reports, per detected harness, whether it exports to Binnacle. With Claude Code detected, it installs the Matt Pocock Skills and Ponytail plugins through Claude Code's plugin CLI at user scope, unless Claude Code already lists them; with any harness detected, it installs both into every other harness the `skills` CLI detects, from their repositories, as it installs Binnacle's own skills, unless the manifest declares one `false`. When Obsidian lists exactly one vault on this machine and `~/.binnacle/settings.json` names none, the plan sets it there, outside the repository, as the vault the daemon projects the Project Brain into; with none or several, init names those it found and says how to set the path. Last, with Graphify found or installed, it adds `graphify-out/` to `.gitignore` unless Git already ignores it, and builds the first graph with `graphify extract . --code-only --allow-dedup-shrink`, which lets the graph shrink when Graphify's deduplication merges nodes, then its report with `graphify cluster-only . --no-label`, neither of which needs an API key or calls a model; a failed build or report is reported in the Summary, and the daemon builds it later.

Setup works from the chat as well as from a terminal. In Claude Code, `/binnacle:init [path]` runs `binn init --plan --json`, shows the same plan in the chat, every item in full, with the session history and the import window it uses, and asks once; name another window there to see the plan again with it. Only your yes in the chat writes it, through `binn init --apply <id>`, which refuses a plan that changed since it was shown, and the skill then shows the new plan and asks again (ADR-0037). The skill needs no daemon and never commits: review and commit init's writes yourself, as after a terminal run. With the daemon stopped, registration is left out of the plan, and `/binnacle:daemon start` then `/binnacle:register` adds it. When init writes `.mcp.json`, the skill ends by saying to open a new session in the repository and approve the project's `binnacle` server: Claude Code reads `.mcp.json` only when a session starts. The skill is there once the `binnacle` plugin is installed, which the first `binn init` on this machine does at user scope.

## Working from another harness

One `binn init` sets up every harness on the machine. Its plan installs Binnacle's skills, at user scope, into every harness the `skills` CLI (skills.sh) detects, such as Codex, Antigravity, ZCode or Pi, through `npx skills`, and keeps them out of Claude Code, which has the `binnacle` plugin; `--skip-harness <id>` keeps them out of another one too. Outside Claude Code each skill is named `binnacle-<action>`: `binnacle-product`, `binnacle-daily`, `binnacle-task`, `binnacle-status`, `binnacle-checkpoint`, `binnacle-audit`, `binnacle-init`, `binnacle-daemon`, `binnacle-register`, `binnacle-dashboard`, `binnacle-autopilot`, `binnacle-answer` and `binnacle-help`, where Claude Code has `/binnacle:product` and the rest. The Summary names the harnesses the skills went into and says to run `binnacle-product` there. For a harness installed later, run `binn init` again: it installs them into every harness it detects, stale or current, and says which they were. `binn audit` reports skills at another version than the installed `binn`'s, and `binn init` then reinstalls them.

`binn init` also offers to register the `binnacle` MCP server with Claude Code, Codex, opencode and VS Code. In any other harness, or before the server is registered, the skills call the same tools through `binn call <tool> [json]` in the shell. `binnacle-autopilot` runs only where the harness can start a background agent in a worktree of its own; elsewhere it refuses at once, changes nothing, and the epic's tickets are run by hand.

- **Codex** reads a project's `.codex/config.toml` only in a trusted project. Trust the project in Codex, or the `binnacle` entry is not seen. The Codex desktop app ships its CLI outside `PATH`; on Linux it is `/usr/lib/chatgpt/resources/codex`.
- **opencode** reads `opencode.json` or `opencode.jsonc` in the project. Run `opencode` in the repository root.
- **GLM** is a model, not a harness. Reach it through a harness such as ZCode, Claude Code or opencode; there is no GLM adapter to look for.

## Documentation

Read in this order:

1. `docs/00-scope.md`
2. `docs/01-architecture.md`
3. `docs/02-project-brain.md`
4. `docs/workflow/01-product-workflow.md`
5. `docs/workflow/02-development-workflow.md`
6. `docs/03-mcp-and-skills.md`
7. `docs/04-telemetry-dashboard.md`
8. `docs/05-mvp-plan.md`

Current architectural decisions are recorded in `docs/adr/`.

## Licence

Apache-2.0. See `LICENSE`.
