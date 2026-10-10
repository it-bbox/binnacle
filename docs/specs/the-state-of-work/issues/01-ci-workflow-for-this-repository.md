# 01: A GitHub Actions workflow for this repository

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, DevOps

**What to build:** this repository runs its typecheck and its tests in GitHub Actions on every push to `main` and every pull request (spec, *The workflow*). One workflow under `.github/workflows/`, on `ubuntu-latest`, Node 24 and the pnpm version `packageManager` names: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`. Live tests stay out. Any test that passes only on the owner's machine is fixed so that it passes in a clean checkout with an empty home.

- [ ] The workflow runs on push to `main` and on pull requests, with the steps above, and no secret.
- [ ] In a fresh clone of the branch, with `HOME` set to an empty temporary directory and no `BINNACLE_*_TOKEN` in the environment, `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test` passes; the ticket's Comments say how it was run.
- [ ] A test that needed the owner's machine is fixed, not skipped, and its fix named in the Comments; none needed is said so.
- [ ] The README and `README.ru.md` say that CI runs the typecheck and the tests, where they describe testing.
- [ ] The run on GitHub after the owner's push is green: left to the exit demonstration (12), unticked here, with the command to see it under Comments.
