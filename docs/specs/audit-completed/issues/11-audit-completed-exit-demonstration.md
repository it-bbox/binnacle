# 11: The exit demonstration of epic 12, and 0.2.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** epic 12's exit criterion, demonstrated by the owner, then the 0.2.0 release (spec, the exit criterion).

- [ ] `binn audit` on this repository: no gap in `docker`, `secrets` and `security`, and a migration plan at the end.
- [ ] On a fixture with a committed `.env`, a GitHub token in a tracked file and a Dockerfile with no `.dockerignore`: each reported by path and line, never by value, and the plan puts `binn init` first and the secrets second; `/binnacle:audit` shows the plan first.
- [ ] `/binnacle:init` from the chat asks about autostart.
- [ ] After the push, Dependabot opens an npm update pull request.
- [ ] 0.2.0 published by `CONTRIBUTING.md`'s *Releasing*, and installed from the registry.

## Comments

- Found by autopilot's run (2026-10-15), for the demonstration:
  - Dependabot's first npm run after the push failed again with `ERR_PNPM_NO_MATURE_MATCHING_VERSION`, on `vue` 3.5.44: the lockfile took it on 2026-10-13, the day it was released at 07:45 UTC, so it was under three days old when the run started. It is three days old from 2026-10-16 07:45 UTC, and `minimumReleaseAge` now keeps younger entries out of the lockfile. Run *Insights → Dependency graph → Dependabot → Check for updates* again, and read the run's `ERR_PNPM_…` line if it fails.
  - The owner's main checkout has `extensions.worktreeconfig=true` with no `config.worktree`, so `binn audit` there reports `git.worktree_config` in `git-and-tracker`, outside the three new areas. `git config --unset extensions.worktreeconfig` clears it; the harness that creates agent worktrees may set it again.
