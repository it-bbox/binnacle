# 10: Dependabot's npm updates

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`
Roles: Developer, Reviewer, DevOps

**What to build:** this repository's Dependabot updates npm again (spec, *Dependabot*). Its first npm update failed with `unknown_error`. Read the failed job's log through `gh`, find the cause, and fix `.github/dependabot.yml` or whatever the log points to; the pnpm workspace and its root lockfile are the first suspects. The pull request Dependabot opens after the fix can be seen only once `main` is pushed, which is the owner's; the exit demonstration checks it.

- [ ] The ticket's comments quote the cause from the log, without any token.
- [ ] The fix is in the branch, and the configuration still covers npm and GitHub Actions weekly.
- [ ] The comments say what the owner should see after the push: an npm update pull request, or the job's new log.
