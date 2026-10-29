# 07: The exit demonstration of epic 22, and 0.6.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 08
Spec: `docs/specs/claude-code-mod/spec.md`

**What to build:** epic 22's exit criterion, demonstrated by the owner, then the 0.6.0 release (spec, the exit criterion, *The release*).

- [x] `binn init` asks whether to install the mod, declines on Enter, and installs it on a yes.
- [x] In the terminal and in the desktop app, the status line shows the Task and role on a ticket's branch and the role on `main`, with tokens, context and the usage limits, beside the owner's own `statusLine`.
- [x] The band shows a question recorded on a ticket's branch and is gone once the question is answered.
- [x] `binnacle-pane` opens and closes the pane, in a terminal narrower than 144 columns and in the desktop app, and its buttons put their commands in the prompt box without sending them.
- [ ] With two sessions open, a failing CI on `main` toasts in one of them.
- [x] A session on `main` starts with the session-start lines, and a session on a ticket's branch without them.
- [x] With the daemon stopped, the mod shows nothing and says nothing.
- [x] `claude plugin validate` on the built mod is clean.
- [ ] The CLI package's version is 0.6.0; 0.6.0 is published by `CONTRIBUTING.md`'s *Releasing* and installed from the registry into a clean container, where `binn daemon status` gives 0.6.0.

## Comments

### Run on 2026-10-29

From `feat/claude-code-mod-exit-demonstration`, with the built package and a temporary `BINNACLE_HOME` under `.scratch/demo-07/`, removed afterwards.

- **0.6.0, steps 1 to 4 of *Releasing***: `apps/cli/package.json` is `0.6.0`, and `SECURITY.md` and its twin name `0.6.x`, which `security-policy.test.ts` asked for once the version moved (red first, then green); `pnpm typecheck` and `pnpm test` (961 passed) pass; the build writes `@it-bbox/binnacle` 0.6.0 to `apps/cli/dist/`; `node --test apps/cli/test/tarball.live.ts` passes. Started from `apps/cli/dist/` with `BINNACLE_PORT=0`, `binn daemon status` gives `0.6.0`.
- **Criterion 8** holds: `claude plugin validate apps/cli/dist/mod` on Claude Code 2.1.308 first passed with one warning, no `author`. The mod's manifest now carries the marketplace's owner as its `author`, and `claude plugin validate` says "Validation passed". The plugin directory's own checks, which the command says do not change its result, still note no icon: left to epic 24, whose listings need one. `node --test apps/cli/test/mod.live.ts`, which runs `claude plugin validate` and `claude plugin test` on the built mod, passes.
- Found on the way: the mod's manifest description named the status line alone. **Fixed**: it names every surface, and `pack.test.ts` pins them and the author.

### For the owner

The mod and the rest of epic 22 reach the owner's Binnacle only from `main`: the branch is merged into `main` with `git merge` while this ticket still says `Status: READY`, then *After a pull or a merge* in `CONTRIBUTING.md` and the daemon restarted by its service. `DONE` comes after the criteria below, on this branch, merged again. Every check is in a new Claude Code session, since a mod loads at a session's start.

- **Criterion 1.** In a terminal, in the main checkout: `binn init`. It asks whether to install the mod, "[y/N]". Press Enter: the Summary records the mod declined and `claude plugin list` does not list `binnacle-mod`. Run `binn init` again and answer `y`, then accept the plan: its item runs `claude plugin marketplace add` for the package, since the main checkout skips the plugin step, then `claude plugin install binnacle-mod@binnacle --scope user`, and `claude plugin list` lists `binnacle-mod`. A third `binn init` does not ask.
- **Criterion 2.** A new session on `main`, in the terminal, then in the desktop app: under the prompt, the mod's line gives the session's role, its output tokens "(по активности)", its context percentage and the five-hour and seven-day windows, beside the owner's own `statusLine`; after the first turn the tokens appear. A new session in a worktree on `feat/claude-code-mod-exit-demonstration` (`git worktree add ../binnacle-07 feat/claude-code-mod-exit-demonstration`, then `claude` in it, and the same folder opened in the desktop app): the line starts with `claude-code-mod/07` and the role, once the session has a run.
- **Criterion 3.** The agent records a real question on this ticket, on this branch, after the merge. Within a minute, every open session of the project shows the *Waiting for you* band above the prompt: «Ждёт вас» over «Вопросы без ответа: 1 (claude-code-mod/07)». Answer it with `/binnacle:answer`: at the next refresh the band is gone.
- **Criterion 4.** `/binnacle-pane` in a terminal narrower than 144 columns opens the pane, a second `/binnacle-pane` closes it; the same in the desktop app. The pane shows the current epic with its progress, what waits, the Tasks in flight, `main`'s CI and the Next action. Each button puts its command in the prompt box, `/binnacle:task run …` for the Next action, and nothing is sent until Enter.
- **Criterion 5.** Two sessions of this project open. A commit whose CI fails reaches `main` on GitHub: within two minutes of the check failing (the forge cache's minute, then the mod's), one of the two sessions shows the toast «CI падает в main на <commit>, по данным GitHub: <url>» and the other none. The commit is then reverted.
- **Criterion 6.** In a new session on `main`, ask the agent what its `binnacle` context block says: two or three lines on the current epic, what waits for the owner and the Next action with its command. In a new session in the worktree of criterion 2, the same question: it has no such block.
- **Criterion 7.** `binn daemon stop`. Within a minute the mod's line is gone, no band and no toast appear, the pane is empty, and nothing in the chat mentions the daemon. `binn daemon start`: the line comes back at the next refresh, without a restart of the session.
- **Criterion 9.** Push `main` with this branch merged and wait for CI's `check`, `tarball-live` and `autostart-live` to go green there; rebuild at that commit, then `npm whoami`, `npm publish --dry-run` and `npm publish --access public` from `apps/cli/dist/`, confirming the second factor in the browser. Once `npm view @it-bbox/binnacle version` prints `0.6.0`, in a `node:24-slim` container: `npm i -g @it-bbox/binnacle@0.6.0`, `binn --version`, `binn daemon start` and `binn daemon status`, which gives `0.6.0`.

