# 09: A compact Usage page, as in the mockup

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** found by the owner in the exit demonstration (ticket 06, *Comments*): the Usage page is much taller than the mockup's. Its rows take two lines each (a name, then a Task's title and a record count), and its token table adds an import-window column and a records row. The page takes the mockup's density: one line per row, with the extra facts still one hover away, so nothing epic 5 showed is lost. Decided in the spec, under *Further Notes*.

- [ ] Every bar row (by model, by provider, by Task, by role, unassigned) is one line: the name, the bar and the figure. A Task row names its id; its title and every row's record count are in a tooltip on the row.
- [ ] *Tokens by kind* has the mockup's two columns, today and the last seven days. The import window's totals and the record counts move to one line under the table, and are not dropped.
- [ ] The "Bars show" switch, the derived metrics, the weekly trend, the harnesses and cost keep what ticket 05 gave them, in the mockup's spacing.
- [ ] Partial, calculated and estimated marks, "not reported" and "Not available" with their reasons all stay.
- [ ] At the same window height, the page shows at least as much as the mockup's Usage page. A human checks this beside the mockup; the steps are under `## Comments`.
