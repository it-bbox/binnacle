# Binnacle

_Русская версия: [README.ru.md](README.ru.md)._

**One project memory. Any coding agent.**
**Claude today. Codex tomorrow. Your project never starts from zero.**

Binnacle is a local, provider-agnostic **AI Engineering Control Plane**: persistent project context, workflow and observability across Claude Code, Codex, Gemini, GLM and other coding agents. It keeps project state outside chat sessions, hands fresh agents a compact and current context, collects spend telemetry, and leaves the human in charge of the process.

> A binnacle is the stand that holds a ship's compass in front of the helm. It does not steer and it does not pick the course — it keeps the instruments where the helmsman can read them. That is the whole design brief.

## The problem

Long agent sessions grow expensive, compaction loses detail, and every new agent re-explores the project from scratch. Binnacle moves project state into durable sources — Git, Markdown docs, ADRs, the tracker and a local, rebuildable telemetry store — so a chat is working context, not the project's memory.

> **Project knowledge and task state belong to the project — not to a particular model, chat or coding harness.**

## Install

Binnacle needs Node 24 and runs on Linux, macOS and Windows.

```bash
npm i -g @it-bbox/binnacle
binn daemon start
```

For a one-off run without installing, use `npx -p @it-bbox/binnacle binn`. `binn init` offers to start the daemon at login, and, in Claude Code, the optional Binnacle mod: Binnacle's state beside the chat, no by default. To install the mod later, and to turn it off or remove it:

```bash
claude plugin install binnacle-mod@binnacle --scope user
claude plugin disable binnacle-mod
claude plugin uninstall binnacle-mod
```

More: [The Binnacle mod for Claude Code](docs/operations/05-installation-checklist.md#the-binnacle-mod-for-claude-code). If a harness cannot find `binn`, see [the installation checklist](docs/operations/05-installation-checklist.md#when-a-harness-cannot-find-binn). To run Binnacle inside your app's dev container or `docker compose` service, see [Binnacle in a container](docs/operations/07-containers.md). To develop Binnacle itself, see [CONTRIBUTING.md](CONTRIBUTING.md#from-this-repository).

## New project: the short path

1. `git init`
2. `binn init` — one plan of everything it sets up, confirmed once.
3. `/binnacle:roadmap` — writes the vision and the epics.
4. `/binnacle:product` — the first Product session.

Then each epic goes `/grill-with-docs` → `/to-spec` → `/to-tickets`, and each ticket `/binnacle:task run <ticket>`, in a session of its own. Details: [New project](docs/operations/01-new-project.md).

## Existing project: the short path

1. `binn audit` — read-only findings; it writes nothing.
2. `binn init` — the same one plan.
3. `/binnacle:roadmap` — epics proposed from the code, the history and the docs.
4. `/binnacle:product` — the first Product session.

Nothing is moved or rewritten without your yes. Details: [Existing project](docs/operations/02-existing-project-adopt.md).

## Harnesses

Any harness that speaks MCP, or has a shell for `binn call`, gets the project's memory. Above that, Binnacle reads what each harness leaves on disk:

| Harness | Level |
| --- | --- |
| Claude Code (CLI and desktop) | 4 — Live |
| Codex (CLI and desktop) | 4 — Live |
| Gemini CLI | 4 — Live, not verified |
| opencode | 3 — Usage |
| ZCode | 3 — Usage |
| pi | 3 — Usage |
| Antigravity | 2 — Attribution, not verified |
| any other | 1 — Context |

What each level means and how each harness is reached: [Working from another harness](docs/operations/06-other-harnesses.md).

## User guides

- [New project](docs/operations/01-new-project.md)
- [Existing project](docs/operations/02-existing-project-adopt.md)
- [External tools](docs/operations/03-external-tools.md)
- [Security and resilience](docs/operations/04-security-resilience.md)
- [Installation checklist](docs/operations/05-installation-checklist.md)
- [Working from another harness](docs/operations/06-other-harnesses.md)
- [Binnacle in a container](docs/operations/07-containers.md)
- [Contributing](CONTRIBUTING.md) and the [security policy](SECURITY.md)

## Further reading

The project's design, in this order: [scope](docs/00-scope.md), [architecture](docs/01-architecture.md), [Project Brain](docs/02-project-brain.md), [product workflow](docs/workflow/01-product-workflow.md), [development workflow](docs/workflow/02-development-workflow.md), [MCP and skills](docs/03-mcp-and-skills.md), [telemetry and dashboard](docs/04-telemetry-dashboard.md), [MVP plan](docs/05-mvp-plan.md). Architectural decisions are in [docs/adr/](docs/adr/).

## Licence

Apache-2.0. See [LICENSE](LICENSE).
