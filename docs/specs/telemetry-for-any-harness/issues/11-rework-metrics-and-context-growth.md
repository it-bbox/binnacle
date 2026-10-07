# 11: Rework share, first-pass acceptance and context growth

Status: READY
Triage: ready-for-agent
Blocked by: 09
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** `usage.get`'s derived metrics gain the rework share and first-pass review acceptance per completed Task and their mean, and each run its context growth — the context of its first, latest and largest call — all labelled as calculated (spec, *Derived metrics*). The dashboard's usage page shows them under its calculated heading, in both languages.

- [ ] Daemon process tests: the rework share and first-pass acceptance of a repository with Tasks reviewed with and without fixes.
- [ ] A run's first, latest and largest context, with nulls where a harness does not report a count.
- [ ] The usage page shows the three, labelled as calculated.

## Comments
