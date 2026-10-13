# 04: A short README, CONTRIBUTING and Russian twins

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/release/spec.md`
Roles: Developer, Reviewer

**What to build:** a GitHub reader understands Binnacle in one or two screens, in English or Russian (spec, *The README*, *The user guides*, *AGENTS.md's language rule*, *Install names in the docs*). `README.md` is rewritten short: the problem and the core principle in a few lines; install with `npm i -g @it-bbox/binnacle`; the new-project and existing-project paths as lists; the harnesses as a table, one row each; links to the user guides; the design docs and ADRs as further reading; the licence. What it held in paragraphs moves, as it is, to the guide that owns it — `docs/operations/`'s pages, a new page for working from another harness — and development from a checkout moves to `CONTRIBUTING.md`; tickets 05 and 06 then rework those guides. `README.ru.md` and `CONTRIBUTING.ru.md` say the same in Russian and link the Russian pages; each guide gains a `*.ru.md` twin. `AGENTS.md`'s exception for `README.ru.md` becomes one for every user guide: `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and `docs/operations/*.md`. An offline test in `pnpm test` fails when a user guide lacks its twin or a relative link in them does not resolve.

- [ ] `README.md` and `README.ru.md` fit in two screens on GitHub and say the same thing; nothing they held is lost, only moved.
- [ ] Every user guide has a Russian twin, and each Russian page links the Russian pages.
- [ ] The test fails on a missing twin and on a broken relative link, and passes on the repository.
- [ ] `AGENTS.md` states the rule; no user-facing page tells a user to install `@binnacle/cli` or to run `npx binn`.

## Comments

### Decisions

- **Where the README's sections went.** The scope lists, the problem list and the core principle's second line to `docs/00-scope.md` (*Core principle*, *Problems in scope*, *In scope for v1*; the four out-of-scope items it lacked joined its non-goals). The support levels, the harness table with its sources and *Working from another harness* to the new `docs/operations/06-other-harnesses.md`. *Stack*, the layout and *From this repository* to `CONTRIBUTING.md`, under the same heading, so the skills' pointer to "*Install*, and *From this repository*" still finds both. *Setup from the chat* to `01-new-project.md` (*From the chat*); the audit and init paragraphs to `02-existing-project-adopt.md` (*What `binn audit` and `binn init` do*). The short paths' own paragraphs were already in those two guides. The dashboard's address and `binn dashboard` to the checklist (*The dashboard*); its generate step stays in `CONTRIBUTING.md`, since the package ships the dashboard built.
- **The scope lists went to a design doc**, which has no Russian twin (the spec's *Out of Scope*), so their Russian wording is gone; their content is kept in English.
- **A user's `binn` not found**: the skills point to the README's setup section, which now links a new short subsection in the checklist, *When a harness cannot find binn*: npm's global prefix, where `binn` is on each platform, and the desktop app's wrapper. The pnpm wrapper stays in `CONTRIBUTING.md`.
- **The README names `npx -p @it-bbox/binnacle binn`** for a one-off run (user story 12); ticket 06 adds it to the checklist.
- **The test** is `apps/cli/test/user-guides.test.ts`, in `pnpm test`. The guides are `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and every `docs/operations/*.md` that is not `*.ru.md`. It fails on a missing twin; on a relative link, outside code, that does not resolve; on a page that does not link its twin; on a Russian page linking an English guide other than its own; and on a page naming `npx binn` or an install of `@binnacle/cli`. A fixture checkout proves each failure. Anchors are not checked.
- **The `npx skills add ./apps/cli/skills` assertion** in `pack.test.ts` reads `CONTRIBUTING.md` and its twin now, where the command moved.
- **Every guide opens with a line linking its twin**, as `README.md` and `SECURITY.md` already did.

### For tickets 05 and 06

- The guides hold what the README held as it was, long paragraphs included: `02-existing-project-adopt.md`'s *What `binn audit` and `binn init` do* is the forty-line paragraph, and `01-new-project.md`'s *From the chat* and `06-other-harnesses.md`'s *Binnacle's skills in another harness* are next.
- `CONTRIBUTING.md` has no release section yet: the build and the tarball test (ticket 03's notes) and the publishing steps are ticket 06's.
- Rework each English page and its `*.ru.md` in the same change; `pnpm test` checks the twin and the links.
