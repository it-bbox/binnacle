# 05: Questions and answers from GitHub and GitLab issue comments

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** on a GitHub or GitLab tracker, an issue comment whose body starts with `### Question` or `### Answer` is one, in creation order, read with the tracker's read-only token, so that a remote Task shows its questions as a local one does (ADR-0040; spec, *Read from issue comments*). GitHub: the repository's issue comments through every page, matched to issues by number. GitLab: the notes of each open issue, system notes left out.

- [ ] Loopback-forge tests, as `github.test.ts` and `gitlab.test.ts` serve the issues: questions answered and unanswered, comments on several pages, a comment not starting with a heading ignored, GitLab's system notes ignored.
- [ ] A failure to read comments (401, 403, 429, unreachable) leaves the Tasks readable and their questions unavailable with the reason; the token never appears in what is returned.
- [ ] Requests go to the declared host only, as the issues' do.
- [ ] `task_get` and the snapshot's `pendingDecisions` show the remote questions.
