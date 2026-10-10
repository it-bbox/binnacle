# 09: CI state and merge requests from GitLab

Status: READY
Triage: ready-for-agent
Blocked by: 07
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** on GitLab, the `ci` section, `ci.failing` and each Task's request are read as on GitHub: the default branch's latest pipeline and the open merge requests with their head pipeline's status, mapped onto passing, failing, running and `none` (spec, *CI on GitLab*). The forge comes from the tracker or the remote as in 07.

- [ ] Loopback-forge tests, as `gitlab.test.ts` serves the issues: each pipeline status mapped; open merge requests with their Task; `ci.failing`; a GitLab remote with a local tracker; 401, 403 and 429 with their reasons.
- [ ] The token appears in nothing returned, and requests go to the forge's host only.
- [ ] A Task's `request` in `task_get` works on GitLab.

## Comments

- **Where it lives.** `readGitLabCi` in `packages/adapters/src/gitlab.ts`, beside the issues' reader. What the two forges share, the order of the reads, the missing fields and the scheme check on links, moved from `readGitHubCi` into `readRemoteCi` in `remote-tracker.ts`, which each forge gives a `CiSource`: where the repository, a branch's commit and the open requests are, how their entries read, and how a commit's state is read. `readPages` gains `until`, so that a list read for its first entry stops after the first page. `apps/daemon/src/ci.ts` picks the reader by the forge's provider, and the gate that made a GitLab forge unavailable is gone; everything above it, the snapshot, `ci.failing`, `task_get`'s `request`, the daily and the vault, is unchanged.
- **Decided here, where the spec does not say:**
  - **A commit's state is its latest pipeline's** (`/pipelines?sha=`, newest first, one entry read), `none` when it has none. The default branch's is its latest commit's, as on GitHub, rather than the latest pipeline of the branch whatever its commit, which would show an older commit's result for the newest; a merge request's head pipeline is the latest of its head commit (`sha`), which is how GitLab defines it.
  - **The pipelines are listed, not read from the commit's `last_pipeline` or the merge request's `head_pipeline`**: GitLab leaves those out, as null, when the token may not read pipelines, so that `none` could hide a refusal; the list answers 403 instead, which the section says.
  - **The mapping**: `success` and `skipped` pass, as a skipped check run passes on GitHub; `created`, `waiting_for_resource`, `preparing`, `pending`, `running`, `scheduled` and `manual` run, a pipeline still to finish, a manual one waiting on a person; `failed`, `canceled`, `canceling` and any status GitLab adds later fail, a red the owner looks at rather than a green that hides one.
  - **A merge request's number is its `iid`**, its branch its `source_branch`, its link its `web_url`; `draft` as GitLab gives it, false when it gives none.
  - **The surfaces keep their words**: the vault's note and the project page still head the list *Open pull requests* and write `#` before a number, and the Task page's row stays *Pull request*; the skills, the MCP tool's description and `docs/03-mcp-and-skills.md` say pull or merge requests. This ticket names no surface, and epic 16's redesign restyles them.
- **Test-first, as read here.** `apps/daemon/test/ci.test.ts` drives the snapshot and `task.get` against a loopback GitLab served under `/api/v4`, the project a full path with a subgroup: the default branch's latest commit with only its latest pipeline counted and no second page read; each pipeline status mapped, no pipeline `none`, an unknown status failing; `ci.failing`; the open merge requests with their head pipelines and Tasks, cut at the limit with no pipeline of those left out read; the token sent as `private-token` to the forge's host only and returned nowhere; 401, 403 and 429 with their reasons; a pipeline that cannot be read, no default branch, and a `javascript:` link, each unavailable; a GitLab remote with a local tracker, read anonymously from `gitlab.com` only; and a Task's `request`, found past the limit, null for a Task with none, and unavailable on a 403. `gitlab.test.ts`'s fake keeps only the issue requests it is about, as `github.test.ts`'s does, and its brief's `request` is the 404 of a fake that serves no project.
