# 10: The site, rebuilt as a documentation site

Status: READY
Triage: ready-for-agent
Blocked by: 01, 02, 05
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** replace the one-page `site/index.html` with a VitePress site built from the repository's markdown (the spec's *The storefront, reworked*, 2026-11-01): a landing page, a quick start, the guides, the write-up, containers and the mod, both languages, navigation and search, a dark theme, still at `https://it-bbox.github.io/binnacle/`.

- [ ] The site is a VitePress project in the workspace, and its pages are built from `docs/` — the guides in `docs/operations/` and the write-up in `docs/showcase/` stay the only copies of their text; no guide is retyped as HTML.
- [ ] A landing page opens with the logo, the wordmark *Binnacle Dev*, the tagline, the badges and the demo GIF, then the install command, the four screenshots and links to the repository, npm and the guides.
- [ ] The site has the pages a reader expects: quick start (install and first steps), every guide under `docs/operations/`, the write-up from Binnacle's own usage data, and a page on containers and the Claude Code mod; a sidebar or navigation reaches each of them, and search covers them.
- [ ] Both languages: every page has its English and Russian version under one language switch, the twins linked both ways, and the switch keeps the reader on the same page.
- [ ] The demo GIF loads on the deployed site and in a local preview; the local preview works without the deployment, so this is checked before publishing.
- [ ] `.github/workflows/pages.yml` builds the site and deploys the build output to the same address; a failed build fails the workflow instead of shipping an empty site.
- [ ] `site/index.html` is removed, and `apps/cli/test/site.test.ts` is replaced by checks over the built output: every page of both languages exists, every internal link and image target resolves, and no local path, worktree, session or ticket id appears.
- [ ] The page is readable on a phone, and keyboard focus and colour contrast hold in both themes.

## Notes

- The GIF failure seen on 2026-11-01 is reproduced and fixed here. The one-page site linked `assets/...` relatively, which resolves only in the deployed artifact — a page opened from the checkout shows nothing. The new build must be right in both places.
- The design follows the dashboard: the dark palette its tokens declare, the logo's blue as the accent, and the dashboard's typography rather than VitePress's defaults. The logo is a plain mark: no glow or other effect is put around it.
- `docs/operations/` and `docs/showcase/` links are written for the repository; a link that would break on the site is either kept inside the site or pointed at the repository's page, and the checks above decide.
- The wordmark is *Binnacle Dev*, as ticket 09 sets it.
