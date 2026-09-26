# 05: The Usage, Projects and Attention pages, to the mockup

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** the remaining pages are rebuilt to the mockup in both languages, keeping everything epic 5 showed, and the old plain CSS is gone. Decided in the spec, under *The shell and pages*.

- [ ] The Usage page shows today's and the last seven days' tokens by kind: input, cached input, cache creation, output, and reasoning as the part of output it is. A `null` is "not reported", and a partial total is marked partial.
- [ ] The Usage page shows usage by model, by provider (with a provider no artifact states as "not reported"), by Task (the largest, with the unassigned total) and by role.
- [ ] The derived metrics are labelled as Binnacle's calculation: tokens per completed Task, runs per Task, and a weekly trend drawn as CSS bars.
- [ ] Each harness shows its support level named as in `CONTEXT.md` (Context, Attribution, Usage, Live), or the daemon's reason for none. Cost shows "Not available" with its reason.
- [ ] The Projects page lists every registered project: name, path, current epic and status, the Next action in short, runs running now, and attention count. A project whose path is unavailable shows its reason.
- [ ] The Attention page lists every attention item of every project, grouped by project, with codes, beside the running and recent runs.
- [ ] The three pages read well in English and Russian, in both themes and at 1024 px.
- [ ] No page uses epic 5's plain CSS or its unused components any more, and they are removed.
- [ ] `docs/04-telemetry-dashboard.md` describes the views as rebuilt and the two languages.
