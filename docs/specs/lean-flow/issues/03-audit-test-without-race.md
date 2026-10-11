# 03: The audit test no longer races the package build

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/lean-flow/spec.md`

**What to build:** a defect of epic 11's run (spec, *The flaky test*). The audit's test "Binnacle's skills current, or not installed at all, are not reported" fails now and then in a full run and passes alone, most likely because the package build's test rebuilds the skills copy while the audit reads it. Find the shared state and remove it, so that each test reads or writes a copy of its own; no retry, no serial run.

- [ ] The cause is named in the ticket's comments, with how it was shown.
- [ ] The two tests share no file or directory that either writes.
- [ ] `pnpm test` passes ten times in a row on this repository.
