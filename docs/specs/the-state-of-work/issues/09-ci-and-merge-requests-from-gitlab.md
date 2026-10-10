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
