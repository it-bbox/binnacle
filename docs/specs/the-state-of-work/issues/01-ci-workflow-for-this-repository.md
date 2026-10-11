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

## Comments

- **Where it lives.** `.github/workflows/ci.yml`: one job, `check`, on `ubuntu-latest`, with `permissions: contents: read`. `pnpm/action-setup@v4` is given no `version`, so it takes the one `packageManager` names in `package.json`; `actions/setup-node@v5` sets Node 24 and caches pnpm's store; then `pnpm install --frozen-lockfile`, `pnpm typecheck` and `pnpm test`. `pnpm test:live` is not run and no secret is read. The README and `README.ru.md` say so at the end of *From this repository*, the only place they tell how a change is checked: neither had a section on testing.
- **Test-first, as read here.** `apps/cli/test/ci-workflow.test.ts` reads the workflow with the daemon's `yaml` parser, as `pack.test.ts` does, and pins the spec's *The workflow*: push to `main` and pull requests, one job on `ubuntu-latest`, Node 24, pnpm's version left to `packageManager`, exactly the three commands, and no `secrets.` anywhere in the file. It failed before the file existed.
- **The clean run.** In a fresh clone of this branch (`git clone --branch feat/ci-workflow-for-this-repository <worktree> .scratch/clean/repo`), the three commands were run the way a runner would, with `HOME` an empty directory, no environment but what follows, so no `BINNACLE_*_TOKEN` and no Git identity, in UTC, and with a `PATH` holding only Node, npm and pnpm and the system's `/usr/bin` less the owner's `claude`, so that none of the owner's harnesses and tools (`claude`, `opencode`, `gemini`, Graphify, Serena, `ast-grep`) were found:

  ```sh
  mkdir -p clean/home clean/bin
  for tool in node npm npx pnpm pnpx corepack; do ln -s "$(dirname "$(command -v node)")/$tool" clean/bin/; done
  for tool in /usr/bin/*; do case "${tool##*/}" in claude|claude-desktop) ;; *) ln -s "$tool" clean/bin/ ;; esac; done
  cd clean/repo && env -i PATH="$PWD/../bin" HOME="$PWD/../home" CI=true TZ=UTC LANG=C.UTF-8 \
    sh -c 'pnpm install --frozen-lockfile && pnpm typecheck && pnpm test'
  ```

  It passed, 701 tests of 701, before the workflow too (700 of 700 on `main`).
- **No test needed the owner's machine.** Every test that commits passes its own `user.name` and `user.email`, every test that reads a home or a manifest makes its own temporary one, and the trackers and forges are loopback fakes, so nothing was fixed or skipped.
- **The run on GitHub** is left to the exit demonstration (12). After the owner's push, `gh run list --workflow ci.yml --branch main --limit 1` shows it, and `gh run watch` follows it until it is green.
