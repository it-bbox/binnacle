# 08: The exit demonstration of epic 21, and 0.5.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`

**What to build:** epic 21's exit criterion, demonstrated by the owner, then the 0.5.0 release (spec, the exit criterion, *The release*).

- [x] `/binnacle:task` with a ticket's path, without `run`, gives that Task's brief.
- [x] A Task whose branch is merged with `git merge` leaves the Tasks in flight, and the Suggested step does not wait for it.
- [x] A context-pressure warning names its session's own start and the threshold for its model, a number set on the Settings page.
- [x] The vault in Russian has no `(англ.)` for a pair or a failed Graphify run, and says "пулл-реквесты".
- [x] In an interactive Claude Code session, after `/clear` and after `--resume`, the warning says "this" or "another" only where it is true.
- [x] `/binnacle:checkpoint` proposes a trap for a fact that cost time in the session, and writes it to `AGENTS.md` only on the owner's yes.
- [ ] The CLI package's version is 0.5.0; 0.5.0 published by `CONTRIBUTING.md`'s *Releasing* and installed from the registry into a clean container, where `binn daemon status` gives 0.5.0.

## Comments

### Run on 2026-10-28

From `feat/hygiene-after-0-4-0-exit-demonstration`, with the built package and a temporary `BINNACLE_HOME` under `.scratch/demo-ru/`, removed afterwards.

- **0.5.0, steps 1 to 4 of *Releasing***: `apps/cli/package.json` is `0.5.0`, and `SECURITY.md` and its twin name `0.5.x`, which `security-policy.test.ts` asked for once the version moved (red first, then green); `pnpm install`, `pnpm typecheck` and `pnpm test` (921 passed) pass; the build writes `@it-bbox/binnacle` 0.5.0 to `apps/cli/dist/`; `node --test apps/cli/test/tarball.live.ts` passes.
- **The built daemon's version**, part of criterion 7: started from `apps/cli/dist/` with `BINNACLE_PORT=0`, `binn daemon status` gives `0.5.0`.
- **Criterion 4** holds. A clone of this repository at `main` (`3926642`) with `knowledge.language: ru`, its `origin` pointing at GitHub, registered under that home with a vault set, and a `graphify` on the daemon's `PATH` that prints a line to stderr and exits 1. The projected `Product/snapshot.md` carries no `(англ.)`; under `## Граф`: "Последний запуск, по `3926642` в …, упал. Graphify сообщил: «graphify: cannot read the corpus: model quota exhausted»"; the CI section's heading reads "### Открытые пулл-реквесты". No graph was built there, so the conflict risk read "нет данных" and no pair was printed: a pair's four wordings beside a failed run, in a Russian vault, with no `(англ.)` and no "пул-реквест", are `vault.test.ts`'s, in the same suite.
- **Part of criterion 6**: `binn call checkpoint_prepare` on that clone lists `{ "type": "trap", "path": "AGENTS.md" }` among its `targets`.
- **Part of criterion 1**: `task_get` given this ticket's path returned `hygiene-after-0-4-0/08`'s brief at the start of this run.
- **The rest of the spec's exit criterion**: whether `binn mcp` keeps the session's id across `/clear` and `--resume` is written down in `docs/03-mcp-and-skills.md` (`binn mcp` sends no `session`) and in ticket 06's comments; `/binnacle:product` in Russian is the owner's, under criterion 3 below.
- Found on the way: "Риск конфликта: нет данных — Граф ещё не построен: …" still capitalises the reason after the dash. Left: the roadmap's line for epic 21 names it, the spec does not, so no ticket took it; for the product inbox.

### For the owner

Criteria 1, 2, 3, 5 and 6 need epic 21 in the owner's own Binnacle first. Merge this branch into `main` with `git merge` (`--ff-only` or `--no-ff`; a squash or a merge on the forge leaves criterion 2 reading as before, spec, *Contested points*) while this ticket still says `Status: READY`, then *After a pull or a merge* in `CONTRIBUTING.md` (the dashboard regenerated, the daemon restarted, the plugin refreshed). `DONE` comes after the criteria below, on this branch, merged again.

- **Criterion 1.** In a fresh session: `/binnacle:task docs/specs/hygiene-after-0-4-0/issues/08-hygiene-after-0-4-0-exit-demonstration.md`. It should open with this Task's lines and its `start`, and change nothing.
- **Criterion 2.** After that merge, `/binnacle:product` in a fresh Product session: `hygiene-after-0-4-0/08` is not under *In progress* although this session's runs were on its branch, it is among the owner's to start (`ready-for-human`), and the Suggested step does not say to wait for its implementation run.
- **Criterion 3.** Take a Product session with more than one run, one resumed with `claude --resume` for instance, so that its start and its latest run's differ. On the dashboard's Settings page, set a context-pressure threshold for its model below its tokens (or the default, if its model is not listed), and save. A second session's `/binnacle:product`, in a Russian chat, should warn about the first with the threshold as that number, naming its model, and with the session's first start, not its latest run's, dated when it is not today; with no `(англ.)` and "пулл-реквест" as the one spelling. Keep the threshold for criterion 5.
- **Criterion 5.** Ticket 06's script below, steps 1 to 4, with criterion 3's threshold still set: `/clear` and `--resume` in an interactive Claude Code session. Restore the threshold afterwards.
- **Criterion 6.** In a Product session, make a fact cost time on purpose: a command that fails for a reason `AGENTS.md`'s *Traps* does not yet name, found and worked around in the session. Run `/binnacle:checkpoint`: it should propose a trap, one line for `AGENTS.md`. Answer no: `AGENTS.md` is untouched. Run it again and answer yes: the line is written there.
- **Criterion 7.** Push `main` with this branch merged and wait for CI's `check`, `tarball-live` and `autostart-live` to go green there; rebuild at that commit, then `npm whoami` (the 0.4.0 run lost a publish to a lapsed login), `npm publish --dry-run` and `npm publish --access public` from `apps/cli/dist/`, confirming the second factor in the browser. Once `npm view @it-bbox/binnacle version` prints `0.5.0`, in a `node:24-slim` container: `npm i -g @it-bbox/binnacle@0.5.0`, `binn --version`, `binn daemon start`, then `binn daemon status` should give `0.5.0`.

