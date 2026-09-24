# 04: GitLab issues as Tasks

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** a project whose manifest declares `tracker.provider: gitlab` sees its issues as Tasks, with the same header, state rules, diagnostics and failure codes as GitHub. Decided in the spec, under *Manifest* and *Remote adapters*.

- [ ] `host` maps to `https://<host>/api/v4`, `gitlab.com` by default, or a base URL used as given. `repository` is the full project path, subgroups included.
- [ ] Every issue, open and closed, with pagination to the end. The number is the `iid`; the ticket is the issue's web URL; the body is its description.
- [ ] GitLab reports no close reason, so a closed issue is `CANCELLED` when its `Status:` says so, otherwise `DONE`; the mismatch rule is GitHub's.
- [ ] Triage from labels, spec slug, dependencies and every failure code behave as on GitHub.
- [ ] If ticket 03 has landed, the token comes from `BINNACLE_GITLAB_TOKEN` or the host's entry, through the same lookup; otherwise this ticket reads anonymously and whichever merges second wires the two together.
- [ ] Tests through the daemon seam against a loopback stand-in serving fixed JSON in GitLab's shape.
