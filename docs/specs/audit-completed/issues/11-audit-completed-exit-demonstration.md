# 11: The exit demonstration of epic 12, and 0.2.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** epic 12's exit criterion, demonstrated by the owner, then the 0.2.0 release (spec, the exit criterion).

- [ ] `binn audit` on this repository: no gap in `docker`, `secrets` and `security`, and a migration plan at the end.
- [ ] On a fixture with a committed `.env`, a GitHub token in a tracked file and a Dockerfile with no `.dockerignore`: each reported by path and line, never by value, and the plan puts `binn init` first and the secrets second; `/binnacle:audit` shows the plan first.
- [ ] `/binnacle:init` from the chat asks about autostart.
- [ ] After the push, Dependabot opens an npm update pull request.
- [ ] 0.2.0 published by `CONTRIBUTING.md`'s *Releasing*, and installed from the registry.
