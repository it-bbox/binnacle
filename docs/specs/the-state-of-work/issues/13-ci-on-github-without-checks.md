# 13: CI on GitHub read without check runs

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** a follow-up of 07, found before the exit demonstration. GitHub serves a commit's check runs (`/commits/{sha}/check-runs`) to GitHub Apps only: a fine-grained personal access token gets 403 there, "Resource not accessible by personal access token", and no permission can be granted to it for them. A branch's latest commit (`/commits/{ref}`) needs Contents read access, which the documents never asked for. Either 403 makes the whole `ci` section unavailable, as it is on this repository with the owner's token (Actions, Commit statuses, Issues, Metadata and Pull requests, read-only). On GitHub, a commit's CI state is read instead from the GitHub Actions workflow runs of that head commit (`/actions/runs?head_sha=`) and its combined status together, with the same four states: failing when any run or status failed, was cancelled or timed out; running when any is queued, in progress or pending; passing when all passed; `none` when it has neither. The default branch's latest commit is read from that branch's combined status (`/commits/{branch}/status`), which names it, and its link is the repository's page with `/commit/<sha>`. A fine-grained token with Actions, Commit statuses and Pull requests read access is then enough, beside Issues for the tracker. What cannot be read still leaves the section unavailable with the forge's reason. Every document that asks for a Checks permission, or describes GitHub's CI as read from check runs, names Actions and workflow runs instead. GitLab is unchanged.

- [ ] Loopback-forge tests: workflow runs and statuses combined into the four states as above; the default branch's commit and link from its combined status and the repository; the open pull requests' heads read the same way; no request to `check-runs` or to `/commits/{ref}` itself; 401, 403 and 429 still give the section unavailable with the reason, a refused workflow-run read naming the workflow runs.
- [ ] Every state is `provider_reported`; the token appears in nothing returned; requests go to the forge's host only.
- [ ] `docs/operations/04-security-resilience.md`, `docs/operations/05-installation-checklist.md`, `docs/03-mcp-and-skills.md` and the spec name Actions, Commit statuses and Pull requests read access and workflow runs; no document asks for Checks.
- [ ] On this repository, with the owner's token as it is, the snapshot's `ci` section and the project page show `main`'s state as GitHub Actions reports it.

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
