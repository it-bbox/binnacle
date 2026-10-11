# 01: A GitHub Actions workflow for this repository

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, DevOps

**What to build:** this repository runs its typecheck and its tests in GitHub Actions on every push to `main` and every pull request (spec, *The workflow*). One workflow under `.github/workflows/`, on `ubuntu-latest`, Node 24 and the pnpm version `packageManager` names: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`. Live tests stay out. Any test that passes only on the owner's machine is fixed so that it passes in a clean checkout with an empty home.

- [x] The workflow runs on push to `main` and on pull requests, with the steps above, and no secret.
- [x] In a fresh clone of the branch, with `HOME` set to an empty temporary directory and no `BINNACLE_*_TOKEN` in the environment, `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test` passes; the ticket's Comments say how it was run.
- [x] A test that needed the owner's machine is fixed, not skipped, and its fix named in the Comments; none needed is said so.
- [x] The README and `README.ru.md` say that CI runs the typecheck and the tests, where they describe testing.
- [ ] The run on GitHub after the owner's push is green: left to the exit demonstration (12), unticked here, with the command to see it under Comments.

## Comments

- **Where it lives.** `.github/workflows/ci.yml`: one job, `check`, on `ubuntu-latest`, stopped after 15 minutes, with `permissions: contents: read`. `pnpm/action-setup@v6` is given no `version`, so it takes the one `packageManager` names in `package.json`; `actions/setup-node@v7` sets Node 24 and caches pnpm's store; then `pnpm install --frozen-lockfile`, `pnpm typecheck` and `pnpm test`. `pnpm test:live` is not run and no secret is read. The README and `README.ru.md` say so in *From this repository*, after the paragraph on loading changed skills, where they tell how a checkout is used: neither had a section on testing.
- **Test-first, as read here.** `apps/cli/test/ci-workflow.test.ts` reads the workflow with the daemon's `yaml` parser, as `pack.test.ts` does, and pins the spec's *The workflow*: push to `main` and pull requests, one job on `ubuntu-latest`, Node 24, pnpm's version left to `packageManager`, exactly the three commands, and no `secrets.` anywhere in the file. It failed before the file existed.
- **The clean run.** In a fresh clone of this branch (`git clone --branch feat/ci-workflow-for-this-repository <worktree> .scratch/clean/repo`), the three commands were run the way a runner would, with `HOME` an empty directory, no environment but what follows, so no `BINNACLE_*_TOKEN` and no Git identity, in UTC, and with a `PATH` holding only Node, npm and pnpm and the system's `/usr/bin` less the owner's `claude`, so that none of the owner's harnesses and tools (`claude`, `opencode`, `gemini`, Graphify, Serena, `ast-grep`) were found:

  ```sh
  mkdir -p clean/home clean/bin
  for tool in node npm npx pnpm pnpx corepack; do ln -s "$(dirname "$(command -v node)")/$tool" clean/bin/; done
  for tool in /usr/bin/*; do case "${tool##*/}" in claude|claude-desktop) ;; *) ln -s "$tool" clean/bin/ ;; esac; done
  cd clean/repo && env -i PATH="$PWD/../bin" HOME="$PWD/../home" CI=true TZ=UTC LANG=C.UTF-8 \
    sh -c 'pnpm install --frozen-lockfile && pnpm typecheck && pnpm test'
  ```

  It passed, 701 tests of 701, again after the Review's fixes, and before the workflow too (700 of 700 on `main`).
- **No test needed the owner's machine.** Every test that commits passes its own `user.name` and `user.email`, every test that reads a home or a manifest makes its own temporary one, and the trackers and forges are loopback fakes, so nothing was fixed or skipped.
- **The run on GitHub** is left to the exit demonstration (12). After the owner's push, `gh run list --workflow ci.yml --branch main --limit 1` shows it, and `gh run watch` follows it until it is green.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards.** No documented standard is broken: the commits have one author and name no assistant, the documents are in English, `README.ru.md` changes with `README.md`, and nothing is added as a dependency. Judgement calls:

1. **`any` in the parser's type** in `ci-workflow.test.ts`, where `pack.test.ts`, which the line follows, has `unknown`, and no other test has an `any`. **Fixed**: `unknown`, and the result cast once to the workflow's shape.
2. **Duplicated Code**: borrowing the daemon's `yaml` through `createRequire` repeats `pack.test.ts`'s line. **Kept**: two uses; a shared helper waits for a third.
3. **Speculative Generality**: the spec's check of the workflow is the clean run, and `ci-workflow.test.ts` repeats the file's commands, so a change to the workflow is a change to two files. **Kept**: the test pins what the spec fixes and a later edit could quietly break, no secret, the live tests out, pnpm's version left to `packageManager`, and an edit to the workflow is meant to meet it.
4. **The test lives in `apps/cli/test/`**, though the workflow is the repository's, not the CLI's. **Kept**: `pnpm test` reads only `{apps,packages}/*/test/`, and the CLI's tests already check repository files, `pack.test.ts` the development workflow document and the plugin's skills.

#### DevOps

The ticket's `Roles:` names DevOps beyond the Developer and the Reviewer, so the workflow was also read as it would run on a runner. pnpm is set up before `setup-node`'s pnpm cache, as that cache needs; `pnpm/action-setup` with no `version` takes `packageManager`'s; the lockfile has no build scripts for pnpm 10 to block; and no path filter keeps a documentation-only change from running, which `pack.test.ts` needs, since it reads the documents. Findings:

5. **Older major versions**: `actions/checkout@v5`, `actions/setup-node@v5` and `pnpm/action-setup@v4`, where `v7`, `v7` and `v6` are out, with the inputs used here unchanged (`git ls-remote --tags` and their `action.yml`). **Fixed**: the latest majors. Pinning by SHA is **kept** out: the job holds no secret and reads the repository only.
6. **No `concurrency`**, so a new push to a pull request does not cancel the run before it. **Kept**: one owner pushes a few times a day, and the spec does not ask for it.
7. **No `timeout-minutes`**, so a test that hangs holds the runner for GitHub's six hours. **Fixed**: 15 minutes, against a run of about two.
8. **`node-version: 24` repeats `.nvmrc`'s `24`**. **Kept**: the spec names Node 24, and the test pins it.

**Spec.** Every criterion is implemented; the GitHub run stays unticked for the exit demonstration (12), its command under Comments. Findings:

9. **`permissions: contents: read`** is not asked for. **Kept**: the least the job needs, in keeping with "no secret".
10. **The Comments say the README's paragraph ends *From this repository***, where the paragraph on the desktop app's wrapper still follows it. **Fixed**: the Comments say where it is.
11. **`snapshot.test.ts` expects `graphify` to be missing from the daemon's search path**, which looked like a test that needs a machine without it. **Kept**: `startTestDaemon` gives the daemon its own empty search path (`<home>/no-tools`, `apps/daemon/src/testing.ts`), so the suite passes with the owner's `PATH`, which has `graphify`, and with the clean run's, which has not.
12. **The ticket is not yet DONE.** Nothing to fix: its last commit does that, after this Review.

**In all**: four findings fixed; seven kept with their reasons, one of them, SHA pinning, beside a fix; one that finds nothing. The full suite, 701 tests, and the typecheck pass after the fixes, in the worktree and in the clean run.
