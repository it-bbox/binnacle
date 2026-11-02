# 08: The exit demonstration of epic 24

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 09, 10, 11, 12, 13, 14, 15
Spec: `docs/specs/showcase-and-launch/spec.md`

**What to build:** epic 24's exit criterion, demonstrated by the owner (the spec's exit criterion, as *The storefront, reworked* of 2026-11-01 carries it). The posts are the owner's and are not a criterion.

- [x] The GitHub repository opens with the logo, the wordmark, the tagline, the badges and the links; the demo GIF and the screenshots follow, with the requirements and the install path.
- [x] The site is live on GitHub Pages as a documentation site — the redesigned landing with its explanatory graphic, the quick start, the guides and the write-up — in both languages, with the demo loading, working search and language links.
- [x] The `@it-bbox/binnacle` manifest carries the keywords and the description the storefront uses. They reach the npm page with the next release, which this epic does not cut: the only change in the package is the manifest's strings.
- [x] Binnacle appears in the Claude plugin marketplace, the MCP directories and the awesome lists. *(Read on the owner's decision of 2026-11-02 as: submitted to mcp.so and both awesome lists; the plugin marketplace and Smithery deferred, below.)*
- [x] The launch checklist is in place and matches the storefront as it now stands.

The npm-backed MCP Registry submission needs a published release carrying the ownership marker from ticket 14; 0.7.1 has none. The owner cuts that release separately, before the Registry submission. Epic 24 prepares the metadata and does not publish a release itself.

## Comments

### Run on 2026-11-02

From `feat/showcase-exit-demonstration`, read-only against GitHub, Pages, npm and the listings; nothing was applied, submitted or published.

- **Criterion 3 holds.** `publishManifest` writes the description of `docs/showcase/identity.md`, its twelve keywords and `mcpName: io.github.it-bbox/binnacle` into `apps/cli/dist/package.json`; `apps/cli/package.json` itself carries none of them; only the manifest the build writes does. npm still serves 0.7.1, with no keywords, until the owner's next release.
- **Criterion 5 did not hold; fixed** (`bc98684`). The checklist's *Done* lines described the storefront before tickets 09 and 15: the README opening with the demo GIF, and a landing with the demo GIF and then `npm i -g`. They now name the README header (logo, wordmark, tagline, badges, links, then the demo and screenshots) and the landing (the graphic, the install commands second, the four dashboard views with their lightbox, search in each language). The README and its twin said the site shows "the demo"; they now say the dashboard. `checklist.test.ts` pins both *Done* lines, red first.
- **The site is live but behind.** Pages serves `edd9fda`, its last run on 2026-11-01 green: `/`, `/ru/`, both quick starts and the write-up answer `200`, and the checklist's `curl` prints `served`. Tickets 12 to 15 reach it only once `main` is pushed.
- **Not applied yet:** the repository has no description, no topics and Discussions off; neither awesome list, the MCP Registry nor `claude-plugins-official` names Binnacle; mcp.so and Smithery were not checked. Each is the owner's step below.
- **"The demo" on the site.** Criterion 2's "the demo loading", and the spec's "The demo GIF must load on the deployed site", predate ticket 15, which at the owner's request replaced the GIF on the site with the four dashboard views; the GIF stays in the README. Step 4 below reads "the demo" as those views; the spec's lines are left to a Product session.
- **Criterion 4, as read here.** The marketplace, mcp.so, Smithery and the two awesome lists list Binnacle or have the submission open, since merging a submission is theirs. The Registry entry, which waits on the owner's release, and the PulseMCP and Glama check after it do not hold `DONE`. If the owner reads it otherwise, it is said here before `DONE`.
- `pnpm typecheck` passes; `LANGUAGE=C pnpm test`: 1008 of 1008, none skipped.

### For the owner

In this order. The branch is merged into `main` with `git merge --no-ff` while this ticket still says `Status: READY`, then *After a pull or a merge* in `CONTRIBUTING.md`; `DONE` comes on this branch once the criteria hold, merged again.

1. **Push `main`** and wait for the *CI* and *Pages* runs on that commit to go green under **Actions**.
2. **Turn on GitHub Discussions** in the repository's settings (the checklist's step 4), so that the README's *Discussions* link opens.
3. **Criterion 1.** Open `https://github.com/it-bbox/binnacle`: the logo, *Binnacle Dev*, the tagline, the four badges and the row of links, then the demo GIF, the four screenshots, the requirements and the install path. Every image loads, and *Русская версия* opens the twin.
4. **Criterion 2.** Open `https://it-bbox.github.io/binnacle/`, in English and Russian, at desktop and phone width: the graphic in the hero, the install commands second, the four views (Overview, Tasks, Usage, Attention), each image loading in both themes and opening in the lightbox; on a guide, the language switch keeps the same page; search finds a guide in each language; the write-up opens from the landing. `curl -fsSL https://it-bbox.github.io/binnacle/ | grep -q 'Binnacle Dev' && echo served` prints `served`.
5. **Criterion 4**, by `docs/showcase/listings.md`, *What the owner must do, in order*: the description and the topics from `identity.md` in the repository's settings; the plugin to `claude-plugins-official`; mcp.so and Smithery; the two awesome-list pull requests. The release carrying `mcpName`, the MCP Registry entry and the PulseMCP and Glama check come after, with the release cut on its own. The criterion holds as read in the run above: the first five targets list Binnacle or have their submission open; write each link here.
6. **Criterion 5.** With 3 and 4 in front of you, read `docs/showcase/launch-checklist.md`'s *Done* lines: each says what you saw.

