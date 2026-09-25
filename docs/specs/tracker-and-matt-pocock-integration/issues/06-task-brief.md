# 06: The task brief — `task.get`, `task_get` and `/binnacle:task`

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** a session starts one Task with `/binnacle:task <id>` and gets a compact brief: the Task's fields, its dependencies with their titles and states, its spec's path, the ticket body without comments, and the branch name. It works on the local tracker and on GitHub. Decided in the spec, under *Task brief*, and *`task_get` and `/binnacle:task`*.

- [x] `task.get` takes the caller's path and an id: `<spec-slug>/<NN>` on the local tracker, `#<number>` or `<number>` on a remote one.
- [x] It returns identity, title, state, triage, ticket path or URL, the spec path as `Spec:` gives it, and each declared dependency with its title, state and whether it is met; a dangling one says so.
- [x] The body is the text after the header block, up to the first `## Comments` heading on the local tracker, and the issue body after the header block on a remote one. It is cut at a fixed limit in code points with a truncation flag. Issue comments are never read.
- [x] The branch name is `feat/<slug>` from the ticket's file name on the local tracker, and `feat/<number>-<slug>` from the issue title on a remote one: lowercased, runs of characters other than ASCII letters and digits turned into one hyphen, hyphens trimmed, cut to a fixed length.
- [x] An unknown id is an error with code `task.not_found`; an unreadable tracker is an error carrying its tracker code.
- [x] On the local tracker the ticket is read from the caller's checkout.
- [x] `task_get` takes `id` and maps one-to-one onto `task.get`. The existing MCP smoke test lists it and calls it once.
- [x] The `binnacle` plugin gains a `task` skill: detect, `task_get`, present the brief, state the branch name. It creates no branch, edits no `Status:`, and runs only when a human starts it.
- [x] `docs/03-mcp-and-skills.md` lists `/binnacle:task` among the plugin's actions.
- [x] Tests through the daemon seam on both trackers: dependencies in each case, the body cut, comments excluded, both branch forms, both errors.

## Comments

- **What changed.** `task.get` is in `apps/daemon/src/operations.ts`, and the brief is built by `taskBrief` in `apps/daemon/src/task.ts`, with `BODY_LIMIT` at 8000 code points. `TrackerTask` gained `body`. It is the text after the header block, computed by the new `ticketBody` in `packages/core/src/tracker.ts`. That function reads the header block with the same code as `parseTicketHeader`. The local adapter cuts the text at the first `## Comments` heading before calling it. `taskBranch` and `BRANCH_SLUG_LIMIT`, which is 50, are there too. The daemon picks the tracker adapter in `readTracker`, in `apps/daemon/src/snapshot.ts`, which both the snapshot and the brief call. `cut` in the same file is the code-point cut that the focus and the body share. `task_get` is in `packages/mcp/src/index.ts`. The skill is `.claude/skills/binnacle/skills/task/SKILL.md`. The tests are `apps/daemon/test/task.test.ts`, a new `describe` in each of `apps/daemon/test/github.test.ts` and `gitlab.test.ts`, the MCP smoke test and the write-guarantee test's input table.
- **The brief's shape.** It returns `id`, `title`, `state`, `triage`, `ticket`, `spec`, `dependencies` and `body`, plus `branch`. Each item in `dependencies` is `{ id, title, state, met, dangling }`, and `body` is `{ text, truncated }`. The brief carries no attention items.
- **Rebased onto tickets 03, 04, 05 and 08.** Those tickets merged while this ticket was in progress, so the branch was rebased onto them. `TrackerTask.body` is required. `toTask` in `packages/adapters/src/remote-tracker.ts` sets it from the issue body, which is the GitLab description, so GitHub and GitLab issues both carry one. `readTracker(home, tree, manifest)` picks the reader for `local`, `github` or `gitlab`, and for a remote tracker it looks up ticket 03's token first. So `task.get` reads with the same credentials as the snapshot, and it answers with `tracker.credentials_insecure` as its error. `readTasks`, which ticket 05 exported, now calls `readTracker`. A test through the GitLab stand-in in `apps/daemon/test/gitlab.test.ts` covers the brief on GitLab: `#<n>`, the dependencies, the body and the branch. The epic 3 paragraph of the roadmap's current focus was condensed, so the focus stays under its 2000-character limit.
- **For ticket 12.** `/binnacle:task` has no automated test (spec, *Not automated*). The exit demonstration checks it by hand:
  1. With the daemon running, start a fresh Claude Code session in this repository and run `/binnacle:task tracker-and-matt-pocock-integration/06`. The brief shows this ticket: `DONE`, dependency `02` met, the spec path, and the body without `## Comments`. It ends with "The branch for this Task is `feat/task-brief`."
  2. Check `git status` and `git branch`: nothing has changed and there is no new branch.
  3. Run `/binnacle:task tracker-and-matt-pocock-integration/99`. It reports `task.not_found`.
  4. On a GitHub project, run `/binnacle:task #<n>` for an issue. The branch is `feat/<n>-<slug of the title>`.
  5. Confirm that the model never starts `/binnacle:task` on its own, because its frontmatter has `disable-model-invocation: true`.
