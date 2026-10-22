# 11: The exit demonstration of epic 13, and 0.3.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10
Spec: `docs/specs/human-output/spec.md`

**What to build:** epic 13's exit criterion, demonstrated by the owner, then the 0.3.0 release (spec, the exit criterion).

- [ ] `/binnacle:product` in a Russian chat on this repository opens with three to six Russian lines, no attention code and no English domain term; the files it would write stay English.
- [x] `binn audit` with `LANG=ru_RU.UTF-8` speaks Russian and leads with its plan.
- [ ] The dashboard in Russian shows Russian terms and no codes.
- [x] On a fixture documented in Russian, `binn init` proposes Russian and writes its templates in it, the vault is projected in it, and `binn audit` reads the markers back with no gap.
- [ ] 0.3.0 published by `CONTRIBUTING.md`'s *Releasing*, and installed from the registry.

## Comments

- Run on 2026-10-22, from `feat/human-output-exit-demonstration`, with the built package and a temporary `BINNACLE_HOME` (and, for the fixture, a temporary `HOME`) under `.scratch/demo-ru/`:
  - **0.3.0, steps 1 to 4 of *Releasing***: `apps/cli/package.json` is `0.3.0`, and `SECURITY.md` and its twin name `0.3.x` as the supported line, which `security-policy.test.ts` asks for; `pnpm install`, `pnpm typecheck` and `pnpm test` (895 passed) pass; the build writes `@it-bbox/binnacle` 0.3.0 to `apps/cli/dist/`; `node --test apps/cli/test/tarball.live.ts` passes.
  - **`binn audit`**, criterion 2, holds: with `LANG=ru_RU.UTF-8` on this repository it speaks Russian, opens with its one-line count and then its migration plan (Git и трекер and Документация first; the rest depends on the machine: Телеметрия under a temporary `BINNACLE_HOME` with no daemon, `.scratch` while `.scratch/demo-ru/fixture` is there), then the gaps and the findings in order, with no code in its text.
  - **The fixture**, criterion 4, holds: a fresh repository at `.scratch/demo-ru/fixture` whose README is Russian. `binn init --plan --json` proposes `ru` from the README (`language.source: readme`) and writes `knowledge.language: ru`; applied, `docs/agents/*.md`, `AGENTS.md` and `docs/roadmap.md` are Russian, with the roadmap's table header, statuses, `## Current focus`, `Next action:`, the ticket header's fields, `## Ticket header`, `## Agent skills` and the triage labels English. With a Russian spec and ticket committed (a `### Question` with options among its comments) and a vault set, the daemon projected `Product/`, `Specs/` and `Research/`, and the snapshot and daily notes in Russian. `binn audit` reads the roadmap as Binnacle's format, finds the ticket-header section and the layout, and `task_get` reads the ticket and its question: none of its gaps is a marker (they are the fixture's missing `CONTEXT.md`, ADRs, CI, lockfile, update tool, security policy and telemetry export).
- Found on the way:
  - The Russian vault notes wrote the CI line's reason in English, marked `(англ.)`, although it carries `ci.no_forge`, which core words in Russian: the vault passed on the reason without its code, against story 26. **Fixed** on this branch: the vault words an unavailable value from its code when it has one, and `vault.test.ts` asks for the Russian CI line.
  - The snapshot's suggested alternative "Epic 1 (…) has Tasks ready to start. Run its remaining tickets." (`packages/core/src/roadmap.ts`) has no code, so the Russian vault keeps it in English, marked, as story 27 allows. So do the graph's reasons ("graphify is not on the daemon's PATH…"). Candidates for wording, for the product inbox.
  - Under the temporary `HOME` the skills CLI detected no harness and failed on PromptScript, which "does not support global skill installation", and `claude-plugins-official` was not a known marketplace: artefacts of the empty home, not of init.
- For the owner, the criteria left unticked. Criteria 1 and 3 need epic 13 in the owner's own Binnacle first: after the merge, *After a pull or a merge* in `CONTRIBUTING.md` (the dashboard regenerated, the daemon restarted, the plugin refreshed). Delete `.scratch/demo-ru/` once the demonstration no longer needs the fixture.
  - **`/binnacle:product`**, criterion 1: in a fresh session on this repository, in Russian, run `/binnacle:product`. It opens with three to six Russian lines, with no attention code and no English domain term (Task, Epic, Next action read задача, эпик, следующий шаг); if it proposes a file, the text it would write is English.
  - **The dashboard**, criterion 3: `/binnacle:dashboard`, switch the language to Russian in its settings, and look at the overview, a project's page and a Task's page: Russian terms (эпик, задача, следующий шаг, ждёт владельца), and no code such as `next_action.stale`.
  - **0.3.0**, criterion 5: after the merge and the push, with CI's `check`, `tarball-live` and `autostart-live` green at `main`'s head, rebuild there (*Releasing* steps 3 and 4), then step 5 (`npm login`, `cd apps/cli/dist`, `npm publish --dry-run`, then `npm publish --access public`); `npm view @it-bbox/binnacle version` prints `0.3.0`, and the installation checklist installs it from the registry, for example in a clean `node:24-slim` container, where `binn --version` prints `0.3.0`.

### Review

Run in a sub-agent, 2026-10-22, on the branch's first two commits.

#### Standards

- The version moves everywhere it must: `apps/cli/package.json`, `SECURITY.md` and its twin, and the test's comment; `docs/roadmap.md:43`, `docs/product-inbox.md:109`, `CONTRIBUTING{,.ru}.md:103` and the installation checklist's `0.1.0` example are history or examples, kept. The private packages stay `0.1.0` (ADR-0044). None found.
- Commits and authorship: none found.

#### Spec

- Criteria 2 and 4 hold, criterion 2 re-run; 1, 3 and 5 are the owner's, and their scripts name real pieces (the dashboard's language switch in `settings.vue`, `/binnacle:dashboard`, CI's `check`, `tarball-live` and `autostart-live`).
- The CI line's English reason in the Russian vault is not story 27's case: it has `ci.no_forge`, which core words, and `vault.ts` dropped the code. **Fixed**: `vault-text.ts` words an unavailable value from its code when it has one; `vault.test.ts` asks for the Russian line.
- The audit's plan on this repository depends on the machine (`.scratch` while the fixture is there, Телеметрия under a temporary home). **Fixed** in the run notes, with the fixture's removal in the owner's script.
- The scripts did not say that criteria 1 and 3 need epic 13 in the owner's Binnacle, nor the dry run and the container check 0.2.0 used. **Fixed** in the owner's script.