### Review

Run in a sub-agent, 2026-11-02, on the branch's first two commits, against standards and the spec.

#### Standards

- Subjects within 72 characters, one author, no trailers, the README's twin changed with it: none found.
- The checklist test passed a README *Done* line that opened with the demo GIF before the header. **Fixed**: it also refuses "opens with the demo GIF".

#### Spec

- The run said `apps/cli/package.json` gains the description and keywords in the build; the build writes them only into `dist/package.json`. **Fixed** in the run's text.
- Criterion 2 and the spec ask for the demo GIF on the site, which ticket 15 removed. **Fixed**: the run says so and how "the demo" is read; the spec's lines are **left** to a Product session.
- Discussions came last, after criterion 1 checks the README's *Discussions* link. **Fixed**: turned on second.
- The script redefined criterion 4 without saying whether the Registry entry holds `DONE`. **Fixed**: the reading is stated in the run, for the owner to confirm.
- The merge did not say `--no-ff` and *After a pull or a merge*; mcp.so and Smithery were not named as unchecked. **Fixed**.
- The site's *Done* line leaves out the hero's heading and its two buttons. **Kept**: it names what the criterion asks for, not every element.

### The owner's run, 2026-11-02

`main` pushed at `f7c5614`; its *Pages* run green, and the live landing carries ticket 15's graphic.

- **Criteria 1 and 2** (the owner): the repository page and the site, in both languages, checked by hand and found as the script says.
- **Repository settings**, on the owner's yes, with `gh repo edit`: the description and the twelve topics from `identity.md`, and the site as its website. Discussions were already on.
- **Criterion 4.**
  - mcp.so: its site's form is paid only ($39), and paid placement is outside the epic; submitted free as [chatmcp/mcpso#6605](https://github.com/chatmcp/mcpso/issues/6605).
  - `punkpeye/awesome-mcp-servers`: [pull request #18353](https://github.com/punkpeye/awesome-mcp-servers/pull/18353), under *Developer Tools*, opened from the owner's fork on the owner's yes.
  - `hesreallyhim/awesome-claude-code`: [#3423](https://github.com/hesreallyhim/awesome-claude-code/issues/3423), filled in by the owner, since the list takes submissions only from a person through its form.
  - The plugin marketplace: **deferred by the owner.** `claude-plugins-official` takes partners' plugins only; the public form adds to the community marketplace, and the repository's `marketplace.json` names the built `./plugin`, which Git ignores, so a marketplace read from the repository needs work of its own.
  - Smithery: **deferred.** It takes a local stdio server only as an MCPB bundle, which does not exist yet.
  - The MCP Registry, PulseMCP and Glama wait on the owner's release carrying `mcpName`, as the ticket says.
- **Criterion 5.** `listings.md` and the checklist's step 3 now say what was filed and how: the mcp.so issue instead of its paid form, the awesome-claude-code form by hand, the marketplace and Smithery as later steps with their conditions. The checklist's *Done* lines match the storefront the owner checked.

### For a Product session

- A Smithery listing needs an MCPB bundle of `binn mcp`; a community-marketplace listing may need a marketplace the repository itself serves. Each is work of its own.
- The spec's *The storefront, reworked* still asks for the demo GIF on the site, which ticket 15 replaced by the four dashboard views at the owner's request.
- The `it-bbox` organisation's page is unpolished (no pinned repository, description or profile README); the owner may tidy it before the posts.

