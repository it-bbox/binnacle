# 03: The audit test no longer races the package build

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/lean-flow/spec.md`

**What to build:** a defect of epic 11's run (spec, *The flaky test*). The audit's test "Binnacle's skills current, or not installed at all, are not reported" fails now and then in a full run and passes alone, most likely because the package build's test rebuilds the skills copy while the audit reads it. Find the shared state and remove it, so that each test reads or writes a copy of its own; no retry, no serial run.

- [ ] The cause is named in the ticket's comments, with how it was shown.
- [ ] The two tests share no file or directory that either writes.
- [ ] `pnpm test` passes ten times in a row on this repository.

## Comments

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground. The ticket names no role beyond the Developer and the Reviewer.

**Standards: no hard violation.** To fix:

1. **Mysterious Name** (`apps/cli/test/pack.test.ts`, `built`): it returns the build directories' times, not what was built. Fix: a name that says so.
2. **Duplicated Code** (same file): `plugin` and `skills` are listed twice, in the times taken and in the copy's filter, so one can change without the other. Fix: one constant both read.
3. **A check that can pass on nothing** (same file): `birthtimeNs` is `0n` on a filesystem without a birth time, where a rebuild would go unseen. Fix: the directories' `ctimeNs`, which every filesystem keeps and a rebuild changes.

Kept:

4. The check that packing leaves the package's own `plugin/` and `skills/` as they were is not asked for by the ticket: it is the test that failed before the fix and pins the second criterion, so it stays.
5. It would fail if someone rebuilt the package by hand during a run: nothing in the suite does, and such a rebuild is the race this ticket removes.
6. The copy has no `pnpm-workspace.yaml` above it, and `pnpm pack` resolves `workspace:*` through the linked `node_modules`: the test's comment says so, and `pnpm pack` fails loudly, not silently, if that changes.

**Spec.** Nothing to fix: the diff touches one test file, with no retry or serial run, and no other test writes `apps/cli/plugin`, `apps/cli/skills` or anything else the audit reads. The first criterion, the cause in these comments, and the ten runs are this ticket's last commit's.
