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

## Comments

### Decisions

- **Reports go to `https://github.com/it-bbox/binnacle/security/advisories/new`**, GitHub's private vulnerability reporting form, linked from both pages, with the *Security* → *Report a vulnerability* path beside it. The link answers only once the owner turns the feature on.
- **Out of scope** says one line more than the ticket: a vulnerability in a harness, tracker or tool Binnacle talks to goes to that project.
- **`SECURITY.ru.md` opens with the same line as `README.ru.md`**, saying it is a duplicate updated with `SECURITY.md`. Ticket 04 widens `AGENTS.md`'s language rule to it.
- **Dependabot** is `.github/dependabot.yml`: `npm` at `/`, which reads the root `pnpm-lock.yaml` and so the whole workspace, and `github-actions` at `/`, which reads `.github/workflows/`; each weekly, with one `minor-and-patch` group. A major update comes as a pull request of its own. Dependabot's pull requests run the existing CI, which uses no secret.
- **The test** is `apps/cli/test/security-policy.test.ts`, in `pnpm test`: the configuration as the ticket fixes it, and both pages linking each other, the boundary's heading in `docs/01-architecture.md`, the version and the report form. Whether the two pages say the same thing is a reader's check.

### For ticket 07

The owner's steps once `it-bbox/binnacle` is public, in its *Settings*:

1. *Security* (*Code security and analysis*) → *Private vulnerability reporting* → *Enable*. Then open `https://github.com/it-bbox/binnacle/security/advisories/new` signed out of the owner's account, or from another account: it shows the report form.
2. Same page → *Dependabot alerts* → *Enable*. *Dependabot security updates* can be turned on beside it; the version updates of `.github/dependabot.yml` run without it.
3. *Insights* → *Dependency graph* → *Dependabot*: both entries, `npm` and `github-actions`, are listed with their last check and no error. The first pull requests arrive within the week.
