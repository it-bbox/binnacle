# 12: Language navigation and search work in both locales

Status: READY
Triage: ready-for-agent
Blocked by: 10
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** fix the independent review's three locale defects, as the spec's *Independent review and landing revision* requires. They share the VitePress route and locale configuration.

- [ ] Every page has one visible language control at phone and desktop widths, including 1440 px; it preserves the current page in both directions. The stock control no longer sends a reader from `/quick-start` to `/ru/`.
- [ ] The `English version` links inside all Russian guides and the write-up reach the English twin, rather than the same Russian page. Other guide links stay in their intended locale, and external `.ru` addresses remain external.
- [ ] Search on a Russian page returns Russian documents; search on an English page returns its documents. Index routing agrees with the rewritten `/ru/` paths. No missing index leaves a blank search window.
- [ ] Regression checks distinguish each locale's available index and resolve body twin links to the intended language. Verify the visible desktop language control, not only the custom link in generated HTML.
- [ ] The site builds, its internal links and fragments resolve, and `LANGUAGE=C pnpm test` passes.

## Notes

Review evidence: `.vitepress/theme/style.css:44` loses to VitePress's scoped desktop selector; `.vitepress/config.mts` transforms `.ru` links but misses English twins from rewritten Russian pages; VitePress 1.6.4 chooses search buckets from original `*.ru.md` source paths, while the runtime requests `ru`. `site.test.ts` currently concatenates every index, which misses that failure. Do not change the documentation's design or add a search service.
