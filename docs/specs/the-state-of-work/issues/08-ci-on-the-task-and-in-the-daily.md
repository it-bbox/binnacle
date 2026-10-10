# 08: CI on the Task and in the daily

Status: READY
Triage: ready-for-agent
Blocked by: 07
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer

**What to build:** `task_get` gains `request`: the Task's pull or merge request, mapped by its branch, with its CI state, or null, or unavailable with the forge's reason; `/binnacle:task` and the Task page show it. The daily carries the `ci` section as of now; `/binnacle:daily` presents it and the vault's daily note carries it (spec, *`task_get`* and *The `ci` section*).

- [ ] Loopback-forge tests: a Task with a request and its state, one without, and the forge unreadable.
- [ ] `daily_get` carries the `ci` section; `daily.test.ts` covers it; the vault's daily note carries it.
- [ ] `/binnacle:task` and `/binnacle:daily` (plugin and copy) present it.
- [ ] The Task page shows the request and its CI state, strings in English and Russian, checked in a browser.