- **Questions answered in the smallest way the spec allows.**
  - *Is the leading heading part of the body?* No. The body starts after the header block, and the heading comes before it. The heading is already in the brief as `title`.
  - *What is the body of a ticket or issue with no header?* The whole text. The parser's rule treats the first run of non-blank lines as the header block, and that would drop the first paragraph of a hand-filed issue. So a block with no header field is not a header. A line of prose inside a real header block is still dropped, as "after the header block" says.
  - *Is a dangling dependency met?* It is neither. It has `met: null` and `dangling: true`. The snapshot never counts a dangling dependency as unmet, because a typo must not block work, so it cannot be `met: false` here either.
  - *Do the slug rules apply to the local branch name?* The character rules do: lowercase, and one hyphen for each run of other characters. They leave this repository's file names unchanged. The length cut does not apply. The spec gives the local slug as the file name, and epic 4 maps a local branch back by that file slug, which a cut would break. A slug with nothing left after the rules falls back to the number: `feat/<number>` on either tracker.
  - *Which id forms are accepted?* The number is compared, not the digits as written. `epic/6` is `epic/06`, and `#05` or `5` is `#5`, as the local tracker already normalises ticket numbers. An id in the other tracker's form is `task.not_found`.
  - *Is a missing issues directory a broken tracker or an unknown id?* A broken tracker. `task.get` answers with `tracker.issues_missing` (503), so that a typo can be told apart from a broken tracker (story 44). The snapshot and the daily still read the missing directory as no Tasks, as they did before.
  - *What HTTP status does a tracker failure get?* 503 for every tracker code, and 404 for `task.not_found`. The code is the contract.

### Review

`/code-review` ran against `main` on both axes.

**Standards: no hard violations, and ten judgement calls.**

1. A dangling dependency came back as `met: false`, while the core contract never counts it as unmet. **Fixed**: it is now `met: null`, with `dangling: true`, and the skill says so.
2. `taskBrief` repeats `resolveDependencies`'s lookup by id and its `DONE` rule. **Kept**: the brief needs each dependency's title and state, which `unmetDependencies` does not carry.
3. The code-point cut was written twice, once for the focus and once for the body. **Fixed**: `cut` in `snapshot.ts` now serves both.
4. `ticketBody` listed the header fields a second time, against the rule from the last review to keep that list in one place. **Fixed**: `readHeader` now reports whether its block held a field.
5. `readTracker` is exported from `snapshot.ts`. **Kept**: that module already reads a project's state for the snapshot and the daily, and a new module for one function is more surface than it saves.
6. `taskBranch(task, remote: boolean)` takes a flag argument. **Kept**: there are only two forms, and the parameter's name says what the flag means.
7. `task.get` checked its `id` inline. **Fixed**: it now uses a `taskId(body)` helper, like `sinceCommit`.
8. The two test files each declare the brief's type and a `taskGet` helper. **Kept**: each test file is self-contained, as `snapshot.test.ts` and `github.test.ts` already are.
9. `parseTicketHeader` became an arrow function. **Fixed**: it is a `function` again.
10. The tests import `BODY_LIMIT` and `BRANCH_SLUG_LIMIT`. **Kept**: the tests need to know the limits. Importing them does not tie a test to which function ran.

**Spec: every criterion is met, and nothing is missing.**

1. The id forms are lenient: `epic/6` and `#05` are accepted. **Kept**, as answered above.
2. A slug with nothing left gets a number-only branch. **Kept**: the branch still maps back by its leading number.
3. A missing issues directory is an error. **Kept**, for story 44.
4. The plugin description was reworded, an id that is not given is `request.invalid`, and `readTracker` was extracted. **Kept**: nothing observable changes for the snapshot or the daily.
5. Local branch names were cut at 50 characters, which would break epic 4's mapping by file slug. **Fixed**: local names are not cut, and a test covers a long file name.
6. The heading is in the body only when a ticket has no header. **Kept**, as answered above.
7. A prose line inside the header block is dropped. **Left**: that is what "after the header block" says.