### Review

Run in a sub-agent, 2026-10-29, on the branch's first five commits.

#### Standards

None found: the version moved where 0.5.0's did (`apps/cli/package.json`, `SECURITY.md` and its twin, the test's comment), history untouched; subjects within 72 characters, one author, no trailers.

#### Spec

- Criterion 3's band text had "сначала", which the view prints only from two questions on. **Fixed**: «Вопросы без ответа: 1 (claude-code-mod/07)» under «Ждёт вас».
- Criterion 8 was shown to hold but left unticked. **Fixed**: ticked.
- Criterion 2 checked the ticket's branch in the terminal only. **Fixed**: the worktree in the desktop app too.
- Criterion 5's minute ignored the forge cache's period before the mod's refresh. **Fixed**: two minutes from the check failing, with the toast's full text.
- Criterion 1's plan item adds the marketplace first, since the main checkout skips the plugin step. **Fixed**: both commands named.
- Criterion 7 stopped the service by `systemctl`. **Fixed**: `binn daemon stop` and `start`, which go through the service.
- The mod's `author` repeats the marketplace's owner in `prepare.ts`: kept, `pack.test.ts` catches a drift.

### The owner's run

The branch merged into `main` with `git merge --no-ff` (`9e499af`) while this ticket said `Status: READY`; then *After a pull or a merge*: `prepare`, the marketplace and `binnacle@binnacle` updated, the `binnacle-*` skills reinstalled, the dashboard generated, and the daemon restarted by its service, `binn daemon status` giving `0.6.0`.

