# 13: CI on GitHub read without check runs

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** a follow-up of 07, found before the exit demonstration. GitHub serves a commit's check runs (`/commits/{sha}/check-runs`) to GitHub Apps only: a fine-grained personal access token gets 403 there, "Resource not accessible by personal access token", and no permission can be granted to it for them. A branch's latest commit (`/commits/{ref}`) needs Contents read access, which the documents never asked for. Either 403 makes the whole `ci` section unavailable, as it is on this repository with the owner's token (Actions, Commit statuses, Issues, Metadata and Pull requests, read-only). On GitHub, a commit's CI state is read instead from the GitHub Actions workflow runs of that head commit (`/actions/runs?head_sha=`) and its combined status together, with the same four states: failing when any run or status failed, was cancelled or timed out; running when any is queued, in progress or pending; passing when all passed; `none` when it has neither. The default branch's latest commit is read from that branch's combined status (`/commits/{branch}/status`), which names it, and its link is the repository's page with `/commit/<sha>`. A fine-grained token with Actions, Commit statuses and Pull requests read access is then enough, beside Issues for the tracker. What cannot be read still leaves the section unavailable with the forge's reason. Every document that asks for a Checks permission, or describes GitHub's CI as read from check runs, names Actions and workflow runs instead. GitLab is unchanged.

- [x] Loopback-forge tests: workflow runs and statuses combined into the four states as above; the default branch's commit and link from its combined status and the repository; the open pull requests' heads read the same way; no request to `check-runs` or to `/commits/{ref}` itself; 401, 403 and 429 still give the section unavailable with the reason, a refused workflow-run read naming the workflow runs.
- [x] Every state is `provider_reported`; the token appears in nothing returned; requests go to the forge's host only.
- [x] `docs/operations/04-security-resilience.md`, `docs/operations/05-installation-checklist.md`, `docs/03-mcp-and-skills.md` and the spec name Actions, Commit statuses and Pull requests read access and workflow runs; no document asks for Checks.
- [x] On this repository, with the owner's token as it is, the snapshot's `ci` section and the project page show `main`'s state as GitHub Actions reports it.

## Comments

- **Where it lives.** `readGitHubCi` in `packages/adapters/src/github.ts`: a commit's state from `/actions/runs?head_sha=` and `/commits/{sha}/status` (`commitState`, its mapping unchanged); the default branch's commit from `/commits/{branch}/status?per_page=1`, which names it. `readRemoteCi` in `remote-tracker.ts` now hands `toCommit` the repository as well, for the link, and reads the commit as the forge calls it (`commitWhat`), so that a refusal says what was refused; GitLab's source is unchanged but for saying `commits`.
- **Decided here, where the spec does not say:**
  - **No Contents access either.** The 403 seen on this repository named the commits: `/commits/{branch}` needs Contents read access, which the token does not have and the documents never asked for. Asking for it would give the token the code to read, so it is not read at all.
  - **The default branch's `at` is `null` on GitHub**: a commit's date is only in what needs Contents access. The project page and the vault's note already leave out a time that is not known; GitLab still gives one.
  - **The commit's link is the repository's `html_url` with `/commit/<sha>`**, checked as a web link as before; a repository without one leaves the section unavailable, saying GitHub gave no link to the commit.
  - **Every workflow run of the commit counts**, as every check run did, and a run's state is the latest of its attempts, so GitHub's *Re-run* replaces a failure. A workflow started anew on the same commit by another event keeps its earlier run beside the new one; the check runs' read, which kept the latest of each name, had no such case. `ponytail:` until it is seen.
  - **A check run from a GitHub App other than Actions is no longer read**; such a CI that reports a commit status still is. The spec's *Out of scope* says so.
  - **The default branch's combined status is read twice**, once to name its commit and once with its state, as every head's is; one request more per snapshot keeps a single `state(sha)` for the branch and the pull requests.
