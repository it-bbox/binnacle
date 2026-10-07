# 10: Rework after a review on GitHub or GitLab

Status: READY
Triage: ready-for-agent
Blocked by: 09
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** on a GitHub or GitLab tracker, rework starts after a review that requested changes on the pull or merge request whose head is the Task's branch, read with the read-only token the tracker already uses (spec, *Roles*). Without the token or the request, the roles say why rework is not read.

- [ ] Tests with the forge faked as the remote tracker tests fake it: rework counted after a review requesting changes, none before.
- [ ] Without a token, the reason is given rather than a guess.

## Comments
