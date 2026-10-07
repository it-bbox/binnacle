# 10: Rework after a review on GitHub or GitLab

Status: DONE
Triage: ready-for-agent
Blocked by: 09
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** on a GitHub or GitLab tracker, rework starts after a review that requested changes on the pull or merge request whose head is the Task's branch, read with the read-only token the tracker already uses (spec, *Roles*). Without the token or the request, the roles say why rework is not read.

- [x] Tests with the forge faked as the remote tracker tests fake it: rework counted after a review requesting changes, none before.
- [x] Without a token, the reason is given rather than a guess.

## Comments

### Decisions

- **What is read.** The daemon reads only the branches its records were on (reflog branches, as ticket 09 does), mapped to a Task by `branchTask`.
  - **GitHub:** `GET /repos/{owner}/{repo}/pulls?state=all&head={owner}:{branch}`, then each pull request's `/reviews`. The first review in the `CHANGES_REQUESTED` state counts, at its `submitted_at`.
  - **GitLab:** `GET /projects/{path}/merge_requests?state=all&source_branch={branch}`, then each merge request's `/notes`. The first system note `requested changes` counts, at its `created_at`. GitLab's reviewers endpoint gives a reviewer's state but no time, so the note is what dates it. The note's wording is to be confirmed against a real GitLab in the exit demonstration.
  - Every page is followed, on the declared host only. The forge is read with the platform `fetch`, through the same `readPages` the issues use, now shared in `packages/adapters/src/remote-tracker.ts`.
- **Only with a token.** A remote tracker can be read anonymously. Reviews are read only with the tracker's token, as the ticket says, so a project without one makes no request for them.
- **The points.**
  - **Rework:** on the forge, work after the first changes request is rework.
  - **No review role:** the spec defines a review run by the commit that records the ticket's Review, and a forge has none, so no run there is a review run. `ReviewPoints` takes the request's time for both of its points, which leaves no window for one.
  - **Split:** a run crossing the request is split there, as one crossing a Review commit is.
- **Where the reason is.** `task.get` and `usage.get` with a Task gain `reworkUnread`: why that Task's rework is not read, null when it is and always on the local tracker. The Task page shows it under *Usage by role*, in both languages, and `rolesReading` names the forge. The cases:
  - no token;
  - no request on any of the Task's branches;
  - a forge that refused or failed on any branch, since that branch may hold an earlier request. Read requests still count when another branch failed.

  A Task with no runs has nothing to split and no reason. The project's `byRole`, in `usage.get` and the snapshot, keeps its shape: the reasons are per Task.
- **Kept between calls.** A changes request once found is kept in the daemon, by forge, host, repository and branch. A branch with none is asked again on every call, as the issues are. Both are marked as ceilings with `ponytail:` comments.
- **Forks.** GitHub's `head` filter is `{owner}:{branch}`, so a pull request from a fork of the repository is not found. The spec's "the pull or merge request whose head is the Task's branch" is read as the repository's own.
- **The MCP descriptions** for `task_get` and `usage_get` name the forge and `reworkUnread`. The documents are ticket 14's.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation of a documented rule.** The forge is read read-only with `fetch`, on the declared host, and the token reaches no output. Findings, all judgement calls:

1. **`RequestReviews` was exported but used only in its module.** **Fixed**.
2. **Repeated switches:** the provider was compared three times in `forgeReviewPoints`. **Fixed**: one `FORGES` table.
3. **Duplicated code:** the reason's tail was written twice. **Fixed**: one `unread` helper.
4. **`readGit{Hub,Lab}ChangesRequested` repeat the root, path and `where` of their Task readers.** **Kept**: two lines each, and a helper for them would be the bigger diff.
5. **Data clump: repository, host and token** travel together. **Kept**: they are the adapters' existing signature.
6. **`what` was a `string`.** **Fixed**: a `Listed` type.
7. **A review dismissed after it was read still counts, though the GitHub reader says a dismissed one does not.** **Fixed**: the doc says "by the time it is read", and the cache carries a `ponytail:` ceiling.
8. **A pull request's `number` and a merge request's `iid` are cast, not checked.** **Kept**: the issues are cast the same way, and a missing field reads as a 404 on the same host.
9. **A non-null assertion on `tracker`.** **Fixed**.
10. **`runs` has six parameters.** **Kept**.

**Spec: the criteria met.** Findings:

1. **The ticket was not yet `DONE`.** **Fixed** by this commit.
2. **The reason is given only per Task, not in the project's `byRole`.** **Kept**: a project's rework is a sum over Tasks, and the reasons are per Task (see *Decisions*).
3. **`readPages` was shared, `what` was added to the refusals, and the MCP descriptions changed.** **Kept**: needed for the change.
4. **No run on a forge is a review run.** **Kept**: the spec defines a review run by the ticket's Review commit, which a forge has none of. Recorded under *Decisions*.
5. **A Task whose one branch was read without a changes request and another refused gave no reason.** **Fixed**: any branch the forge did not answer for gives the reason, and a test covers it.
6. **Pull requests from forks are not found.** **Left**, recorded under *Decisions*.
