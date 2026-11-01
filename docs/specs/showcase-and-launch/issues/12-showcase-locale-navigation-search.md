# 12: Language navigation and search work in both locales

Status: READY
Triage: ready-for-agent
Blocked by: 10
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** fix the independent review's three locale defects, as the spec's *Independent review and landing revision* requires. They share the VitePress route and locale configuration.

- [ ] Every page has one visible language control at phone and desktop widths, including 1440 px; it preserves the current page in both directions. The stock control no longer sends a reader from `/quick-start` to `/ru/`.
- [x] The `English version` links inside all Russian guides and the write-up reach the English twin, rather than the same Russian page. Other guide links stay in their intended locale, and external `.ru` addresses remain external.
- [x] Search on a Russian page returns Russian documents; search on an English page returns its documents. Index routing agrees with the rewritten `/ru/` paths. No missing index leaves a blank search window.
- [ ] Regression checks distinguish each locale's available index and resolve body twin links to the intended language. Verify the visible desktop language control, not only the custom link in generated HTML.
- [x] The site builds, its internal links and fragments resolve, and `LANGUAGE=C pnpm test` passes.

## Notes

Review evidence: `.vitepress/theme/style.css:44` loses to VitePress's scoped desktop selector; `.vitepress/config.mts` transforms `.ru` links but misses English twins from rewritten Russian pages; VitePress 1.6.4 chooses search buckets from original `*.ru.md` source paths, while the runtime requests `ru`. `site.test.ts` currently concatenates every index, which misses that failure. Do not change the documentation's design or add a search service.

## Comments

### Decisions

- **No stock language menu at all.** Both locales have an empty `label`: VitePress draws its own menus (the bar's from 1280 px, the "..." flyout's and the phone menu screen's) only for a labelled locale, and they lead to the other locale's home. The CSS that tried to hide them is gone. `LanguageSwitch.vue` stays in the bar at every width, and no longer repeats in the opened phone menu, so a page shows one control.
- **Twin links are routed from the source file.** The link rule reads the href before VitePress rewrites it: `name.ru.md` on an English page goes to `ru/`, and `name.md` on a Russian page goes back to the English route, both resolved from the source page's folder. Links with a scheme, a leading `/` or `#`, and links that climb out of `docs/` are left to VitePress.
- **Search keeps VitePress's one index and filters per locale.** VitePress 1.6.4 files every page in the `root` index by its source path, so a Russian page asked for a `ru` index that did not exist. A Vite plugin in `config.mts`, `binnacle:search-locales`, adds a `ru` entry pointing at the `root` index to the search box's index map. An index VitePress builds for `ru` itself still wins. Each locale's `miniSearch.searchOptions.filter` keeps only its own language's documents. The filters spell out `/binnacle/ru/` because VitePress serializes a function by its source text. The landing pages have no section heading, so search finds them in neither language, as before.

### Next ticket

- `site.test.ts` now reads the site data from the built HTML (`siteData()`) and runs each locale's search through the built box's index map and filter. A later change to the search options shows up there.
- No browser could run in this sandbox: Chrome cannot create its socket. The checks read the built HTML, the site data and the search chunks.

### Check for a person: the language switch on screen

Run `pnpm site:build && pnpm site:preview`, then open `http://localhost:4173/binnacle/quick-start` at 1440 px wide:

1. The header shows one `Русский` link and no globe menu. Clicking it opens `/binnacle/ru/quick-start`, where the header shows one `English` link back to `/binnacle/quick-start`.
2. At 375 px, on `/binnacle/ru/operations/07-containers`: the link sits next to the menu button without pushing the title out. Opening the menu adds no second language control.
3. On `/binnacle/ru/quick-start`, open search and type `контейнер`: results are Russian pages under `/binnacle/ru/`. On `/binnacle/quick-start`, `container` finds only English pages.

If all three hold, tick the first and the fourth criteria.

### Review

Done by a separate sub-agent against `main`, on the project's standards and on this ticket's spec. Nothing must be fixed.

- **Fixed:** `.vitepress/config.mts`, link rule. A link that climbed out of `docs/` (`../../README.ru.md`) would have been routed to `/binnacle/ru/../README`. Such a link is now left to VitePress, and the comment says so.
- **Fixed:** `.vitepress/config.mts`, search filters. They hard-code `/binnacle/ru/`, which VitePress requires. The comment now says they spell out `base`, and the search test fails if they drift.
- **Kept:** the plugin replaces VitePress's generated `export default {` text. If an upgrade changes that text, the search test fails with "no index for ru".
- **Left to a person:** `apps/cli/test/site.test.ts` reads generated HTML only. The visible control at 375 and 1440 px is the check above, so the first and fourth criteria stay unticked until someone has looked at the page.
