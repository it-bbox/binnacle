# 09: CI state and merge requests from GitLab

Status: DONE
Triage: ready-for-agent
Blocked by: 07
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** on GitLab, the `ci` section, `ci.failing` and each Task's request are read as on GitHub: the default branch's latest pipeline and the open merge requests with their head pipeline's status, mapped onto passing, failing, running and `none` (spec, *CI on GitLab*). The forge comes from the tracker or the remote as in 07.

- [x] Loopback-forge tests, as `gitlab.test.ts` serves the issues: each pipeline status mapped; open merge requests with their Task; `ci.failing`; a GitLab remote with a local tracker; 401, 403 and 429 with their reasons.
- [x] The token appears in nothing returned, and requests go to the forge's host only.
- [x] A Task's `request` in `task_get` works on GitLab.

## Comments

- **Where it lives.** `readGitLabCi` in `packages/adapters/src/gitlab.ts`, beside the issues' reader. What the two forges share, the order of the reads, the missing fields and the scheme check on links, moved from `readGitHubCi` into `readRemoteCi` in `remote-tracker.ts`, which each forge gives a `CiSource`: where the repository, a branch's commit and the open requests are, how their entries read, and how a commit's state is read. `readPages` gains `until`, so that a list read for its first entry stops after the first page. `apps/daemon/src/ci.ts` picks the reader by the forge's provider, and the gate that made a GitLab forge unavailable is gone; everything above it, the snapshot, `ci.failing`, `task_get`'s `request`, the daily and the vault, is unchanged.
- **Decided here, where the spec does not say:**
  - **The default branch's state is its latest pipeline for its latest commit** (`/pipelines?ref=&sha=`, newest first, one entry read), `none` when that commit has none: the section pairs a state with the commit it shows, as on GitHub, so the branch's latest pipeline of an older commit is not shown as the newest's. **A merge request's is its latest pipeline** (`/merge_requests/:iid/pipelines`, one entry read), which GitLab lists whatever commit or project it ran on, a merged result's or a fork's included (Review, finding 8).
  - **The pipelines are listed, not read from the commit's `last_pipeline` or the merge request's `head_pipeline`**: GitLab leaves those out, as null, when the token may not read pipelines, so that `none` could hide a refusal; the lists answer 403 instead, which the section says.
  - **The mapping**: `success` and `skipped` pass, as a skipped check run passes on GitHub; `created`, `waiting_for_resource`, `preparing`, `pending`, `running`, `scheduled` and `manual` run, a pipeline still to finish, a manual one waiting on a person; `failed`, `canceled`, `canceling` and any status GitLab adds later fail, a red the owner looks at rather than a green that hides one.
  - **A merge request's number is its `iid`**, its branch its `source_branch`, its link its `web_url`; `draft` as GitLab gives it, false when it gives none.
  - **The surfaces keep their words**: the vault's note and the project page still head the list *Open pull requests* and write `#` before a number, and the Task page's row stays *Pull request*; the skills, the MCP tool's description and `docs/03-mcp-and-skills.md` say pull or merge requests. This ticket names no surface, and epic 16's redesign restyles them.
- **Test-first, as read here.** `apps/daemon/test/ci.test.ts` drives the snapshot and `task.get` against a loopback GitLab served under `/api/v4`, the project a full path with a subgroup: the default branch's latest commit with only its latest pipeline counted and no second page read; each pipeline status mapped, no pipeline `none`, an unknown status failing; `ci.failing`; the open merge requests with their head pipelines and Tasks, cut at the limit with no pipeline of those left out read; the token sent as `private-token` to the forge's host only and returned nowhere; 401, 403 and 429 with their reasons; a pipeline that cannot be read, no default branch, and a `javascript:` link, each unavailable; a GitLab remote with a local tracker, read anonymously from `gitlab.com` only; and a Task's `request`, found past the limit, null for a Task with none, and unavailable on a 403. `gitlab.test.ts`'s fake keeps only the issue requests it is about, as `github.test.ts`'s does, and its brief's `request` is the 404 of a fake that serves no project.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards.** No documented standard is broken: what GitLab does not give is said (ADR-0007), the token goes to the forge's host only and is returned nowhere, the documents are in English, and nothing is added as a dependency. Judgement calls:

