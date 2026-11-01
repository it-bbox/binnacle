# 11: The launch artifacts follow the reworked storefront

Status: DONE
Triage: ready-for-agent
Blocked by: 09, 10
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** the documents the launch runs on, brought into line with the new README header and the documentation site (the spec's *The storefront, reworked*, 2026-11-01).

- [x] The README and its Russian twin link the site's pages — the home, the quick start and the guides — rather than one address standing for everything.
- [x] `docs/showcase/launch-checklist.md`'s site step names the build and its output, keeps the owner's Pages switch and the `curl` check, and drops the warning about keeping two copies of the write-up in step: the site now builds from `docs/showcase/write-up.md` and its twin, so there is one copy.
- [x] `docs/showcase/listings.md` and `docs/showcase/identity.md` still match the README's header and the site: the description, the topics, the tagline and the addresses are the same strings.
- [x] The site step's "done looks like" describes what a reader now sees — the pages, the language switch, the demo and the write-up — not the one page.
- [x] `node --test apps/cli/test/checklist.test.ts` passes with whatever the checklist now names, and `LANGUAGE=C pnpm test` passes.

## Comments

### Review

Reviewed `feat/showcase-launch-artifacts` against `main` on 2026-11-01, on the project's standards and the ticket's spec. Verdict: SHIP.

- Standards: no findings. One commit and four files; the author is the project's; the README's Russian twin is updated in the same commit; the documents are in English; the change is the ticket's scope, with no dependency or behaviour.
- Spec: all five criteria hold. The README and its twin link the site's home, quick start and guides at routes the site builds (`docs/quick-start.md`, `docs/operations/01-new-project.md` and their twins under `ru/`). The checklist names `pnpm site:build` and `.vitepress/dist`, keeps the Pages switch and the `curl` check, and no longer warns about two copies of the write-up. The description, the topics, the tagline and the addresses match across `docs/showcase/identity.md`, `docs/showcase/listings.md`, `README.md`, `README.ru.md`, `docs/index.md`, `docs/index.ru.md` and `.vitepress/config.mts`. "Done looks like" names the pages, the language switch, the demo and the write-up. The added test in `apps/cli/test/user-guides.test.ts` pins the three README routes, which nothing checked before; `node --test apps/cli/test/checklist.test.ts` and `LANGUAGE=C pnpm test` pass (1002 passed, 1 skipped).
- Kept: `apps/cli/test/user-guides.test.ts` asserts the header's `href="…"` literals, so a later move to Markdown links would fail it. Kept because the header is HTML and the assertion pins the three routes; matching without `href` would also make the home address pass as a prefix of the other two.