- **Criterion 1** holds (the owner, 2026-10-29), `binn init` in a terminal in the main checkout. First run: the question "[y/N]", Enter, and the Summary's «мод Binnacle: отклонён, поставить его можно позже командой `claude plugin install binnacle-mod@binnacle --scope user`»; `claude plugin list` did not list `binnacle-mod`. Second run: `y`, and the plan's item 2 ran `claude plugin marketplace add …/apps/cli --scope user` then `claude plugin install binnacle-mod@binnacle --scope user`; `claude plugin list` lists `binnacle-mod@binnacle`, enabled. A third run, by the agent without a terminal, did not ask: «мод Binnacle: Claude Code уже показывает binnacle-mod@binnacle».
- Found on the way: every run's skills step reports «ошибка … PromptScript does not support global skill installation (англ.)», a harness the skills CLI now finds that has no global skills. Left: for the product inbox, as a skip with its reason worded.
- Found in criterion 6's first try (the owner, 2026-10-29): a new session on `main` showed the status line but carried no `binnacle` block. The debug log of `claude --debug -p` showed the cause: `$.mcp.call` runs as `$.tool.call`, and with no rule allowing `mcp__binnacle__project_snapshot` Claude Code put the mod's call to the session's decider: denied where nobody can be asked, a dialog in the default mode, and, under auto mode, apparently denied at the start, since the first refresh is the one `prompt.context` waits on. **Fixed**: the mod allows its own call at `tool.check`, by `next.origin`, which Claude Code alone sets; the model's calls keep the rules. Checked with the built mod on Claude Code 2.1.308: `claude --debug -p` logs the mod answering `tool.check` and its snapshot answered, and the agent quotes the three lines. `docs/03-mcp-and-skills.md` says so.
- The second try (the owner, 2026-10-29) carried the lines only with the second message. An interactive `claude --debug` showed why: Claude Code computes the context as the session starts, about 200 ms before the `binnacle` server connects. **Fixed**: the context hook asks again every half second while it has no snapshot, inside the same 8 seconds; in the next interactive `claude --debug` the retry after the connection answered and the hook settled with the lines, 1.5 s in. And a refresh that answers after a context computed without one asks Claude Code to compute it again (`$.ui.invalidate('prompt.context')`), once. Pinned in `mod.test.ts`.
- **Criterion 2, in the terminal** (the owner, 2026-10-29): a new session on `main` showed «binnacle-mod: продуктовая сессия · 733 выходных т…» after its first turn, before it «контекст 6% · 5 ч 10% · 7 дн 28%», under the owner's own status rows. A new session in `../binnacle-07`, on this branch, showed «binnacle-mod: claude-code-mod/07 доработка · 864 выходных ток…», the role as Binnacle read the session. The Task came about a minute after the session's first turn: a new session's file reaches the snapshot at the importer's next pass, which a probe session in a fresh worktree confirmed (its run appeared 66 s in, with no other call). The desktop app is still to check.
- **Criterion 6** holds (the owner, 2026-10-29), with the two fixes above: a new session on `main` quoted the three lines of its `binnacle` block in answer to its first message, and a new session in `../binnacle-07` had none.
- Found in criterion 3's first try (the owner, 2026-10-29): the owner's own mod, `memory-band`, loaded through `CLAUDE_CODE_PLUGIN_DIRS`, answered the band above the prompt without passing it on, so Binnacle's band, beneath it, never showed. Claude Code draws that band once for every plugin. **Fixed**: Binnacle's band draws what a plugin beneath it draws under its own, a row apart, and `memory-band`, outside this repository, now does the same at the owner's yes; its own test passes.
- The band and the pane polished at the owner's ask: the band's CI line short, its branch and commit, without the forge and the link; in the pane, CI once, in its own section, red when failing and green when passing, the Next action's command on its button alone, and the sections a row apart.
- **Criterion 4** holds (the owner, 2026-10-29): `/binnacle-pane` opened and closed the pane in a terminal narrower than 144 columns and in the desktop app; its button put `/binnacle:task run docs/specs/claude-code-mod/issues/07-claude-code-mod-exit-demonstration.md` in the prompt box and sent nothing.
- **Criterion 3** holds (the owner, 2026-10-29): the question below, recorded on this branch, showed in the band as «Вопросы без ответа: 1 (claude-code-mod/07)»; answered with `/binnacle:answer`, it left the band within a minute and a session toasted «Получен ответ на вопрос по claude-code-mod/07».
- **Criterion 2** holds (the owner, 2026-10-29). The desktop app draws a plugin's status line in its bottom bar, beside the model: on `main`, «binnacle-mod продуктовая сессия · 138,5 тыс. вых…»; in a desktop session on `../binnacle-07`, «binnacle-mod: claude-code-mod/07 доработка · 160 выходных токенов (по активности) · контекст 9% · 5 ч 33% · 7 дн 31%», once the session's file reached the snapshot, about a minute in.
- Found on the way: back in a desktop session the line and the band were gone until the next message. A session the app starts again runs `session.start` before the `binnacle` server connects, as the context does, and the next refresh came a minute later. **Fixed**: the start asks every half second until a refresh answers, as long as the context hook waits; in an interactive `claude --debug` the line was drawn 4.4 s after the start with no message, the snapshot itself taking 3.8 s.
- **Criterion 7** holds (the owner, 2026-10-29): with the daemon stopped by `binn daemon stop`, the status line and Binnacle's part of the band went within a minute, `memory-band`'s rows staying, and nothing in the chat or the toasts named the daemon. Started again, the line came back at the next refresh.

### Question

`claude plugin validate`'s plugin directory checks note that `binnacle-mod` has no icon (and `binnacle` none either). Their result does not depend on it, and a listing takes its icon once, the first time the plugin is submitted. Add the icons now, before 0.6.0, or with epic 24's listings?

- With epic 24's listings (recommended): nothing now; the icons are drawn once, for the marketplace and MCP directory listings that use them, before any submission.
- Now: a 512 px square PNG for each plugin, drawn and committed in this ticket; 0.6.0 waits for it, and nothing shows it until a listing.

### Answer

2026-10-29

With epic 24's listings (recommended): nothing now; the icons are drawn once, for the marketplace and MCP directory listings that use them, before any submission.
