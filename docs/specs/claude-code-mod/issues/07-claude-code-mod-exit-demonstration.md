# 07: The exit demonstration of epic 22, and 0.6.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 08
Spec: `docs/specs/claude-code-mod/spec.md`

**What to build:** epic 22's exit criterion, demonstrated by the owner, then the 0.6.0 release (spec, the exit criterion, *The release*).

- [ ] `binn init` asks whether to install the mod, declines on Enter, and installs it on a yes.
- [ ] In the terminal and in the desktop app, the status line shows the Task and role on a ticket's branch and the role on `main`, with tokens, context and the usage limits, beside the owner's own `statusLine`.
- [ ] The band shows a question recorded on a ticket's branch and is gone once the question is answered.
- [ ] `binnacle-pane` opens and closes the pane, in a terminal narrower than 144 columns and in the desktop app, and its buttons put their commands in the prompt box without sending them.
- [ ] With two sessions open, a failing CI on `main` toasts in one of them.
- [ ] A session on `main` starts with the session-start lines, and a session on a ticket's branch without them.
- [ ] With the daemon stopped, the mod shows nothing and says nothing.
- [ ] `claude plugin validate` on the built mod is clean.
- [ ] The CLI package's version is 0.6.0; 0.6.0 is published by `CONTRIBUTING.md`'s *Releasing* and installed from the registry into a clean container, where `binn daemon status` gives 0.6.0.

## Comments

### Run on 2026-10-29

From `feat/claude-code-mod-exit-demonstration`, with the built package and a temporary `BINNACLE_HOME` under `.scratch/demo-07/`, removed afterwards.

- **0.6.0, steps 1 to 4 of *Releasing***: `apps/cli/package.json` is `0.6.0`, and `SECURITY.md` and its twin name `0.6.x`, which `security-policy.test.ts` asked for once the version moved (red first, then green); `pnpm typecheck` and `pnpm test` (961 passed) pass; the build writes `@it-bbox/binnacle` 0.6.0 to `apps/cli/dist/`; `node --test apps/cli/test/tarball.live.ts` passes. Started from `apps/cli/dist/` with `BINNACLE_PORT=0`, `binn daemon status` gives `0.6.0`.
- **Criterion 8** holds: `claude plugin validate apps/cli/dist/mod` on Claude Code 2.1.308 first passed with one warning, no `author`. The mod's manifest now carries the marketplace's owner as its `author`, and `claude plugin validate` says "Validation passed". The plugin directory's own checks, which the command says do not change its result, still note no icon: left to epic 24, whose listings need one. `node --test apps/cli/test/mod.live.ts`, which runs `claude plugin validate` and `claude plugin test` on the built mod, passes.
- Found on the way: the mod's manifest description named the status line alone. **Fixed**: it names every surface, and `pack.test.ts` pins them and the author.

### For the owner

The mod and the rest of epic 22 reach the owner's Binnacle only from `main`: the branch is merged into `main` with `git merge` while this ticket still says `Status: READY`, then *After a pull or a merge* in `CONTRIBUTING.md` and the daemon restarted by its service. `DONE` comes after the criteria below, on this branch, merged again. Every check is in a new Claude Code session, since a mod loads at a session's start.

- **Criterion 1.** In a terminal, in the main checkout: `binn init`. It asks whether to install the mod, "[y/N]". Press Enter: the Summary records the mod declined and `claude plugin list` does not list `binnacle-mod`. Run `binn init` again and answer `y`, then accept the plan: its item runs `claude plugin install binnacle-mod@binnacle --scope user`, and `claude plugin list` lists `binnacle-mod`. A third `binn init` does not ask.
- **Criterion 2.** A new session on `main`, in the terminal, then in the desktop app: under the prompt, the mod's line gives the session's role, its output tokens "(по активности)", its context percentage and the five-hour and seven-day windows, beside the owner's own `statusLine`; after the first turn the tokens appear. A new session in a worktree on `feat/claude-code-mod-exit-demonstration` (`git worktree add ../binnacle-07 feat/claude-code-mod-exit-demonstration`, then `claude` in it): the line starts with `claude-code-mod/07` and the role, once the session has a run.
- **Criterion 3.** The agent records a real question on this ticket, on this branch, after the merge. Within a minute, every open session of the project shows the *Waiting for you* band above the prompt: «Вопросы без ответа: 1 (сначала claude-code-mod/07)». Answer it with `/binnacle:answer`: at the next refresh the band is gone.
- **Criterion 4.** `/binnacle-pane` in a terminal narrower than 144 columns opens the pane, a second `/binnacle-pane` closes it; the same in the desktop app. The pane shows the current epic with its progress, what waits, the Tasks in flight, `main`'s CI and the Next action. Each button puts its command in the prompt box, `/binnacle:task run …` for the Next action, and nothing is sent until Enter.
- **Criterion 5.** Two sessions of this project open. A commit whose CI fails reaches `main` on GitHub: within a minute, one of the two sessions shows the toast «CI падает на main…» and the other none. The commit is then reverted.
- **Criterion 6.** In a new session on `main`, ask the agent what its `binnacle` context block says: two or three lines on the current epic, what waits for the owner and the Next action with its command. In a new session in the worktree of criterion 2, the same question: it has no such block.
- **Criterion 7.** `systemctl --user stop binnacle.service`. Within a minute the mod's line is gone, no band and no toast appear, the pane is empty, and nothing in the chat mentions the daemon. `systemctl --user start binnacle.service`: the line comes back at the next refresh, without a restart of the session.
- **Criterion 9.** Push `main` with this branch merged and wait for CI's `check`, `tarball-live` and `autostart-live` to go green there; rebuild at that commit, then `npm whoami`, `npm publish --dry-run` and `npm publish --access public` from `apps/cli/dist/`, confirming the second factor in the browser. Once `npm view @it-bbox/binnacle version` prints `0.6.0`, in a `node:24-slim` container: `npm i -g @it-bbox/binnacle@0.6.0`, `binn --version`, `binn daemon start` and `binn daemon status`, which gives `0.6.0`.
