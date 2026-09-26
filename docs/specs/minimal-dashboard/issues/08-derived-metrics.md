# 08: Derived metrics

Status: READY
Triage: ready-for-agent
Blocked by: 07
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** the Usage page adds tokens per completed Task, runs per Task and a weekly trend, each labelled as Binnacle's calculation, and `usage_get` carries them too. Decided in the spec, under *Derived metrics in `usage.get`*.

- [ ] `usage.get` without a Task gains `derived`, with each part `calculated`:
  - **Per completed Task**: each `DONE` Task's totals and run count, largest first, with the section limit and a remainder. Their mean, per field. The count of `DONE` Tasks without runs, which the mean leaves out.
  - **Runs per Task**: each Task's runs, how many of them were subagents', and the mean.
  - **Weekly**: totals per calendar week over the window, with weeks starting on Monday in the daemon's time zone.
- [ ] Fields are never added to one another, and a mean follows the totals' rules for `null` and `partial`.
- [ ] The Usage page shows the three, each labelled as Binnacle's calculation, with the weekly trend as CSS bars.
- [ ] Tests through the daemon seam cover:
  - a mean over `DONE` Tasks, with one left out for having no runs;
  - subagent runs counted apart;
  - weeks split at Monday;
  - `null` and `partial` carried through.
