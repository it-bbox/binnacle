# Spec: Audit, completed

Status: READY
Triage: ready-for-agent

Epic 12 of v1, from its grilling's brief, `docs/specs/audit-completed/brief.md` (2026-10-13), `docs/05-mvp-plan.md`, phase 12, and the items of `docs/product-inbox.md` the brief takes in. Released as 0.2.0. Exit criterion: `binn audit` on this repository gives no gap in the three new areas and ends with a migration plan; on a fixture with a committed `.env`, a GitHub token in a tracked file and a Dockerfile with no `.dockerignore`, it reports each by path and line, never by value, and its plan puts `binn init` first and the secrets second; the 0.1.0 rough edges the brief lists are fixed; and the owner publishes 0.2.0 by `CONTRIBUTING.md`'s *Releasing*. The owner confirmed the test seams on 2026-10-13, recorded under *Testing Decisions*.

## Problem Statement

A developer adopting an existing project runs `binn audit` to see what to fix. The audit says nothing about three things the baseline asks of it: whether a container setup would copy secrets into an image, whether a key or token is committed, and whether the project has a lockfile, dependency updates and a security policy. Its findings come as a flat list by area, so the developer has to work out which comes first, and that the many gaps `binn init` closes in one go should be taken before anything else.

The same release finds Binnacle's own rough edges. The release guide does not say what npm demands of a publisher. A tracker token set in the shell never reaches the daemon the service manager starts. `binn init` from the chat never offers autostart. `binn project register` without a manifest points to a template only a checkout has. The skills still talk about an npm package that is not published. A registration whose directory is gone stays on every page of the dashboard. The current epic is read from the table's order, so an epic not started can be shown as current while another is being built. A worktree tool's leftover Git setting silently breaks Antigravity, and nothing says so. And this repository's own Dependabot fails its npm update.

## Solution

`binn audit` gains three areas, Docker, secrets and security, read-only and offline as the rest, and one more Git check. A committed secret is named by its path, line and kind, never by its value. Every finding says whether `binn init` closes it, and the report ends with a migration plan: numbered steps, `binn init` first, the secrets next, the rest in the order of the areas, each naming its findings and what to do. `--json` carries the plan beside the findings, and `/binnacle:audit` shows the plan first.

Beside the audit, the rough edges are fixed: the release guide is complete, `binn daemon autostart on` and `binn init` say when a tracker token will not reach the service, `/binnacle:init` asks about autostart in the chat, `binn project register` names `binn init`, the skills drop the outdated clause, `binn init` installs ast-grep under npm's script policy, a gone directory is a single row with the command that removes it, the current epic is the furthest along, and this repository's Dependabot updates npm again. The epic ends with its exit demonstration and the 0.2.0 release.

## User Stories

### Docker

1. As a developer, I want the audit to say a project has no container setup without calling it a gap, so that a project that ships no image is not told to add one.
2. As a developer, I want the audit to find a `Dockerfile`, a `Dockerfile.*`, a `*.Dockerfile`, a `Containerfile`, a `compose.yaml`, a `compose.yml`, a `docker-compose.yml` or a `docker-compose.yaml`, at the root or in a subdirectory Git tracks, so that a container setup outside the root is seen too.
3. As a developer, I want a container setup with no `.dockerignore` beside its build context to be a gap, so that I learn that `docker build` sends the whole directory, secrets and `.git` included.
4. As a developer, I want a `.dockerignore` that does not exclude `.env` or `.git` to be a gap naming which of them it leaves in, so that I know exactly what to add.
5. As a developer, I want a `.dockerignore` that excludes both to be `ok`, so that a correct setup reads as correct.
6. As a developer, I want the Docker findings to name the files they read, so that I can open them.

### Secrets