- **Test-first, as read here.** `apps/daemon/test/ci.test.ts`'s loopback GitHub now serves workflow runs by `head_sha` and the combined status by branch or SHA, and nothing at `check-runs` or `/commits/{ref}`, so a read of either fails; the tests check that neither is requested, combine runs and statuses (`waiting` runs, `action_required` fails), name the workflow runs in a 403, and leave the section unavailable without the commit or its link. `daily.test.ts`'s forge serves the same.
- **The last criterion is the owner's**, with the token as it is and this branch merged:

  ```text
  1. Restart the daemon from main so that it runs this code.
  2. binn call project_snapshot | jq .ci
     Check: defaultBranch.state.value is what GitHub Actions shows for main's head,
            provenance provider_reported, url https://github.com/it-bbox/binnacle/commit/<sha>, at null;
            no "no read access" reason.
  3. Open the project page in the dashboard.
     Check: CI shows main with that state and the linked commit, not "Not available".
  ```

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings, all judgement calls:

1. **The ticket is still `READY` with nothing ticked.** **Fixed**: this commit sets `DONE` and ticks every criterion but the owner's.
2. **Mysterious Name / Data Clumps**: `commitWhat` beside `commit` makes a second URL-and-name pair in `CiSource`, beside `requests` and `what`, and the bare `what` no longer says which. **Kept**: the new pair follows the existing one; renaming `what` changes GitLab's source for no behaviour.
3. **Duplicated Code**: `toCommit` checks `typeof entry.sha === 'string'`, which `readRemoteCi` already checks before it reads the link. **Fixed**: the check goes.
4. **The `ponytail:` ceiling of a workflow started anew on the same commit** is in the ticket's *Comments* only, not in the code beside the one on pages. **Fixed**: the JSDoc of `readGitHubCi` names it.
5. **The default branch's combined status is read twice.** **Kept**: decided under *Comments*; the read replaces the commit's, so a snapshot sends as many requests as before.

**Spec: every criterion but the owner's is implemented; every request is covered by Metadata, Pull requests, Actions and Commit statuses read access, as GitHub's table of fine-grained permissions gives them.** Findings:

6. **`docs/03-mcp-and-skills.md` names the workflow runs but not the permissions**, which the third criterion asks of it. **Fixed**: it names them.
7. **That a run's state is its latest attempt's** is not said outright by GitHub's documentation, which gives `run_attempt` on the run and a separate endpoint for earlier attempts, nor tested. **Kept**: the loopback forge can only serve what GitHub is said to; the owner's run on this repository reads what GitHub gives.
8. **A run concluded `stale` fails**, not decided here. **Kept**: as 07 decided for check runs, every conclusion but success, skipped and neutral fails, a red the owner looks at rather than a green that hides one.
9. **`binn init`'s advice on a GitHub token asks for Issues alone** (`apps/cli/src/init.ts`), so a token made by it leaves the `ci` section unavailable. Not named by the ticket, but it is the advice the third criterion is about. **Fixed**, and `init.test.ts` pins it: it names Actions, Commit statuses and Pull requests for the snapshot's CI as well.

#### Security

The ticket's `Roles:` names Security beyond the Developer and the Reviewer, so the change was also read for its security concerns. Findings:

10. **The token's reach shrinks**: no Checks and no Contents access is asked for, so a leaked token cannot read the repository's code. Nothing to fix.
11. **The commit's link is built from the forge's `html_url` and the SHA it gives, the SHA unchecked.** **Kept**: the link stays on whatever origin the forge's own `html_url` names, its scheme checked by `isWebLink` as every link is, and the dashboard opens it with `rel="noopener noreferrer"`; the forge gave the commit's link outright before.
12. **The SHA goes into the workflow runs' query encoded, and into the status path as before.** **Kept**: as 07's finding 16; the request stays on the forge's origin.
13. **The token reaches nothing returned and no other host**: `ci.test.ts` still checks both, a refused workflow-run read included. Nothing to fix.

**In all**: five findings fixed, six kept with their reasons, and two that find nothing. The full suite, 702 tests, and the typecheck pass after the fixes.
