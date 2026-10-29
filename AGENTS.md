# Agent Instructions

## Purpose

This repository implements the AI Engineering Control Plane. Priorities: simplicity, observability, portability, graceful degradation and human control.

## Mandatory principles

1. **Do not turn the system into an autonomous orchestrator.** No automatic spawning of full agents in v1, with one exception: `/binnacle:autopilot`, started by a human, spawns agents to finish one already planned epic (ADR-0022). Binnacle itself never spawns agents.
2. **Do not duplicate external systems.** Git stays Git, GitHub/GitLab stay the tracker/remote, CI stays external CI.
3. **Binnacle must not be a required runtime for the user's project.** If the daemon is unavailable, the project must still be developable the normal way.
4. **Canonical knowledge lives in portable sources.** Markdown, Git, tracker. The local DB is a rebuildable projection/cache.
5. **Do not invent telemetry.** Missing provider metrics are stored as `null`; derived metrics are marked calculated/estimated.
6. **Progressive disclosure.** Do not load the whole Project Brain into an agent. Compact snapshot first, targeted queries after.
7. **One primary active agent per Task by default.** Parallelism across tasks is enabled manually, after dependency/impact analysis.
8. **Inter-agent communication must be visible.** Question, Answer, Review, Decision, Handoff/Checkpoint are explicit artifacts/events.
9. **Ponytail/YAGNI.** Do not create abstractions, services or dependencies without a real need.
10. **Keep the v1 scope strictly.** See `docs/00-scope.md`.

## Technology constraints

- TypeScript only for our application code.
- Node.js 24 LTS baseline.
- pnpm workspace.
- Nuxt for dashboard.
- Prefer Node standard library and small focused dependencies.
- No microservices in v1.
- No message broker in v1.
- No Kubernetes in v1.
- SQLite is acceptable for local projection store.

## Context routing

- internal symbol/reference navigation → Serena;
- cross-module architecture/impact → Graphify;
- external library/framework/API docs → Context7;
- structural syntax search/refactor → ast-grep;
- architecture/product rationale → docs / ADR / CONTEXT;
- exact implementation truth → source code.

## Matt Pocock workflow

For new/large product work:

`grill-with-docs → to-spec → to-tickets → implement/review`

Binnacle integrates this workflow; it does not replace it.

## Documentation language

All project documentation is written in English: `README.md`, `CONTEXT.md`, `AGENTS.md`, `CLAUDE.md`, `MANIFEST.md`, everything under `docs/`, ADRs, specs and issues.

The exception is the user guides: `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and every page in `docs/operations/`. Each has a Russian twin beside it, named `*.ru.md` (`README.ru.md`, `docs/operations/01-new-project.ru.md`), which links its English page and, for every other user guide, the Russian twin. A twin is updated in the same change as its English page. `pnpm test` fails when a guide lacks its twin or a relative link in either does not resolve.

## Commit messages

Every commit, a ticket's or a Product session's: an English subject of at most 72 characters, and a body only when the subject cannot carry the why.

## Commit authorship

Every commit and pull request has exactly one author and one contributor: `miker059@gmail.com`.

Never add `Co-Authored-By:` trailers. Never attribute a commit, pull request or release note to Claude, Anthropic or any other agent, model or tool — no trailers, no "Generated with" footers, no assistant names in the body.

Agents work on this repository; they do not sign for it.

## Before making architectural changes

Read:

- `CONTEXT.md`
- relevant `docs/adr/*`
- `docs/00-scope.md`
- `docs/01-architecture.md`

If the change introduces a new durable architectural trade-off, propose an ADR first.

## Traps

- A worktree under `.claude/worktrees/` starts without `node_modules`: run `pnpm install --frozen-lockfile --offline` in it before the typecheck or the tests.
- `binn`'s human output, like Git's, follows the locale: under `ru_RU` `binn daemon status | grep version` finds nothing, since it prints `версия`. Prefix `LC_ALL=C` when a command's output is grepped.
- `binn` has no per-command help: `binn daemon status --help` fails as an unknown command. `binn --help` prints every command with its options.
- A row added to `CONTEXT.md`'s *Russian words* goes, in the same change, into the Words paragraph of every skill under `apps/cli/plugin/skills/`, word for word as `/binnacle:product`'s, or `pnpm test` fails.