7. As a developer, I want the audit to look for known token formats in the files Git tracks, so that a key committed by mistake is found before someone else finds it.
8. As a developer, I want it to know GitHub's tokens (classic, fine-grained, OAuth, app and refresh), GitLab's personal access tokens, AWS access key ids, npm tokens, Slack tokens, Anthropic and OpenAI API keys, Google API keys and PEM private keys, so that the common leaks are covered.
9. As a developer, I want each format matched exactly, with its prefix and its length, so that a placeholder or a test fixture that only looks like a token is not reported.
10. As a developer, I want each match given by its path, its line and the kind of token, so that I can find it.
11. As a developer, I want the value of a match never printed, in the text or in `--json`, not even in part, so that the audit's output can be pasted anywhere.
12. As a developer, I want a tracked `.env`, or `.env.<anything>`, to be a gap, so that a file of secrets is not committed whatever it holds.
13. As a developer, I want `.env.example`, `.env.sample` and `.env.template` allowed, so that a documented example is not reported.
14. As a developer, I want the recommendation for a secret to say to remove it, rotate the key, and, if it was ever pushed, that rewriting history is mine to decide, so that I know that deleting the line is not enough.
15. As a developer, I want the recommendation to name gitleaks for a scan of Git's history, so that I know where the audit stops.
16. As a developer, I want untracked and ignored files never read, so that my local `.env`, which Git ignores, is not reported.
17. As a developer, I want binary and very large files skipped, so that the audit stays fast on a repository with assets.
18. As a developer, I want no secrets found to be `ok`, saying how many files were read, so that I see the check ran.
19. As a developer, I want no way to silence a match, so that a real key cannot be hidden by a setting; I judge a match myself.

### Security basics

20. As a developer, I want the audit to find a lockfile of any known ecosystem (npm, pnpm, Yarn, Bun, Cargo, Go, Poetry, uv, Pipenv, Bundler, Composer), so that a project with a manifest and no lockfile is told its installs are not reproducible.
21. As a developer, I want a project with no package manifest at all not told to add a lockfile, so that a documentation repository gets no false gap.
22. As a developer, I want the audit to find a Dependabot configuration or a Renovate one in any of the places Renovate reads, so that dependency updates are known to be set up.
23. As a developer, I want no dependency updates to be a gap recommending Dependabot or Renovate, so that I know what to add.
24. As a developer, I want a `SECURITY.md` at the root, in `.github/` or in `docs/` found, so that a policy kept where GitHub reads it is not reported.
25. As a developer, I want no security policy to be a gap that says what the file is for, so that I know why it matters once the repository is public.

### Git

26. As a developer, I want the audit to report `extensions.worktreeconfig` set with no `config.worktree` using it as a gap that names Antigravity as the harness it breaks, so that a leftover setting of some worktree tool does not silently stop an agent.
27. As a developer, I want the recommendation to give the one Git command that unsets it, so that I can fix it at once.
28. As a developer, I want the setting with a `config.worktree` that uses it to be `ok`, so that a deliberate setup is left alone.

### The migration plan

29. As a developer, I want the report to end with numbered steps, so that I know what to do first.
30. As a developer, I want the first step to gather everything `binn init` closes, so that one command takes the largest share at once.
31. As a developer, I want the secrets next, before anything else by hand, so that a leak is dealt with before cosmetics.
32. As a developer, I want the rest in the order of the areas, one step per area with something to do, so that the plan reads like the report.
33. As a developer, I want each step to name its findings by code and say what to do, so that I can trace a step back to its findings.
34. As a developer, I want `unknown` findings in the plan's steps, after the gaps of their area, so that what the audit cannot tell is still something to look at.
35. As a developer, I want no step for an area whose findings are all `ok`, and a single line saying there is nothing to do when every finding is `ok`, so that a clean repository gets a clean plan.
36. As a developer, I want `--json` to carry the plan as `plan`, beside `findings`, so that a script reads the order without parsing text.
37. As a developer, I want each finding in `--json` to say whether `binn init` closes it, so that the plan's first step is a fact of the findings, not a guess from a recommendation's wording.
38. As a developer, I want the plan to be advice only, with no command run and no fix applied, so that migration stays under my control.
39. As a developer, I want `/binnacle:audit` to show the plan first, then the gaps and the unknowns by area, then the number of `ok`, so that the chat leads with what to do.

### The release guide

40. As a maintainer, I want *Releasing* to say that npm publishes only from an account with two-factor authentication and fails with `E403` otherwise, so that the first publish does not fail by surprise.
41. As a maintainer, I want it to say that the CLI then asks for the second factor in the browser, so that I am not left waiting at a prompt.
42. As a maintainer, I want it to warn that signing in with a recovery code puts the account on a 72-hour hold with no publishing, so that I do not lose three days.
43. As a maintainer, I want it to say that a new package shows `0.0.0-stage` as `latest` for a few minutes before its version, so that I do not think the publish went wrong.
44. As a Russian-speaking maintainer, I want `CONTRIBUTING.ru.md` changed in the same change, so that the twin stays true.

### Tracker tokens and autostart