1. **Speculative Generality**: `CiSource` is exported, though only `remote-tracker.ts` names it; `github.ts` and `gitlab.ts` pass a literal. **Fixed**: the export goes.
2. **A value GitHub did not give, written as one** (ADR-0007): GitHub's `toCommit` takes the committer's date unchecked, where GitLab's checks it is a string. **Fixed**, and `ci.test.ts` pins it: GitHub's is checked the same way, null otherwise.
3. **Casts without checks** in `toRequest`: a request with no `head` or `source_branch` would throw or be dropped rather than give a reason. **Kept**: inherited from ticket 07's reader; both forges always give these fields, and the issues' readers (`toIssue`) read their entries the same way.
4. **Duplicated Code** in `ci.test.ts`: `fakeGitLab` and `withGitLab` have the shape of `fakeGitHub` and `withForge`. **Kept**: each fake serves its own API, as `github.test.ts` and `gitlab.test.ts` keep theirs; a shared helper would save some twenty lines of test setup at the cost of a generic fake.
5. **A nested ternary** in `pipelineState`, where GitHub's `commitState` uses a set. **Kept**: one expression of three outcomes, with its doc comment saying each.
6. **`url: request.url as string`** relies on the link check three lines above. **Kept**: the check and the cast sit together in one function; a type guard would retype the list for one field.
7. **Mysterious Name**: `named`, and `requests` with `what`, in `CiSource`. **Kept**: `what` is the name `RequestReviews` already gives the same thing in the same file, and each field has its doc comment.

**Spec.** Every criterion is implemented, with no scope creep: the wording "pull or merge requests" in the skills, the MCP description and docs/03 follows from the section now holding merge requests. Findings:

8. **A merge request's head pipeline is not the latest pipeline of its head commit in the target project** (spec: "each with its head pipeline's status"): a merged-results pipeline runs on a merge commit, and a fork's pipelines run in the fork, so either would show `none` or an older branch pipeline. **Fixed**, and `ci.test.ts` pins it, its fake serving a merge request's pipelines by the request alone: a merge request's state is read from its own pipelines (`/merge_requests/:iid/pipelines`), the latest first, which GitLab lists whatever commit or project they ran on, and which still answers 403 when pipelines may not be read; the Comments' decision is corrected.
9. **The default branch's state is the latest pipeline of its latest commit, not "the latest pipeline of the default branch"**, and without a `ref` a tag's or a merge request's pipeline on the same commit would stand for the branch. **Fixed in part**, and `ci.test.ts` pins it, its fake serving the default branch's pipelines only with that `ref`: the pipelines are read with `ref` set to the default branch, so that it is the branch's latest pipeline for its latest commit. **Kept in part**: the section pairs a `state` with the `commit` it shows, as GitHub's does, so an older commit's pipeline is not shown as the newest commit's; that commit has `none` until its pipeline starts. This answers the spec within its own `ci` shape and is no product question.
10. **The fake ignores `order_by` and `sort`.** **Kept**: GitLab lists pipelines newest first by default, and the request asks for that order explicitly as well.
11. **The ticket is not yet DONE.** Nothing to fix: its last commit does that, after this Review.

#### Security

The ticket's `Roles:` names Security beyond the Developer and the Reviewer, so the change was also read for its security concerns. Findings:

12. **The token reaches only the forge's host**: the pipelines and merge requests are read through `readPages` and `readObject`, whose next page is held to the first page's origin, `until` changing only when the reading stops; a remote's GitLab host other than `gitlab.com` takes the credentials file's entry for it only, by the same `ci.ts` code as GitHub's. `ci.test.ts` checks the `private-token` header and every outbound origin. Nothing to fix.
13. **The token appears in nothing returned**: the failures are `statusFailure`'s, which name the host and whether a token was used; `ci.test.ts` checks the snapshot and the 401, 403 and 429 reasons. Nothing to fix.
14. **A link GitLab gives is bound to `href` only when it is `http:` or `https:`**, by the shared `readRemoteCi`, as `ci.test.ts` checks for a commit's and a merge request's `javascript:` link. Nothing to fix.
15. **A merge request's `iid` goes into the next request's path unescaped** (after the fix for 8). **Kept**, as ticket 07 kept GitHub's SHA in a path: the request stays on the forge's own origin, which already holds the token, and a commit's SHA in a query is escaped.

**In all**: four findings fixed, 9 in part and kept in part with its reason; seven kept with their reasons; four that find nothing. The full suite, 700 tests, and the typecheck pass after the fixes.
