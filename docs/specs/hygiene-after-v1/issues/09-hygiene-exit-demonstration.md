# 09: The exit demonstration of epic 20, and 0.4.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08
Spec: `docs/specs/hygiene-after-v1/spec.md`

**What to build:** epic 20's exit criterion, demonstrated by the owner, then the 0.4.0 release (spec, the exit criterion, *The release*).

- [ ] An autopilot run or a checkpoint commits the roadmap's derived part without a question and asks only about the focus and the `Next action:`.
- [ ] A second Claude Code session's context-pressure warning, read from the first, names it as another Product session by its times.
- [ ] `/binnacle:product` in a Russian chat has no English domain term and no wrong plural; the vault in Russian has no `(англ.)` for a Suggested step or the graph.
- [ ] `/binnacle:roadmap` on this repository proposes epics from the product inbox.
- [ ] The CLI package's version is 0.4.0; 0.4.0 published by `CONTRIBUTING.md`'s *Releasing* and installed from the registry into a clean container, where `binn daemon status` gives 0.4.0.

## Comments

- Run on 2026-10-28, from `feat/hygiene-exit-demonstration`, with the built package and a temporary `BINNACLE_HOME` under `.scratch/demo-ru/`, removed afterwards:
  - **0.4.0, steps 1 to 4 of *Releasing***: `apps/cli/package.json` is `0.4.0`, and `SECURITY.md` and its twin name `0.4.x` as the supported line, which `security-policy.test.ts` asked for once the version moved; `pnpm install`, `pnpm typecheck` and `pnpm test` (904 passed) pass; the build writes `@it-bbox/binnacle` 0.4.0 to `apps/cli/dist/`; `node --test apps/cli/test/tarball.live.ts` passes.
  - **The built daemon's version**, part of criterion 5: started from `apps/cli/dist/` with `BINNACLE_PORT=0`, `binn daemon status` gives `0.4.0`. From the source checkout it is `smoke.test.ts`'s, in the same suite: the daemon run from source reports the CLI package's version, now `0.4.0`.
  - **The rest of the spec's exit criterion**, which no criterion names: the sanitizer is `audit.test.ts`'s, in the same suite; TypeScript 7 compiles the workspace in `pnpm typecheck`; pull request #4 is `CLOSED` on GitHub since 2026-10-24.
  - **The Russian vault**, part of criterion 3, holds: a local clone of this repository with `knowledge.language: ru`, registered under that home with a vault set. The projected `Product/snapshot.md` words the Suggested step in Russian ("…готова к старту и в триаже ready-for-human: её делает владелец, а не агент") and the graph's reason too ("Граф ещё не построен: graphify-out/graph.json нет"); no generated line carries `(англ.)`, only the copied documents that write the marker as text. A failed Graphify run's output was not exercised: no run failed.
- Found on the way:
  - The Russian vault said the graph's absence twice: "Графа нет: Граф ещё не построен: …". **Fixed** on this branch: under `## Граф` the reason stands alone (`vault-text.ts`), and `vault.test.ts` asks for it.
  - A reason after a dash keeps its capital: "Риск конфликта: нет данных — Граф ещё не построен: …". Left: a style slip, not an English term or a wrong plural, for the product inbox.
  - `/binnacle:task <ticket path>` without `run` reads no Task: recorded in the product inbox on 2026-10-28, with the `Next action:` that wrote it so.
- For the owner, the criteria an agent cannot check. Criteria 1 to 4 need epic 20 in the owner's own Binnacle first: after the merge, *After a pull or a merge* in `CONTRIBUTING.md` (the dashboard regenerated, the daemon restarted, the plugin refreshed).
  - **Criterion 1, last.** It needs this ticket's `Status: DONE` on `main`, so it is checked after the others are ticked and `DONE` is merged: then every ticket of epic 20 is done and the roadmap still says `in progress`. Run `/binnacle:checkpoint` in a fresh Product session: it should commit the status column (epic 20 `done`) and the *Done* line (epics 1 to 20) without asking, and ask only about the focus's prose and the `Next action:`. The same Product session ticks criterion 1 here, on `main`, in a commit of its own.
  - **Criterion 2.** Open a Claude Code Product session on this repository and keep it open; open a second and run `/binnacle:product` there. While the first is over `telemetry.context_pressure.tokens` (250 000 here; lower it for the check in the working tree, uncommitted, and restore it), the second's attention item should name the first as another Product session, with when it started and its latest activity, and the first's `/binnacle:product` should name its own warning as this session. Beside it, from the inbox: whether `binn mcp` keeps the session's id across `/clear` and `--resume`.
  - **Criterion 3.** `/binnacle:product` in a fresh Russian session: no English domain term (пулл-реквест, not "pull request") and plurals that agree ("3 запуска, два из них"). With the threshold lowered as for criterion 2, the context-pressure line should give the number, not the key `telemetry.context_pressure.tokens`, and no reason should stand in English.
  - **Criterion 4.** `/binnacle:roadmap` in a Product session on this repository: it should propose an epic, or a part of one, for each product inbox entry not yet planned (such as *Session start, agent configuration and traps*, *A context-pressure threshold per model*, *Binnacle in a dev container*, *The ticket brief takes a ticket's path*), and mark an entry taken only on the owner's yes.
  - **Criterion 5.** Push `main` with this branch merged and wait for CI's `check`, `tarball-live` and `autostart-live` to go green there; rebuild at that commit, then `npm publish --dry-run` and `npm publish --access public` from `apps/cli/dist/`, confirming the second factor in the browser. Once `npm view @it-bbox/binnacle version` prints `0.4.0`, in a `node:24-slim` container: `npm i -g @it-bbox/binnacle@0.4.0`, `binn --version`, `binn daemon start`, then `binn daemon status` should give `0.4.0`.

### Review

Run in a sub-agent, 2026-10-28, on the branch's first two commits.

#### Standards

- The second commit's subject ran to 75 characters. **Fixed**: reworded before anything else was built on it.
- The version moves where it must: `apps/cli/package.json`, `SECURITY.md` and its twin, and the test's comment; the other `0.3.x` and `0.3.0` are history, kept. The private packages stay as they are (ADR-0044). Authorship and twins: none found.

#### Spec

- Criterion 1's script could not run before `DONE`, which it needs. **Fixed**: checked last, after the merge, and ticked by the Product session that runs the checkpoint.
- The exit criterion's sanitizer, source-checkout version and pull request #4 had no criterion and no note. **Fixed** in the run notes: the two tests that pin them, and #4 read as `CLOSED`.
- Criterion 2's script checked only the other session, criterion 3's only the terms and plurals. **Fixed**: this session's own warning, and the context-pressure line's number and reasons, added.
- "Графа нет: Граф ещё не построен" in the Russian vault, fixed by a test that pinned it. **Fixed** on this branch; the capital after a dash left, above.