45. As a user, I want `binn daemon autostart on` to warn me when a tracker token is set in my shell and none is in `credentials.json`, so that I learn the service's daemon will not see it.
46. As a user, I want `binn init` to give the same warning when its plan turns autostart on, so that the warning reaches me on the path I took.
47. As a user, I want the warning to say how to put the token in `credentials.json`, so that I can act on it.
48. As a user, I want the token's value never printed, so that the warning is safe to share.
49. As a user, I want Binnacle never to copy a token anywhere, so that a secret stays where I put it.
50. As a user, I want the installation guide, and its Russian twin, to say the same, so that a reader of the guide is warned before they meet it.

### Autostart from the chat

51. As a user setting Binnacle up from the chat, I want `/binnacle:init` to ask me whether the daemon should start at login, so that the chat path does not leave me without autostart.
52. As a user, I want it asked only when autostart is off and can be turned on, as the terminal asks, so that I am not asked a question that does not apply.
53. As a user, I want my answer passed to init as a flag, so that `--plan` and `--apply` still ask nothing and the plan shows the autostart item when I said yes.
54. As a user, I want a no to leave autostart off and the Summary to name `binn daemon autostart on`, so that I can change my mind later.

### Registering without a manifest

55. As a user installed from npm, I want `binn project register` without a manifest to tell me to run `binn init`, so that I am not pointed to a template file my installation does not have.

### The skills' wording

56. As a user installed from npm, I want the skills' pointer to the README's setup to drop "until the npm package is published", so that they do not describe a state that has passed.

### ast-grep under npm's script policy

57. As a user on an npm that blocks install scripts by default, I want `binn init` to install `@ast-grep/cli` with its postinstall allowed for that one package, so that ast-grep works after the install.
58. As a user on an npm that does not know the flag, I want the install to work as before, so that an older npm is not broken by the fix.

### A registration whose directory is gone

59. As a user, I want a registered project whose directory no longer exists told apart from one whose manifest cannot be read, so that a deleted scratch directory is not shown as a broken project.
60. As a user, I want such a project left off the overview and the other pages, so that it does not show on every page as unavailable.
61. As a user, I want it kept as one row on the projects page, with `binn project unregister <path>` ready to copy, so that I can remove it in one step.
62. As a user, I want the registry untouched by Binnacle, so that a disk not mounted today does not lose its registration.
63. As a user, I want a project whose directory comes back to show again as before, so that nothing was lost.
64. As a maintainer, I want the skills and briefs that try a CLI on a throwaway repository to say to use a temporary `BINNACLE_HOME`, so that an agent's experiment does not land in my registry.

### The current epic

65. As an owner, I want the current epic to be the one furthest along, `in progress` first, then `tickets`, then `spec`, then `not started`, so that the epic being built is current even when an earlier row is not started.
66. As an owner, I want the table's order to decide only between epics at the same status, so that the dependency order still breaks ties.
67. As an owner, I want the snapshot, the Suggested step and the dashboard to read the same current epic, so that they never disagree.

### Dependabot

68. As the maintainer of this repository, I want Dependabot's npm updates to run without `unknown_error`, so that the repository that recommends dependency updates has working ones.

### The release

69. As the owner, I want the epic to end with an exit demonstration on this repository and on a fixture with planted findings, so that I see the new areas and the plan work before I release.
70. As the owner, I want 0.2.0 released by *Releasing*, published by me, so that what this epic built reaches users.

## Implementation Decisions

