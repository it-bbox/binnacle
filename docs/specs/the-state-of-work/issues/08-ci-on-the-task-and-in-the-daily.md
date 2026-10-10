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

## Comments

- **Where it lives.** `taskRequest` in `apps/daemon/src/ci.ts` reads the Task's request through `readCi`, which now passes a branch filter (`keep`) to `readGitHubCi` in `packages/adapters/src/github.ts`, so that only the requests whose branch maps to the Task (`branchTask`) are kept before the limit is applied and their states read. `task.get` in `operations.ts` reads it beside the usage, the questions and the impact; the brief (`task.ts`) carries it as `request`. `daily.ts` reads `readCi` beside the two ends' states, maps the requests to the Tasks at HEAD, and adds `ci.failing` to the daily's attention; the vault's daily note writes it with the snapshot note's `ciNote`. The Task page shows it as a *Pull request* row under *Branch*; `CI_TONE`, `CiState`, `CiForge` and `forgeName` moved from the project page to `composables/projects.ts`, which both pages use.
- **Decided here, where the spec does not say:**
  - **The request is the first open one the forge lists whose branch maps to the Task**, found wherever it falls in the list, since the snapshot's ten would miss one further down; only its own state is read.
  - **It is `{ forge, number, title, branch, draft, state, url }`**, the `ci` section's item without `taskId`, which is the Task's own, and with the forge, so that the page and `/binnacle:task` can say which forge reports it.
  - **It is unavailable whenever the `ci` section would be**, the default branch's reading included: one reading, one set of reasons (ADR-0007), at the cost of reading the default branch's commit for a brief.
  - **The daily's attention carries `ci.failing`**, as the snapshot's does, since the daily's attention is "as the snapshot computes it".
  - **`checkpoint.prepare` carries `ci` too**, being the daily's delta; its skill does not present it.
- **Test-first, as read here.** `apps/daemon/test/ci.test.ts` drives `task.get` against the loopback GitHub: a Task with a draft pull request and its failing state, found past the snapshot's limit with no other request's state read; a Task with none, `null`; a local ticket mapped by its branch, the forge read from the Git remote; 401, 403 and 429, each unavailable with the forge's reason, the brief still served; no forge. It also drives `daily.get` with a forge from the remote: CI as of now, a request mapped to the Task at HEAD, `ci.failing`, and the vault's daily note. `daily.test.ts` covers the daily's `ci` from a loopback GitHub tracker of its own, and unavailable without a forge. The briefs' expectations in `task.test.ts`, `github.test.ts`, `gitlab.test.ts` and `packages/mcp/test/smoke.test.ts` gain `request`; `usage.test.ts`'s "asks the forge nothing" for rework now leaves out the open pull requests the brief lists.
- **Verified in a browser.** The generated dashboard ran against a daemon on a temporary `BINNACLE_HOME` under this worktree's `.scratch/`, with `BINNACLE_PORT=0`, and a scratch project whose tracker was GitHub at a loopback forge: `#2` showed *Pull request* `#7 Second step (draft) · feat/2-second-step · failing`, "As GitHub reports it.", and in Russian «(черновик)», «падает», «Так сообщает GitHub.»; `#3` "No open pull or merge request." and «Открытого pull или merge request нет.»; a local project with no remote "Not available" with the no-forge reason. The daemon was stopped and its home removed; the owner's daemon was not touched.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards.** No documented standard is broken: what is missing is null or unavailable with its reason, every state `provider_reported`, the token goes to the declared host only through `trackerToken`, no dependency is added. Judgement calls:

1. **A brief reads more than its request** (Ponytail, AGENTS.md 6): `taskRequest` goes through `readCi`, which also reads the default branch, its commit and that commit's state, on every poll of the Task page; and its comment says "Only its state is read", which is true only among the requests. **To fix**: the comment says what is read, with a `ponytail:` note naming the cost and the way out. Reading the default branch stays, decided under *Comments*.
2. **The Task is found by object identity**: `branchTask(branch, tasks, remote) === task` holds only because `findTask` takes `task` from the same array; a copy would silently give `null`. **To fix**: compare ids.
3. **Duplicated Code**: `taskRequest` repeats `readCi`'s `remote` line, and maps `taskId` only to drop it. **Kept**: one line, and the mapping is `readCi`'s own, shared with the snapshot and the daily; a second path to skip it would be more code than it saves.
4. **Data Clumps**: the Task page's `request` type repeats the project page's request fields by hand, though `CiState` and `CiForge` already moved to `composables/projects.ts`. **To fix**: a `CiRequest` type there, which both pages use.
5. **Divergent Change**: `docs/04-telemetry-dashboard.md`'s questions line, "not yet explicit artifacts", is corrected in passing. **Kept**: it is the line beside the one this ticket adds, about the same page, and was stale since ticket 02.
6. **`keep` on `readCi` and `readGitHubCi`** is not Speculative Generality: it has two callers. Nothing to fix.
7. **`pullRequest` is "Pull request" in Russian.** **Kept**: the project page already says «Открытые pull requests»; the term is not translated.

**Spec.** Every criterion is implemented. Findings:

8. **The ticket is still `Status: READY` with its criteria unticked.** Nothing to fix here: the last commit of the process sets them.
9. **`checkpoint.prepare` carries `ci`, and `ci.failing` in its attention**, though the spec reads CI "when a snapshot, a daily or a brief is served". **Kept**: `checkpoint_prepare` is documented as returning the daily's fields, and its skill drafts fixes only for attention items the canonical sources can resolve, which `ci.failing` is not; the cost is one forge read per checkpoint, decided under *Comments*.
10. **The Task page labels the row "Pull request" on any forge**, where the spec says "pull or merge request". **Kept**: GitLab's CI is unavailable until ticket 09, so no merge request reaches the page before then; ticket 09, which reads them, names them.
11. **Three more requests per brief** for the default branch's state, as finding 1. **Kept** as decided under *Comments*; its comment is finding 1's fix.
