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