- **Three new areas, after the existing ones**: `docker`, `secrets` and `security` are appended to the audit's list of areas, in that order. Findings keep `ok`, `gap` and `unknown`, and each new check has a stable `<topic>.<check>` code. The new Git check belongs to the existing `git-and-tracker` area.
- **The audit's rules stand** (`docs/specs/audit-and-adopt/spec.md`): read-only, offline, no process but Git, no new dependency, no score, exit code 0 unless it could not run. The new checks read the files `git ls-files` lists and nothing untracked or ignored.
- **Docker**: no container file is `ok`. Each build context with a container file is checked for a `.dockerignore` beside it and, when there is one, for lines that exclude `.env` and `.git`; a pattern that covers them, such as `.env*` or `**/.git`, counts. One finding per context, naming the files.
- **Secrets are matched by exact formats** in tracked text files, skipping binary files and files over a size limit. The formats, each a prefix and an exact length or character set confirmed by the implementing ticket against the provider's documentation: GitHub `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` and `github_pat_`; GitLab `glpat-`; AWS `AKIA` and `ASIA`; npm `npm_`; Slack `xoxb-`, `xoxp-`, `xoxa-`, `xoxr-` and `xoxs-`; Anthropic `sk-ant-`; OpenAI `sk-proj-` and the classic `sk-` key; Google `AIza`; a PEM header for a private key. A match must not run on into more token characters, so a longer string that only starts like a token is not one. The test fixtures already in this repository, such as `ghp_fromTheEnvironment0001`, are too short to match, and stay so.
- **A secret finding** gives the path, the line and the kind, and never any part of the value. A tracked `.env` or `.env.<suffix>` is its own finding, except `.env.example`, `.env.sample` and `.env.template`. The recommendation: remove the value, rotate the key, rewriting history is the owner's, gitleaks for a scan with history. No allowlist.
- **Security basics** are three findings: the lockfile, read only when a package manifest exists; dependency updates, from `.github/dependabot.yml` or `.yml`'s twin, or Renovate's configuration in the places Renovate reads; and `SECURITY.md` at the root, in `.github/` or in `docs/`.
- **`extensions.worktreeconfig`** is read with `git config`; the gap is when it is true and no `config.worktree` exists in the common Git directory or a worktree's. The recommendation is the `git config --unset` command; the reason names Antigravity.
- **A finding carries whether `binn init` closes it**, a boolean on the record set by the check that knows it: the manifest, the roadmap skeleton, the Matt Pocock layout and its ticket-header section, the tools init installs, Binnacle's skills and the telemetry export. `--json` gains it on each finding.
- **The migration plan** is computed from the findings, not by a check: step 1 every non-`ok` finding `binn init` closes; step 2 every non-`ok` secret finding; then one step per area, in the areas' order, with that area's remaining gaps and then its unknowns. Each step has a number, a title, the codes of its findings and what to do. An area with nothing to do has no step; with no step at all, the plan says there is nothing to do. The text output prints it after the findings; `--json` carries it as `plan` beside `root` and `findings`.
- **`/binnacle:audit`** presents the plan first, then the gaps and unknowns by area, then the number of `ok`, adding no finding and changing nothing, as now.
- **Tracker tokens and autostart**: when `binn daemon autostart on` installs or repairs the service, or `binn init`'s plan turns it on, and a tracker token variable is set in the environment while `credentials.json` holds none for that tracker, the command prints a warning that the service will not see it and how to put it in `credentials.json`. The token is never printed, copied or written. The installation checklist, `docs/operations/05-installation-checklist.md`, and its twin say the same.
- **Autostart from the chat**: `binn init --plan` reports in its JSON whether autostart could be asked (off and available) and a flag for the answer, as `--window` carries the window, is accepted by `--plan` and `--apply`; `/binnacle:init` asks the owner in the chat only when it could be asked, and passes the answer to both calls. Without the flag the chat forms keep today's behaviour.
- **`binn project register` without a manifest** answers that the repository has no `.binnacle/project.yaml` and that `binn init` writes one. The template stays in the repository for contributors.
- **The skills' pointer** to the README's setup becomes *Install* alone, in every skill that has it.
- **ast-grep**: init's install command for `@ast-grep/cli` adds `--allow-scripts=@ast-grep/cli`, which npm 11 accepts for a global install. The implementing ticket checks what an npm that does not know the flag does with it, and keeps the old command for it if it fails.
- **A gone directory**: the daemon's projection tells a registration whose path does not exist from one whose manifest cannot be read, with its own reason. The dashboard leaves such a project off the overview, the sidebar and the other pages, and shows it on the projects page as one row with `binn project unregister <path>` to copy. The registry file is never changed by the daemon. The skills and briefs that try the CLI on a throwaway repository say to set a temporary `BINNACLE_HOME`.
- **The current epic** is the first at the furthest-along status present, in the order `in progress`, `tickets`, `spec`, `not started`, the table's order between equals; `done` is never current. One function decides it, and the snapshot, the board, the Suggested step and the dashboard already read it from there.
- **Dependabot**: the ticket reads the failed job's log, fixes `.github/dependabot.yml` or what the log points to, and sees an npm update open a pull request.
- **Documentation is updated with the code**: the audit's areas and plan in `docs/03-mcp-and-skills.md` and `docs/operations/02-existing-project-adopt.md` and its twin; *Releasing* in `CONTRIBUTING.md` and its twin; autostart and tokens in `docs/operations/05-installation-checklist.md` and its twin; `CONTEXT.md` already has *Migration plan*.
- **No ADR.** Nothing here is hard to reverse: the audit stays within epic 7's rules, the current epic's order is one function, and a gone directory changes what the dashboard shows, not the registry.

