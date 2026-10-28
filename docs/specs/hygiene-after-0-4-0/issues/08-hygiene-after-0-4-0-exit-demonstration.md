# 08: The exit demonstration of epic 21, and 0.5.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`

**What to build:** epic 21's exit criterion, demonstrated by the owner, then the 0.5.0 release (spec, the exit criterion, *The release*).

- [ ] `/binnacle:task` with a ticket's path, without `run`, gives that Task's brief.
- [ ] A Task whose branch is merged with `git merge` leaves the Tasks in flight, and the Suggested step does not wait for it.
- [ ] A context-pressure warning names its session's own start and the threshold for its model, a number set on the Settings page.
- [x] The vault in Russian has no `(англ.)` for a pair or a failed Graphify run, and says "пулл-реквесты".
- [ ] In an interactive Claude Code session, after `/clear` and after `--resume`, the warning says "this" or "another" only where it is true.
- [ ] `/binnacle:checkpoint` proposes a trap for a fact that cost time in the session, and writes it to `AGENTS.md` only on the owner's yes.
- [ ] The CLI package's version is 0.5.0; 0.5.0 published by `CONTRIBUTING.md`'s *Releasing* and installed from the registry into a clean container, where `binn daemon status` gives 0.5.0.

## Comments

### Run on 2026-10-28

From `feat/hygiene-after-0-4-0-exit-demonstration`, with the built package and a temporary `BINNACLE_HOME` under `.scratch/demo-ru/`, removed afterwards.

- **0.5.0, steps 1 to 4 of *Releasing***: `apps/cli/package.json` is `0.5.0`, and `SECURITY.md` and its twin name `0.5.x`, which `security-policy.test.ts` asked for once the version moved (red first, then green); `pnpm install`, `pnpm typecheck` and `pnpm test` (921 passed) pass; the build writes `@it-bbox/binnacle` 0.5.0 to `apps/cli/dist/`; `node --test apps/cli/test/tarball.live.ts` passes.
- **The built daemon's version**, part of criterion 7: started from `apps/cli/dist/` with `BINNACLE_PORT=0`, `binn daemon status` gives `0.5.0`.
- **Criterion 4** holds. A clone of this repository at `main` (`3926642`) with `knowledge.language: ru`, its `origin` pointing at GitHub, registered under that home with a vault set, and a `graphify` on the daemon's `PATH` that prints a line to stderr and exits 1. The projected `Product/snapshot.md` carries no `(англ.)`; under `## Граф`: "Последний запуск, по `3926642` в …, упал. Graphify сообщил: «graphify: cannot read the corpus: model quota exhausted»"; the CI section's heading reads "### Открытые пулл-реквесты". No graph was built there, so the conflict risk read "нет данных" and no pair was printed: a pair's four wordings beside a failed run, in a Russian vault, with no `(англ.)` and no "пул-реквест", are `vault.test.ts`'s, in the same suite.
- **Part of criterion 6**: `binn call checkpoint_prepare` on that clone lists `{ "type": "trap", "path": "AGENTS.md" }` among its `targets`.
- **Part of criterion 1**: `task_get` given this ticket's path returned `hygiene-after-0-4-0/08`'s brief at the start of this run.
- Found on the way: "Риск конфликта: нет данных — Граф ещё не построен: …" still capitalises the reason after the dash. Left: the roadmap's line for epic 21 names it, the spec does not, so no ticket took it; for the product inbox.

### For the owner

Criteria 1, 2, 3, 5 and 6 need epic 21 in the owner's own Binnacle first: after this branch is merged, *After a pull or a merge* in `CONTRIBUTING.md` (the dashboard regenerated, the daemon restarted, the plugin refreshed).

- **Criterion 1.** In a fresh session: `/binnacle:task docs/specs/hygiene-after-0-4-0/issues/08-hygiene-after-0-4-0-exit-demonstration.md`. It should open with this Task's lines and its `start`, and change nothing.
- **Criterion 2.** Merge this branch into `main` with `git merge` (`--ff-only` or `--no-ff`), then `/binnacle:product` in a fresh Product session: `hygiene-after-0-4-0/08` is not under *In progress* although this session's runs were on its branch, and the Suggested step does not say to wait for its implementation run.
- **Criterion 3.** On the dashboard's Settings page, set a context-pressure threshold for the model of an open Product session below its tokens (or the default, if its model is not listed), and save. A second session's `/binnacle:product` should warn about the first with the threshold as that number, naming its model, and with the session's own start, its date when it is not today. Restore the threshold afterwards.
- **Criterion 5.** Ticket 06's script below, steps 1 to 4: `/clear` and `--resume` in an interactive Claude Code session.
- **Criterion 6.** In a Product session where something cost time (a command that failed for a reason the repository could have warned of), run `/binnacle:checkpoint`. It should propose it as a trap, one line for `AGENTS.md`, and write it only on the owner's yes; a no leaves `AGENTS.md` untouched.
- **Criterion 7.** Push `main` with this branch merged and wait for CI's `check`, `tarball-live` and `autostart-live` to go green there; rebuild at that commit, then `npm whoami` (the 0.4.0 run lost a publish to a lapsed login), `npm publish --dry-run` and `npm publish --access public` from `apps/cli/dist/`, confirming the second factor in the browser. Once `npm view @it-bbox/binnacle version` prints `0.5.0`, in a `node:24-slim` container: `npm i -g @it-bbox/binnacle@0.5.0`, `binn --version`, `binn daemon start`, then `binn daemon status` should give `0.5.0`.

### For the `/clear` and `--resume` criterion (from ticket 06)

`binn mcp` now sends no session, so through the MCP tools the context-pressure warning says neither "this" nor "another"; `binn call` in the shell still says which. In an interactive Claude Code session on this repository, with a Product session over the threshold:

1. Run `/binnacle:product`: the warning names the session with neither word.
2. Run `binn call project_snapshot` in the shell (`!binn call project_snapshot`): `params.own` is `true` for this session.
3. Run `/clear`, then `binn call project_snapshot` again: `echo $CLAUDE_CODE_SESSION_ID` gives a new id, and an item still naming the session before `/clear` has `params.own` `false`; through `/binnacle:product` it still says neither word.
4. Quit, start `claude --resume <the old id>`, and repeat step 2: `params.own` is `true` for it.
