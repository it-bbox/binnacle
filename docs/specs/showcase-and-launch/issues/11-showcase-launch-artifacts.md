# 11: The launch artifacts follow the reworked storefront

Status: READY
Triage: ready-for-agent
Blocked by: 09, 10
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** the documents the launch runs on, brought into line with the new README header and the documentation site (the spec's *The storefront, reworked*, 2026-11-01).

- [ ] The README and its Russian twin link the site's pages — the home, the quick start and the guides — rather than one address standing for everything.
- [ ] `docs/showcase/launch-checklist.md`'s site step names the build and its output, keeps the owner's Pages switch and the `curl` check, and drops the warning about keeping two copies of the write-up in step: the site now builds from `docs/showcase/write-up.md` and its twin, so there is one copy.
- [ ] `docs/showcase/listings.md` and `docs/showcase/identity.md` still match the README's header and the site: the description, the topics, the tagline and the addresses are the same strings.
- [ ] The site step's "done looks like" describes what a reader now sees — the pages, the language switch, the demo and the write-up — not the one page.
- [ ] `node --test apps/cli/test/checklist.test.ts` passes with whatever the checklist now names, and `LANGUAGE=C pnpm test` passes.
