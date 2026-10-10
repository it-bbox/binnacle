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

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards.** Three findings against a documented standard, the rest judgement calls:

1. **A token can reach a host no one declared** (`docs/operations/04-security-resilience.md`: "A token is sent only to the declared host"): a forge read from a Git remote takes `BINNACLE_GITHUB_TOKEN` whatever the remote's host, and `forgeRemote` takes any host with a `github` label, so a remote on `github.example.org` would receive the token meant for `github.com`. **To fix**: a remote's forge on any host but the provider's own is read with the credentials file's entry for that host only, never the environment's token.
2. **A missing field becomes the text `"undefined"`** (ADR-0007, AGENTS.md 5): `String(about.entry.default_branch)`, `String(commit.entry.sha)` and `String(commit.entry.html_url)` stand in for what GitHub did not give, labelled `provider_reported`. **To fix**: an answer without them leaves the section unavailable, saying what was missing.
3. **`UNAVAILABLE` is dead** (AGENTS.md 9, Ponytail): nothing in the daemon gives "Not available in this version of Binnacle." any more; only the dashboard's i18n test and its dictionaries know it. **To fix**: the constant, its translation and the documentation's example go.
4. **Mysterious Name**: the repository is read as `'commits'`, so a 403 on it speaks of commits. **To fix**: it is read as the repository.
5. **Mysterious Name**: `ci.ts`'s `Forge` (where CI is read from) shares its name with `remote-tracker.ts`'s `Forge` (how an API is spoken to). **To fix**: `CiForge`.
6. **Duplicated Code / Repeated Switches**: `provider === 'github' ? 'GitHub' : 'GitLab'` in `ci.ts`, `vault.ts` and the project page. **Kept**: three surfaces, each words the forge for its reader, and the page spells the daemon's answers locally throughout, as earlier Reviews kept; ticket 09 adds no third provider.
7. **Divergent Change**: `remote-tracker.ts` now reads CI as well, its failures coded `tracker.*` and one saying "tracker.host gives no URL" for a remote's forge. **Kept**: the code is never shown, only the message, and a remote's forge always gives a URL, built from its host; one request path and one set of failure messages for every forge read is the point of sharing it.
8. **Data Clumps**: `(forge, url, where, token, what)` through `readPages`, `readObject` and `readResponse`, with three result shapes. **Kept**: the parameters were `readPages`'s already; `readObject` returns `{ entry } | { failure }` because an object, unlike a list, cannot be told from a `Diagnostic` by its shape.
9. **Cleverness over simplicity**: `readCi` resolves to a function that maps the requests to Tasks, so that the forge and the tracker are read at once. **Kept**: the alternative is the same split as two exports, and `snapshot.ts` reads the tracker inside `readState`, which a `Promise.all` would have to be threaded through.
10. **Speculative Generality**: `CiState`, `ReportedState` and `CiRequest` live in `remote-tracker.ts` and are exported for GitLab's reader. **Kept**: decided under *Comments*; ticket 09 is planned and blocked only by this one, and the types are what the daemon reads either way.

**Spec.** Every criterion is implemented, with no scope creep. Findings:

11. **The token reaches a host the remote names**, as finding 1. **To fix**, by the same change.
12. **A token that cannot be used says "so the tracker was not read"** in the CI section, though for a remote's forge the local tracker was read; story 41 asks for "the forge's reason". **To fix**: the credentials' failures say nothing was read with the token, which is true for the tracker and for CI.
13. **`taskId` is null both when no Task maps to the branch and when the Tasks cannot be read.** **Kept**: the snapshot's `tasks` is then `null` and its attention says why, which tells the two apart; docs/03 says so.
14. **`neutral` passes**, where the spec says "passing when all succeeded or were skipped". **Kept**: decided under *Comments*; GitHub counts a neutral check as success for a required check, and the other unnamed conclusions fail, so nothing red passes as green.

#### Security

The ticket's `Roles:` names Security beyond the Developer and the Reviewer, so the change was also read for its security concerns, after the fixes above for findings 1, 2 and 12, which are the first of them. Findings:

15. **A link the forge gives is rendered as a link without checking its scheme**: the project page binds `defaultBranch.url` and each request's `url` to `href`, and Vue does not refuse a `javascript:` URL, so a hostile forge, such as a Git remote's host, could run script in the dashboard, which holds the daemon's token. **To fix**: the adapter takes a link only when it is `http:` or `https:`; any other leaves the section unavailable, saying GitHub gave no link, as a missing one does.
16. **The commit SHA GitHub gives is put into the next request's path unescaped.** **Kept**: the request stays on the forge's own origin, which already holds the token, and the next page of a list is held to that origin too; nothing is sent elsewhere.
17. **A pull request's title and branch go into the vault's Markdown as written.** **Kept**: Obsidian renders Markdown, not script, and the dashboard shows them as text; the tickets' and issues' titles already reach the vault the same way.
18. **The token reaches nothing returned**: the failures are `statusFailure`'s, which name the host and whether a token was used, never its value, as `ci.test.ts` checks for 401, 403 and 429. Nothing to fix.
