# 03: The audit test no longer races the package build

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/lean-flow/spec.md`

**What to build:** a defect of epic 11's run (spec, *The flaky test*). The audit's test "Binnacle's skills current, or not installed at all, are not reported" fails now and then in a full run and passes alone, most likely because the package build's test rebuilds the skills copy while the audit reads it. Find the shared state and remove it, so that each test reads or writes a copy of its own; no retry, no serial run.

- [x] The cause is named in the ticket's comments, with how it was shown.
- [x] The two tests share no file or directory that either writes.
- [x] `pnpm test` passes ten times in a row on this repository.

## Comments

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground. The ticket names no role beyond the Developer and the Reviewer.

**Standards: no hard violation.** To fix, all fixed:

1. **Mysterious Name** **Fixed** in 9ac27b1. (`apps/cli/test/pack.test.ts`, `built`): it returns the build directories' times, not what was built. Fix: a name that says so.
2. **Duplicated Code** **Fixed** in 9ac27b1. (same file): `plugin` and `skills` are listed twice, in the times taken and in the copy's filter, so one can change without the other. Fix: one constant both read.
3. **A check that can pass on nothing** **Fixed** in 9ac27b1. (same file): `birthtimeNs` is `0n` on a filesystem without a birth time, where a rebuild would go unseen. Fix: the directories' `ctimeNs`, which every filesystem keeps and a rebuild changes.

Kept:

4. The check that packing leaves the package's own `plugin/` and `skills/` as they were is not asked for by the ticket: it is the test that failed before the fix and pins the second criterion, so it stays.
5. It would fail if someone rebuilt the package by hand during a run: nothing in the suite does, and such a rebuild is the race this ticket removes.
6. The copy has no `pnpm-workspace.yaml` above it, and `pnpm pack` resolves `workspace:*` through the linked `node_modules`: the test's comment says so, and `pnpm pack` fails loudly, not silently, if that changes.

**Spec.** Nothing to fix: the diff touches one test file, with no retry or serial run, and no other test writes `apps/cli/plugin`, `apps/cli/skills` or anything else the audit reads. The first criterion, the cause in these comments, and the ten runs are this ticket's last commit's.

**In all**: three findings fixed, three kept. The typecheck passes, and `pnpm test`, 711 tests, passed ten times in a row after the fixes.

### The cause

`pnpm pack`, which the package build's test (`apps/cli/test/pack.test.ts`) ran in `apps/cli`, runs the package's `prepare` script, `node src/prepare.ts`. It removes `apps/cli/plugin` and `apps/cli/skills` and writes them again, skill by skill. The audit's tests run `binn audit`, whose `binnacleSkills()` (`apps/cli/src/tools.ts`) reads that same `apps/cli/skills` as the package's copy. Run side by side, as `pnpm test` runs its files, the audit could read the copy half written, take a skill's version as missing or different, and report the current skills as stale.

How it was shown:

- `stat` of `apps/cli/skills` before and after `pnpm pack` in `apps/cli`: the prepare script ran, and the directory and its files had new times.
- The audit's skills tests run five times against a loop of `node apps/cli/src/prepare.ts`: one run failed, this ticket's test with `1 !== 0` (a stale finding for current skills) and its sibling, the partly missing skills, with `0 !== 1`. Without the loop, three runs passed.
- The pack test's new check, that packing leaves the package's own `plugin/` and `skills/` as they were, failed before the fix and passes after it.

The fix is the package build's test's: it packs a copy of the package and of the plugin's source in a temporary directory of its own, with `node_modules` linked so that `pnpm pack` resolves `workspace:*`, so nothing in the suite writes the package's `plugin/` or `skills/` any more. No other test writes them: the others build the copy only in temporary directories, and `init.test.ts` only reads it.
