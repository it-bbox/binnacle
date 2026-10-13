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

The owner's steps once `it-bbox/binnacle` is public, in its *Settings* and *Insights*:

1. *Security* (*Code security and analysis*) → *Private vulnerability reporting* → *Enable*. Then open `https://github.com/it-bbox/binnacle/security/advisories/new` signed in as another account than the owner's: it shows the report form. Signed out, GitHub asks to sign in; as the owner, it opens a draft advisory instead.
2. Same page → *Dependabot alerts* → *Enable*. *Dependabot security updates* can be turned on beside it; the version updates of `.github/dependabot.yml` run without it.
3. *Insights* → *Dependency graph* → *Dependabot*: both entries, `npm` and `github-actions`, are listed with their last check and no error. Version updates run from the configuration on `main` whether the repository is public or not; the first pull requests arrive within the week.

### Review

A sub-agent reviewed the branch against `main` on both axes and the Security and DevOps roles. It compared the two pages sentence by sentence and ran the typecheck, the new test and `pnpm test` (830).

**Standards: no finding.** One author, no trailer, no new dependency, nothing outside the ticket. `SECURITY.ru.md` beside `AGENTS.md`'s single `README.ru.md` exception: **kept**, the ticket asks for it and ticket 04 widens the rule.

**Spec**

1. **`SECURITY.ru.md` read differently from the English in three places**: "выходят в последнем релизе" (could mean "came out in the last release"), "сообщайте закрыто", "в их собственный проект" for one tool. **Fixed**: "вносятся только в последний релиз", "конфиденциально", "в проект этого инструмента"; the English says "only" too.

#### Security

1. **Ticket 07's check of the report form "signed out"** would show GitHub's sign-in page, and the owner sees a draft advisory there. **Fixed**: checked from another account.

No other finding: reporting is private, a public issue is ruled out, the URL is `it-bbox/binnacle`'s, the scope matches the architecture's boundary, and no response time is promised.

#### DevOps

1. **The steps' heading named only *Settings*** while step 3 is in *Insights*, and did not say version updates need no public repository. **Fixed**.
2. **Actions are pinned to major tags**, so their `minor-and-patch` group will rarely fire. **Kept**: harmless, and the spec asks for the grouping.
3. **`@types/node` majors** will come as their own pull requests, past Node 24. **Kept**: an `ignore` rule waits until that is real noise.

The configuration is valid for version 2: `npm` at `/` reads the root `pnpm-lock.yaml` and the workspace, Dependabot supports pnpm 10, and its pull requests run CI with `contents: read` and no secret.
