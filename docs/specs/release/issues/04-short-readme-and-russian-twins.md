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
