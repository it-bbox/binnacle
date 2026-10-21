# 11: The exit demonstration of epic 12, and 0.2.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** epic 12's exit criterion, demonstrated by the owner, then the 0.2.0 release (spec, the exit criterion).

- [x] `binn audit` on this repository: no gap in `docker`, `secrets` and `security`, and a migration plan at the end.
- [x] On a fixture with a committed `.env`, a GitHub token in a tracked file and a Dockerfile with no `.dockerignore`: each reported by path and line, never by value, and the plan puts `binn init` first and the secrets second; `/binnacle:audit` shows the plan first.
- [x] `/binnacle:init` from the chat asks about autostart.
- [x] After the push, Dependabot opens an npm update pull request.
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
  - **Dependabot**, criterion 4, holds: after `main` was pushed with ticket 10's cooldown (head `40a7525`, 2026-10-16), Dependabot opened npm update pull requests #2 to #5 on 2026-10-20, as GitHub reports. #3 (`@types/node` 26) and #4 (`typescript` 7) fail CI; they are majors, the owner's to take or close.
  - **`/binnacle:audit`**, criterion 2, holds (the owner, 2026-10-21): `/binnacle:audit .scratch/demo/fixture` in the chat shows the migration plan first, `Run binn init` as step 1 and the committed secrets as step 2, then `.env`, `config.js:3` and `Dockerfile` among the gaps, and no value.
  - **`/binnacle:init`**, criterion 3, holds (the owner, 2026-10-21): with autostart turned off, `/binnacle:init .scratch/demo/fixture` in the chat asks first, alone, whether the daemon should start at login; the owner's no leaves autostart out of the plan and names `binn daemon autostart on` in its notes. The owner declined the plan, the fixture stayed clean, and autostart was turned on again.
- For the owner, the criterion left unticked:
  - **0.2.0**, criterion 5: after the merge, rebuild at `main`'s head (*Releasing* steps 3 and 4: the `apps/cli/dist/` built on this branch predates the `SECURITY.md` fix); once `tarball-live` is green there, *Releasing* step 5 (`npm login`, `cd apps/cli/dist`, `npm publish --access public`), then `npm view @it-bbox/binnacle version` prints `0.2.0` and the installation checklist installs it.

### Review

Run in a sub-agent, 2026-10-21, on the branch's first three commits.

#### Standards

- `SECURITY.md:9,11` and its twin still named `0.1.x` as the supported line, untrue once 0.2.0 is out. **Fixed**: both say `0.2.x`, and `apps/cli/test/security-policy.test.ts` now takes the line from `apps/cli/package.json`'s version, so the next minor release fails `pnpm test` until the policy moves with it.
- `pnpm-lock.yaml`: kept, it records no workspace package's version.
- `docs/operations/05-installation-checklist{,.ru}.md:25`: kept, `0.1.0` there is an example of `binn --version`'s output.
- Commits and authorship: none found.

#### Spec

- Criteria 1 and 4 hold, re-run and read again from GitHub; the CLI half of criteria 2 and 3 holds as recorded.
- Criterion 5's script did not say to rebuild after the merge. **Fixed** above.

#### Security

- No secret value is printed: the fixture's token, any 12-character slice of it, and the `.env` value appear in neither the text nor the `--json` output. None found.
- The fixture's fake token cannot be committed here: `.scratch/` is ignored, the fixture is its own repository with no remote, and neither the diff nor the logs hold it. None found.
