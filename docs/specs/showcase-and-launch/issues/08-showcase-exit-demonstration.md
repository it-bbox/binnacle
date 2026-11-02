# 08: The exit demonstration of epic 24

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 09, 10, 11, 12, 13, 14, 15
Spec: `docs/specs/showcase-and-launch/spec.md`

**What to build:** epic 24's exit criterion, demonstrated by the owner (the spec's exit criterion, as *The storefront, reworked* of 2026-11-01 carries it). The posts are the owner's and are not a criterion.

- [ ] The GitHub repository opens with the logo, the wordmark, the tagline, the badges and the links; the demo GIF and the screenshots follow, with the requirements and the install path.
- [ ] The site is live on GitHub Pages as a documentation site — the redesigned landing with its explanatory graphic, the quick start, the guides and the write-up — in both languages, with the demo loading, working search and language links.
- [x] The `@it-bbox/binnacle` manifest carries the keywords and the description the storefront uses. They reach the npm page with the next release, which this epic does not cut: the only change in the package is the manifest's strings.
- [ ] Binnacle appears in the Claude plugin marketplace, the MCP directories and the awesome lists.
- [ ] The launch checklist is in place and matches the storefront as it now stands.

The npm-backed MCP Registry submission needs a published release carrying the ownership marker from ticket 14; 0.7.1 has none. The owner cuts that release separately, before the Registry submission. Epic 24 prepares the metadata and does not publish a release itself.

## Comments

### Run on 2026-11-02

From `feat/showcase-exit-demonstration`, read-only against GitHub, Pages, npm and the listings; nothing was applied, submitted or published.

- **Criterion 3 holds.** `publishManifest` writes the description of `docs/showcase/identity.md`, its twelve keywords and `mcpName: io.github.it-bbox/binnacle` into `apps/cli/dist/package.json`; `apps/cli/package.json` itself only gains them in the build. npm still serves 0.7.1, with no keywords, until the owner's next release.
- **Criterion 5 did not hold; fixed** (`bc98684`). The checklist's *Done* lines described the storefront before tickets 09 and 15: the README opening with the demo GIF, and a landing with the demo GIF and then `npm i -g`. They now name the README header (logo, wordmark, tagline, badges, links, then the demo and screenshots) and the landing (the graphic, the install commands second, the four dashboard views with their lightbox, search in each language). The README and its twin said the site shows "the demo"; they now say the dashboard. `checklist.test.ts` pins both *Done* lines, red first.
- **The site is live but behind.** Pages serves `edd9fda`, its last run on 2026-11-01 green: `/`, `/ru/`, both quick starts and the write-up answer `200`, and the checklist's `curl` prints `served`. Tickets 12 to 15 reach it only once `main` is pushed.
- **Not applied yet:** the repository has no description, no topics and Discussions off; neither awesome list, the MCP Registry nor `claude-plugins-official` names Binnacle. Each is the owner's step below.
- `pnpm typecheck` passes; `LANGUAGE=C pnpm test`: 1008 of 1008, none skipped.

### For the owner

In this order. The branch is merged into `main` while this ticket still says `Status: READY`; `DONE` comes on this branch once the criteria hold, merged again.

1. **Push `main`** and wait for the *CI* and *Pages* runs on that commit to go green under **Actions**.
2. **Criterion 1.** Open `https://github.com/it-bbox/binnacle`: the logo, *Binnacle Dev*, the tagline, the four badges and the row of links, then the demo GIF, the four screenshots, the requirements and the install path. Every image loads, and *Русская версия* opens the twin.
3. **Criterion 2.** Open `https://it-bbox.github.io/binnacle/`, in English and Russian, at desktop and phone width: the graphic in the hero, the install commands second, the four views (Overview, Tasks, Usage, Attention), each opening in the lightbox; on a guide, the language switch keeps the same page; search finds a guide in each language; the write-up opens from the landing. `curl -fsSL https://it-bbox.github.io/binnacle/ | grep -q 'Binnacle Dev' && echo served` prints `served`.
4. **Criterion 4**, by `docs/showcase/listings.md`, *What the owner must do, in order*: the description and the topics from `identity.md` in the repository's settings; the plugin to `claude-plugins-official`; mcp.so and Smithery; the two awesome-list pull requests. The release carrying `mcpName`, the MCP Registry entry and the PulseMCP and Glama check come after, with the release cut on its own. The criterion holds once each target lists Binnacle or has its submission open; write each link here.
5. **Criterion 5.** With 2 and 3 in front of you, read `docs/showcase/launch-checklist.md`'s *Done* lines: each says what you saw.
6. Turn on **GitHub Discussions** before any post (the checklist's step 4).
