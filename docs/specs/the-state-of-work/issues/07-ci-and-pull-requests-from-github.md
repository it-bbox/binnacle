# 07: CI state and open pull requests from GitHub in the snapshot

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** the snapshot's `ci` section, replacing its placeholder: the forge — the tracker when it is GitHub or GitLab, else the first GitHub or GitLab Git remote — read with the token Binnacle holds for its host or anonymously; the default branch's latest commit with its CI state from its check runs and combined status; the open pull requests, each with its head's CI state and the Task its branch maps to (spec, *The forge*, *CI on GitHub*, *The `ci` section*). A failing default branch is `ci.failing`. `/binnacle:product` presents it, the project page shows it in place of *Not available*, and the vault's snapshot note carries it. GitLab is ticket 09.

- [ ] Loopback-forge tests: passing, failing, running and `none`; check runs and statuses combined as the spec says; open pull requests with their Task; `ci.failing`; the forge taken from the remote when the tracker is local; no forge at all, and 401, 403 and 429, each giving the section unavailable with the reason.
- [ ] Every state is `provider_reported`; the token appears in nothing returned; requests go to the forge's host only.
- [ ] `/binnacle:product` (plugin and copy) presents *CI*.
- [ ] The project page shows it, strings in English and Russian, checked in a browser; the vault's snapshot note carries it.

## Comments

- **Where it lives.** The forge's reading is `readGitHubCi` in `packages/adapters/src/github.ts`, over a new `readObject` beside `readPages` in `remote-tracker.ts`, which share one request with the tracker's failure messages (`statusFailure`); the CI types (`CiState`, `ReportedState`, `CiReading`) sit there for GitLab's reader in ticket 09. The daemon's `apps/daemon/src/ci.ts` finds the forge (`forgeOf`), takes its token (`trackerToken`), reads it, maps each pull request to its Task (`branchTask`) and gives `ci.failing` (`ciAttention`); `snapshot.ts` starts the read before the tracker's and awaits it after, so the two run at once. The vault's snapshot note writes it in `vault.ts` (`ciNote`); the project page in `apps/dashboard/app/pages/project.vue`.
- **Decided here, where the spec does not say:**
  - **A state is `{ value, provenance: 'provider_reported' }`**, as a usage total carries its provenance beside its value.
  - **The default branch is the forge's** (`default_branch` of the repository), not the checkout's `origin/HEAD`: the CI that runs is the forge's.
  - **A completed check run passes on `success`, `skipped` or `neutral`**, and every other conclusion fails, `failure`, `cancelled` and `timed_out` as the spec names and the rarer `action_required`, `startup_failure` and `stale` with them: a red the owner looks at rather than a green that hides one. A status passes on `success`, runs on `pending`, and fails on `failure` or `error`.
  - **`at` is the commit's committer date**, null when the forge gives none.
  - **The section is unavailable when any part of it cannot be read**, a pull request's state included, as the tracker gives no partial list (ADR-0007).
  - **Only the first ten pull requests' states are read** (the snapshot's limit); the remainder is counted from the list.
  - **A GitLab forge is unavailable, saying this version reads CI from GitHub only**, until ticket 09.
  - **No attention item when the forge cannot be read**: the section says why; a remote tracker's own failure is already an attention item.
  - **A `github.com` remote's token is the credentials file's `github.com` entry or `BINNACLE_GITHUB_TOKEN`**, as `binn audit` looks it up; the installation checklist and the security document say the fine-grained token also needs Checks, Commit statuses and Pull requests read access.
- **Test-first, as read here.** `apps/daemon/test/ci.test.ts` drives the snapshot against a loopback GitHub: passing, failing, running and `none`; check runs and statuses combined; the open pull requests with their Tasks, cut at the limit; `ci.failing`; the token sent and returned nowhere, every request to the forge's host; 401, 403, 429 and an unreadable pull request's state, each unavailable with the reason; the forge taken from a `github.com` remote when the tracker is local (the test's `fetch` sends `api.github.com` to the loopback forge and records every request the daemon sends out); no forge, and a GitLab one; and the vault's snapshot note. `github.test.ts`'s fake now keeps only the issue requests it is about; `i18n.test.ts` pins the new reason's translation.
- **Verified in a browser.** The generated dashboard ran against a daemon on a temporary `BINNACLE_HOME` under this worktree's `.scratch/`, with `BINNACLE_PORT=0`, and a scratch project whose tracker was GitHub at a loopback forge: `main` failing, a pull request on `feat/2-second-step` running and mapped to `#2`, a draft passing. The project page showed *CI* with each, the commit and the pull requests linked, and "As GitHub reports it."; in Russian «падает», «идёт», «проходит», «Открытые pull requests», «черновик», «Так сообщает GitHub.». With the tracker made local and no remote, the section read "Not available" with the no-forge reason. The daemon was stopped and its home removed; the owner's daemon was not touched.
