# 02: A security policy and Dependabot

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/release/spec.md`
Roles: Developer, Reviewer, Security, DevOps

**What to build:** a public repository with a way to report a vulnerability and a way to keep its dependencies current (spec, *SECURITY.md*, *Dependabot*; the audit, finding 3). `SECURITY.md` at the root names the supported version, `0.1.x`, asks for reports through GitHub's private vulnerability reporting rather than a public issue, says what is in scope — the daemon's loopback API and its token, the dashboard, the CLI, the published package — and links the security boundary in `docs/01-architecture.md` rather than repeating it. `SECURITY.ru.md` beside it says the same in Russian. One Dependabot configuration updates npm for the workspace and GitHub Actions weekly, grouping minor and patch updates.

- [ ] `SECURITY.md` and `SECURITY.ru.md` exist and say the same thing.
- [ ] The Dependabot configuration covers npm at the workspace root and GitHub Actions, weekly, with minor and patch grouped.
- [ ] The owner's steps after the repository is public — turning on private vulnerability reporting and Dependabot alerts — are listed under this ticket's Comments for ticket 07.
