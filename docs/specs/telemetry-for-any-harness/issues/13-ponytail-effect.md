# 13: Ponytail's effect on tokens per completed Task

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** Binnacle dates Ponytail by the first commit on the default branch that adds the word to the project's instruction files, read as one set as the audit reads them. `usage.get` and the dashboard's usage page show the tokens per completed Task for Tasks completed before and after that date, labelled as calculated, or say why there is no comparison (spec, *Ponytail's date*, *Derived metrics*).

- [x] Daemon process tests on a repository whose instruction files gain Ponytail in one commit: the date, its commit, and the means before and after.
- [x] No such commit, or no completed Task on one side, gives the reason.
- [x] The usage page shows the comparison in both languages.

## Comments

### Decisions

- **The shape.** `usage.get`'s `derived` gains `ponytail`, `calculated`, with these fields:
  - `since`, the adoption's commit and its author time;
  - `before` and `after`, each with how many `DONE` Tasks with runs it counts and their mean totals, or null when it counts none;
  - `undated`, the `DONE` Tasks with runs that no commit dates;
  - `reason`, null when both sides have a Task.

  Without a date there are no sides. Like `perCompletedTask`, the field is unavailable, with the tracker's reason, when the tracker cannot be read. The Tasks are those of `perCompletedTask`: a `DONE` Task without runs has no tokens to average.
- **Ponytail's date.** It is the oldest commit reachable from the default branch, `origin/HEAD`'s or else `main`, as for the runs' roles, whose own diff of `AGENTS.md` or `CLAUDE.md` adds a line naming Ponytail, in any case.
  - The audit reads those two root files as its sets (`instructionSets`), and an import between them makes one set. Searching both files is reading that set, so the date does not depend on which file names the word.
  - A commit on a branch that was never merged does not count.
  - Git's `-G`, oldest first, finds it. No earlier commit holds the word, so the first commit that changes such a line is the one that adds it.
- **A Task's date** is the newest commit on the default branch whose diff of its ticket adds or removes a `Status: DONE` line. For a Task that is `DONE` now, that is the commit that set it so.
  - A Task is before Ponytail when that commit's author time is earlier than Ponytail's, and after it otherwise. A Task set `DONE` in the adoption's own commit counts as after.
  - A ticket that is `DONE` in the checkout but was never committed so is `undated`, and is on neither side.
- **The reasons** are fixed texts, `PONYTAIL_REASONS` in `apps/daemon/src/usage.ts`, so the dashboard translates each one through its `daemonReasons`. The i18n test checks that every one of them is known.
  - `noCommit`: no commit names the word.
  - `unread`: Git cannot read the default branch.
  - `noneBefore`, `noneAfter` and `neither`: a side, or both sides, have no dated Task.
  - `remote`: a question that blocked nothing, answered in the smallest way the spec allows. On GitHub or GitLab a Task is `DONE` by its issue, never by a commit, so no Task is placed on either side, and this reason says so.
- **The dashboard.** The usage page's *Derived metrics* card, under its calculated badge, shows each side's mean of the kind picked for the bars. Below that it gives how many Tasks each side counts, the date and short commit, the undated count, and the reason. Both dictionaries have the new strings.
- **The adapter.** `readFirstReviews` and the two new readers, `readFirstMention` and `readDoneCommits`, share one `git log -G` reader. Every revision is a hash and every path a literal pathspec, as the adapter's contract requires.
- **Docs.** `docs/04-telemetry-dashboard.md` lists the comparison on the usage page and among the high-value derived metrics. The MCP description of `usage_get` names it.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard finding.** Findings:

1. **A remote tracker's Tasks were all undated, with the `neither` reason**, which wrongly suggested that a commit was missing. Both axes raised this. **Fixed**: the `remote` reason, with a daemon test on a GitHub tracker.
2. **`oneDecimal =(`** had lost a space on the usage page. **Fixed.**
3. **The pattern was escaped although its only caller passes one constant word.** **Fixed**: `readFirstMention` takes a pattern.
4. **Author times compare the sides**, so a ticket set `DONE` before Ponytail and merged after it counts as before. **Kept**, and named in a comment: the author time is the one a rebase keeps, as for the Review.
5. **A later commit that only moves a `Status: DONE` line would re-date its Task.** **Left**: nothing writes the header that way.
6. **Possible Duplicated Code**, the `:(top,literal)` mapping in two readers, and **a possible Data Clump**, `{ commit, at }`. **Kept**: each is one line, and a named type would be its only use.
7. **`perTask` became `async`, and carries `ticket` only to hand it to `ponytailEffect`.** **Kept**: the comparison uses that function's own list of completed Tasks, and splitting it would compute that list twice.
8. **`head === null` is checked twice.** **Kept**: the undated count is needed with or without a date.

**Spec: no missing requirement.** Findings:

1. **Not every reason is tested**: `noneBefore`, `neither` and `unread` have none. **Left**: they are branches of the same expression as `noneAfter` and `remote`, which are tested.
2. **"What they import" is not followed beyond the two files.** **Kept**: the audit's sets hold only `AGENTS.md` and `CLAUDE.md`, and `instructionSets` follows imports between those two alone.
3. **A case-insensitive substring is matched, not the whole word**, so `ponytails` would count. **Kept**, and named in a `ponytail:` comment, with a whole-word match as the upgrade path.
4. **Scope additions**: `undated`, `neither`, and the shared reader under `readFirstReviews`. **Kept**: they explain an empty side, and the reader's behaviour is unchanged, as its tests show.

### Verified by hand

The usage page was checked on a temporary daemon. Its demo repository had three Tasks, one completed before Ponytail and two after. In English the page reads "Before 137 · After 70", with the date and commit. In Russian it reads "До 137 · После 70". Before the import had reached a record, it showed the `neither` reason in Russian.