### The owner's run

The branch merged into `main` with `git merge --no-ff` (`7a97c27`) while this ticket said `Status: READY`; then *After a pull or a merge*: the dashboard generated, `prepare`, the marketplace updated, the `binnacle-*` skills reinstalled, and the daemon restarted by its service, `binn daemon status` giving `0.5.0`.

- **Criterion 1** holds (the owner, 2026-10-28): in a fresh session, `/binnacle:task` with this ticket's path opened with `hygiene-after-0-4-0/08`, its title, `READY`, `ready-for-human`, its epic, all seven dependencies met and no question, and offered the ticket, roles, dependencies, spec, Review and branch; nothing changed in the checkout.
- **Criterion 2** holds (the owner, 2026-10-28): `/binnacle:product` in a fresh Product session put `hygiene-after-0-4-0/08` under *Waiting for the owner* as a Task the owner starts, not under *In progress*, although this ticket's runs were on its branch; the Suggested step named it as the owner's and did not say to wait for its run. Beside it, the context-pressure warning named a Product session started at 18:39 at 154 278 tokens over the default 150 000, with neither "this" nor "another", as `binn mcp` sends no session.
- **Criterion 3** holds (the owner, 2026-10-28): with `claude-opus-5-5`'s threshold set to 30 000 on the Settings page, `/binnacle:product` in a second session, in a Russian chat, warned about the Product session started at 19:18, which had more than one run, at 135 653 tokens over 30 000 for `claude-opus-5-5`, by its first start, not its latest run's; today's, so undated. No `(англ.)`, and "пулл-реквест" the one spelling.
- **Criterion 5** holds (the owner, 2026-10-28), ticket 06's script in an interactive Claude Code session at a terminal, with that threshold. Step 1: `/binnacle:product` called the session "this" one; the agent read that from its own scratchpad path, as the MCP tools carry no `own`, and it was true. Step 2: `binn call project_snapshot` gave `own: true` for that session (`2f121931…`) and `false` for the other. Step 3: after `/clear` the id was `684af0f7…`, and the item naming `2f121931…` had `own: false`. Step 4: after `claude --resume 2f121931…`, `own: true` again. The threshold then went back to 250 000, the value before the demonstration, not 100 000, which had been set for a test.
- **Criterion 6** holds (the owner, 2026-10-28), in a Product session: `binn daemon status | grep version` found nothing under `ru_RU`, worked around with `LC_ALL=C`; `binn daemon status --help` failed as an unknown command, worked around with `binn --help`. `/binnacle:checkpoint`, run twice, proposed each as one line for `AGENTS.md` and wrote nothing until the owner's yes; both answers were yes, so the no was not tried; the lines are in `main`'s `AGENTS.md`, `4060f10` and `e04b4a5`.

### For the `/clear` and `--resume` criterion (from ticket 06)

`binn mcp` now sends no session, so through the MCP tools the context-pressure warning says neither "this" nor "another"; `binn call` in the shell still says which. In an interactive Claude Code session on this repository, with a Product session over the threshold:

1. Run `/binnacle:product`: the warning names the session with neither word.
2. Run `binn call project_snapshot` in the shell (`!binn call project_snapshot`): `params.own` is `true` for this session.
3. Run `/clear`, then `binn call project_snapshot` again: `echo $CLAUDE_CODE_SESSION_ID` gives a new id, and an item still naming the session before `/clear` has `params.own` `false`; through `/binnacle:product` it still says neither word.
4. Quit, start `claude --resume <the old id>`, and repeat step 2: `params.own` is `true` for it.

### Review

Run in a sub-agent, 2026-10-28, on the branch's first two commits.

#### Standards

None found: subjects within 72 characters, one author, no trailers; the version moved where 0.4.0's did (`apps/cli/package.json`, `SECURITY.md` and its twin, the test's comment), the remaining `0.4.x` and `0.4.0` are history, and the private packages stay as they are (ADR-0044).

#### Spec

- The exit criterion's `/binnacle:product` in Russian had no script. **Fixed**: in criterion 3's, which now runs in a Russian chat.
- That `binn mcp`'s behaviour across `/clear` and `--resume` is written down had no note. **Fixed**: pointed to `docs/03-mcp-and-skills.md` and ticket 06.
- `git merge` was asked for in criterion 2, after the introduction had already merged; and criterion 2 did not ask for this `ready-for-human` Task among the owner's to start. **Fixed**: the introduction merges with `git merge` while the ticket is `READY`, `DONE` after the criteria; criterion 2 checks both.
- Criterion 3 could not tell the session's start from its latest run's, the difference 0.4.0's demonstration caught. **Fixed**: a session with more than one run.
- Criterion 5 needs a session over the threshold that criterion 3 restored first. **Fixed**: restored after criterion 5.
- Criterion 6 waited for a costly fact to happen. **Fixed**: made on purpose, with a no and a yes each tried once.
- Criterion 4's tick, from the built vault and `vault.test.ts`'s pairs: kept, found justified.
