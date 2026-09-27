# 09: A compact Usage page, as in the mockup

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** found by the owner in the exit demonstration (ticket 06, *Comments*): the Usage page is much taller than the mockup's. Its rows take two lines each (a name, then a Task's title and a record count), and its token table adds an import-window column and a records row. The page takes the mockup's density: one line per row, with the extra facts still one hover away, so nothing epic 5 showed is lost. Decided in the spec, under *Further Notes*.

- [x] Every bar row (by model, by provider, by Task, by role, unassigned) is one line: the name, the bar and the figure. A Task row names its id; its title and every row's record count are in a tooltip on the row.
- [x] *Tokens by kind* has the mockup's two columns, today and the last seven days. The import window's totals and the record counts move to one line under the table, and are not dropped.
- [x] The "Bars show" switch, the derived metrics, the weekly trend, the harnesses and cost keep what ticket 05 gave them, in the mockup's spacing.
- [x] Partial, calculated and estimated marks, "not reported" and "Not available" with their reasons all stay.
- [ ] At the same window height, the page shows at least as much as the mockup's Usage page. A human checks this beside the mockup; the steps are under `## Comments`.

## Comments

- **Where it lives.** `apps/dashboard/app/components/BarList.vue` draws every bar row on one line: the name, a bar 6 px high as in the mockup, and the figure with its marks. A row's `title` (a Task's title, the repository's text) and its `note` (the record count, or a derived row's runs or subagent runs) are the row's tooltip, the browser's own `title` as elsewhere on the dashboard, and are also in a screen-reader-only span, with the title marked `lang="en"`. `TokenKinds.vue` takes `records`, true unless a page gives the counts elsewhere, so the Project and Task pages keep their records row. `apps/dashboard/app/pages/usage.vue` passes today and the last seven days and `records: false`, and writes the line under the table from `tokensLine`. That function is in `composables/usage.ts` and is shared with the Task page's run line. `docs/04-telemetry-dashboard.md` describes the page as it now is.
- **Decided here, where the ticket and spec are silent:**
  - **The line under the table** reads: `Import window, since <date>: <n> records · Input … · … · of which reasoning …. Records: today <n> · last 7 days <n>.` A kind not reported says so, and a partial, calculated or estimated total carries its mark in brackets. It is one paragraph and wraps at a card's width, since five kinds and three counts do not fit on one visual line of a 400 to 550 px card. While `usage.get` loads or fails, the line has only today's and the last seven days' counts, as the window's column was missing before. The failure itself shows on By Task and on the derived metrics.
  - **The derived metrics' rows** are bar rows too. Their run and subagent counts go into the tooltip with the record counts, one hover away like the other extra facts.
  - **The mockup's spacing.** The "Bars show" switch sits on the heading's line, at its right, because the mockup's heading line has room and no switch. The derived metrics join the grid after By Task, where the mockup puts them, instead of spanning the width below it. Rows are 7 px by 14 px, as in the mockup.
  - **No test.** The spec's *Testing Decisions* leave the pages unautomated. A helper test was tried first, but the root typecheck cannot reach the dashboard's composables, which import through Nuxt's aliases.
- **Verified in a browser.** The generated dashboard ran against a daemon on a temporary `BINNACLE_HOME` and port, with this worktree registered, beside the mockup served locally. Checked in Russian at 1440 × 900, dark, and in English at 1024 × 768, light. Every bar row measured 30 to 31 px, one line. The tooltips carried a Task's title and every row's record count. The line under *Tokens by kind* had the window's totals with the partial mark, and a Task's run line on the Task page read as before. At 1024 px nothing scrolled sideways. The screen-reader spans first stretched the document by 254 px, which gave it a sideways scrollbar, until the row's label cell was made `relative`. Not seen live: a row with a remainder, a derived row per completed Task (no `DONE` Task of this worktree has runs), and a kind not reported in the window.
- **For the owner: the criterion left unticked.** Whether the page shows as much as the mockup's at the same height depends on judgement and on the data, so only a human checks it:
  1. `pnpm dashboard:generate`, then `binn dashboard`, and open Usage.
  2. Serve the mockup: `python3 -m http.server 8000` in `docs/specs/dashboard-design-and-languages/design/`. Open `http://127.0.0.1:8000/Binnacle%20Dashboard.dc.html` in a second window of the same size, and click Usage in its sidebar.
  3. Size both windows alike, for example 1440 × 900, and compare them without scrolling. Every bar row is one line in both. The dashboard shows at least as much of the page: Tokens by kind, By model and By provider, By Task and By role, and the start of the derived metrics. Allow for the difference in data, such as how many Tasks, models and weeks each has.
  4. Hover a Task row: its title and record count appear. Hover a model row: its record count appears. Read the line under *Tokens by kind*: the import window's totals and each period's records are there.
  5. Repeat at 1024 px wide and in the other theme and language. Nothing overlaps, and nothing scrolls sideways.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground, after the rebase onto ticket 07. There were no conflicts, because ticket 07 touched the shell and the Task page's prose.

**Standards: no hard violations.** Authorship, the documentation's language, ADR-0007's "not reported" and marks, and the dictionary in both languages hold. Judgement calls:

1. **Duplicated Code.** The import window's line repeated the Task page's `tokensLine`, the same kinds with the same "not reported" and marks. **Fixed**: `tokensLine` moved into `composables/usage.ts` beside `marks`, and both pages call it. The window's line now puts reasoning after ` · `, as the Task page does.
2. **`TokenKinds`'s `records` flag serves one caller.** **Kept**: a flag with a real use and a comment. The alternative, a second table component, is larger.

**Spec: criteria 1 to 4 hold.** Findings:

3. **The line under the table wraps.** Its 180 or so characters fill two or three lines of a card. **Kept**, as one paragraph: see *Decided here*.
4. **The derived per-Task rows' run and subagent counts moved into the tooltip**, where the spec's note names only record counts and titles. **Kept**: the ticket asks for the extra facts one hover away, and a second line on those rows would undo the density the page gains.
5. **`docs/04-telemetry-dashboard.md` still said "the largest first"**, which ticket 05's review corrected. **Fixed**: "the largest Tasks".
6. **The window's totals are missing while `usage.get` loads or fails.** **Kept**: the same as before, when the window's column was missing. The failure shows on the cards that depend on it.
