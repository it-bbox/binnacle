# 11: The exit demonstration of epic 12, and 0.2.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** epic 12's exit criterion, demonstrated by the owner, then the 0.2.0 release (spec, the exit criterion).

- [x] `binn audit` on this repository: no gap in `docker`, `secrets` and `security`, and a migration plan at the end.
- [ ] On a fixture with a committed `.env`, a GitHub token in a tracked file and a Dockerfile with no `.dockerignore`: each reported by path and line, never by value, and the plan puts `binn init` first and the secrets second; `/binnacle:audit` shows the plan first.
- [ ] `/binnacle:init` from the chat asks about autostart.
- [ ] After the push, Dependabot opens an npm update pull request.
- [ ] 0.2.0 published by `CONTRIBUTING.md`'s *Releasing*, and installed from the registry.

## Comments

- Found by autopilot's run (2026-10-15), for the demonstration:
  - Dependabot's first npm run after the push failed again with `ERR_PNPM_NO_MATURE_MATCHING_VERSION`, on `vue` 3.5.44: the lockfile took it on 2026-10-13, the day it was released at 07:45 UTC, so it was under three days old when the run started. It is three days old from 2026-10-16 07:45 UTC, and `minimumReleaseAge` now keeps younger entries out of the lockfile. Run *Insights → Dependency graph → Dependabot → Check for updates* again, and read the run's `ERR_PNPM_…` line if it fails.
  - The owner's main checkout has `extensions.worktreeconfig=true` with no `config.worktree`, so `binn audit` there reports `git.worktree_config` in `git-and-tracker`, outside the three new areas. `git config --unset extensions.worktreeconfig` clears it; the harness that creates agent worktrees may set it again.
- Run on 2026-10-21, from `feat/audit-completed-exit-demonstration` with a temporary `BINNACLE_HOME`:
  - **This repository**: `binn audit` gives `ok` for `docker.setup` (no container file tracked), `secrets.scan` (537 tracked text files, no known token format, no `.env`), `security.lockfile`, `security.updates` and `security.policy`, and ends with a two-step migration plan: `git-and-tracker` (`tracker.token`, `git.worktree_config`, `tracker.token_works`), then `docs` (`docs.stranded`).
  - **The fixture**, a fresh repository at `.scratch/demo/fixture` committing `.env`, a classic GitHub token on line 3 of `config.js` and a `Dockerfile` with no `.dockerignore`: `secrets.env` names `.env`, `secrets.token` names `config.js:3`, `docker.ignore` names `Dockerfile`. Neither value appears in the text or the `--json` output. The plan's step 1 is `binn init`, step 2 the committed secrets; `--json` carries it as `plan.steps`.
  - **Autostart**: `binn init --plan --json` on the fixture, with autostart not installed, returns `autostart.ask: true` and writes nothing; `/binnacle:init` asks the question when it is true.
  - **0.2.0, steps 1 to 4 of *Releasing***: `apps/cli/package.json` is `0.2.0`; `pnpm install`, `pnpm typecheck` and `pnpm test` (855 passed) pass; the build writes `@it-bbox/binnacle` 0.2.0 to `apps/cli/dist/`; `node --test apps/cli/test/tarball.live.ts` passes.
- For the owner, the criteria left unticked:
  - **`/binnacle:audit`**, criterion 2: in a chat in this checkout, run `/binnacle:audit .scratch/demo/fixture` and see the migration plan shown first, `binn init` as step 1 and the secrets as step 2.
  - **`/binnacle:init`**, criterion 3: in a chat, run `/binnacle:init .scratch/demo/fixture` with autostart not installed (`binn daemon autostart off` first, or a machine without it), and see it ask, alone, whether the daemon should start at login. Answer no, and decline the plan, so nothing is written.
  - **Dependabot**, criterion 4: after the push, an npm update pull request opens. Pull requests #2, #3, #4 and #5 are open as of 2026-10-21, so this one may already hold.
  - **0.2.0**, criterion 5: once `tarball-live` is green at `main`'s head, *Releasing* step 5 (`npm login`, `cd apps/cli/dist`, `npm publish --access public`), then `npm view @it-bbox/binnacle version` prints `0.2.0` and the installation checklist installs it.
