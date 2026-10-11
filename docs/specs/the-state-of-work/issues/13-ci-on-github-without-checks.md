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
