# 13: Ponytail's effect on tokens per completed Task

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** Binnacle dates Ponytail by the first commit on the default branch that adds the word to the project's instruction files, read as one set as the audit reads them, and `usage.get` and the dashboard's usage page show tokens per completed Task completed before and after it, labelled as calculated, or why there is no comparison (spec, *Ponytail's date*, *Derived metrics*).

- [ ] Daemon process tests on a repository whose instruction files gain Ponytail in one commit: the date, its commit, and the means before and after.
- [ ] No such commit, or no completed Task on one side, gives the reason.
- [ ] The usage page shows the comparison in both languages.

## Comments