## Testing Decisions

Confirmed by the owner on 2026-10-13: three existing seams, and review for what has no behaviour to test.

- **The `binn` process** on temporary Git repositories, as `apps/cli/test/audit.test.ts`, `init.test.ts`, `autostart.test.ts` and `project.test.ts` do. It covers the three new areas, the worktree setting, the migration plan, the init flag in the findings, the tokens warning of `binn daemon autostart on` and `binn init`, init's autostart flag in `--plan` and `--apply`, `binn project register` without a manifest, and ast-grep's install command in init's plan. A good test checks what a person running the command could see: stdout, the exit code, the JSON and the files on disk.
- **`--json` is the contract**: tests read the codes, statuses, the init flag and `plan` from it, and the text only for what a human must see.
- **Fixtures for the new areas**: a repository with a Dockerfile and no `.dockerignore`; one whose `.dockerignore` leaves `.env` in; one with a committed `.env` and an `.env.example`; one with a token of each format in a tracked file and the same token in an ignored file; one with fake tokens one character short; one with a manifest and no lockfile; one with Dependabot, one with Renovate; one with `extensions.worktreeconfig` and no `config.worktree`.
- **A secret's value never appears**: a test plants each format and checks that no part of the value is in the text or the JSON.
- **The audit still writes nothing and still runs offline**: the existing before-and-after test and the no-network test cover the new areas.
- **This repository's own report**: a test runs the audit on the repository's own tree and expects no gap in the three new areas, so that a fixture that matches a format fails the suite.
- **The current epic**: through the daemon's existing tests of the snapshot and the Suggested step (`apps/daemon/test/next.test.ts`, `snapshot.test.ts`), with a roadmap whose earlier row is `not started` and a later one `tickets` or `in progress`, and with ties.
- **A gone directory**: through the daemon's HTTP in `apps/daemon/test/projects.test.ts`, a registration whose directory is removed reads as gone, one with a broken manifest does not, and the registry file is unchanged; the pages are checked in a browser.
- **Checked in review, not by a test**: the skills' wording and the init skill's question, *Releasing*, the guides and their twins (beyond the existing twin and link test), and the Dependabot fix, seen as an opened pull request.

## Contested points

- **Secrets in Git's history**: not read. A removed but pushed key is still leaked, and only history shows it; reading history is slow on a large repository and a finding there cannot be fixed without rewriting it. The recommendation names gitleaks instead (the owner, 2026-10-13).
- **An allowlist for false matches**: none. A report on a project with token-like fixtures cannot be made clean; exact formats keep it rare, and an allowlist is a place to hide a real key (the owner, 2026-10-13).
- **No container setup**: `ok`, not `unknown`. The audit cannot tell whether a project is deployed in a container, but calling every project without one unknown would leave this repository's report unclean for ever (the owner, 2026-10-13).
- **The current epic's order** now outranks the table's order. An owner who marks a later epic `spec` while an earlier one is `not started` sees the later one current, which is the point; the Suggested step's "grill" alternative follows it.

## Out of Scope

- Reading Git's history for secrets, and an allowlist of matches.
- Running Docker, a build, a scanner or any tool beside Git.
- Checking whether a found token is live, or any network call.
- The audit in MCP or the dashboard.
- Writing a fix: `binn init` stays the only writer, and the audit's plan is advice.
- Removing a registration from the dashboard, and the daemon removing one by itself.
- Copying a tracker token into `credentials.json`, a unit file or anything else.
- Expanding systemd specifiers in a unit written by hand (the product inbox).
- Epic 13, released as 0.3.0.

## Further Notes

- Vocabulary: *Migration plan* is in `CONTEXT.md`; *Audit* and *Finding* stand. A finding's init flag needs no term of its own.
- The tickets' order: the audit's areas and the plan before the skill that presents the plan; the rough edges are independent of each other and of the audit; the exit demonstration and release last, after all of them.
- `@ast-grep/cli` and npm: npm 11 blocks dependency install scripts by default; for a global install, `--allow-scripts=<package>` allows them (npm's documentation, `npm install-scripts`).
