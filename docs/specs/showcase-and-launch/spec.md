# Spec: Showcase and launch

Status: READY
Triage: ready-for-agent

Epic 24, from its grilling's brief, `docs/specs/showcase-and-launch/brief.md` (2026-10-31), and the product inbox entries planned into it, *Showcase and launch* (2026-10-23) and *A first reader's path to installing* (2026-10-24). Exit criterion: the GitHub repository shows a description, topics, a demo GIF and dashboard screenshots in the README; a site on GitHub Pages shows the demo and a write-up from Binnacle's usage data in both languages; the npm package carries keywords; Binnacle is filed in the Claude plugin marketplace, MCP directories and awesome lists; and a launch checklist is in place. The posts are the owner's, not the epic's. The owner confirmed the test seams on 2026-10-31, recorded under *Further Notes*.

## Problem Statement

A visitor who arrives from a post sees a wall of text. The repository has no description, no topics and no image in the README, so the tool does not show itself in seconds, and it is not listed where people look for tools: the Claude plugin marketplace, MCP directories, awesome lists and npm keywords. The one material Binnacle has that others do not — its own usage data, what 220 tickets cost and where the tokens went — is nowhere a visitor can read.

A first reader showed the human path is not obvious first: he read the agent-facing docs, found them long, and worked out his own Docker install before the README's one command. A visitor should see `binn init`, then everything from the agent's skills, before any reference page, and one sentence should say why Docker is not the way.

## Solution

The storefront is the README plus a site. The README gains a demo GIF of the dashboard in action and its screenshots, leads with the install path, states the requirements up front — Node 24 LTS and the loopback port, `127.0.0.1:7717` by default, changed with `BINNACLE_PORT` — and says in one sentence why not Docker, in both languages. The repository gains a description and topics, applied by the owner from strings the epic prepares.

A static, bilingual site on GitHub Pages shows the demo and a write-up from Binnacle's own usage data, kept to summary aggregates: usage by role and by model, rework share, first-pass acceptance and weekly trends, with no individual ticket named. The npm package gains keywords. Binnacle is filed in the Claude plugin marketplace, MCP directories and awesome lists. A launch checklist orders the rest, with the posts marked as the owner's. The epic changes no behaviour and releases nothing.

## User Stories

1. As a visitor arriving from a post, I want the repository to open with a one-line description and topics, so that I know at once what Binnacle is.
2. As that visitor, I want an animated demo of the dashboard in the README, so that I see the tool working in seconds.
3. As that visitor, I want dashboard screenshots beside the demo, so that I can read the details at my own pace.
4. As that visitor, I want the install path first — `binn init`, then everything from the agent's skills — so that I do not wade through the agent-facing docs.
5. As that visitor, I want the requirements up front — Node 24 LTS and the loopback port, `127.0.0.1:7717` by default — so that I know what I need before I try.
6. As that visitor, I want one sentence saying why not Docker, so that I do not retrace that path myself.
7. As a Russian-speaking visitor, I want the same README in Russian, linked both ways, so that I read it in my language.
8. As a visitor, I want the README to point to the container guide and the Claude Code mod, so that a visitor who works that way is answered.
9. As a visitor, I want a site that opens with the tool's name, a demo and the install command, so that the storefront shows Binnacle in seconds.
10. As a Russian-speaking visitor, I want the site in Russian too, so that the storefront speaks both languages.
11. As a visitor, I want the site's write-up to show what Binnacle's own work cost and where the tokens went, so that I see data no other tool shows.
12. As a visitor, I want the site to link back to the repository and the npm package, so that I can go install.
13. As a reader of the write-up, I want usage broken down by role — product, implementation, review and rework — so that I see where effort went.
14. As a reader, I want it by model, so that I see which models carry the work.
15. As a reader, I want the rework share and first-pass acceptance, so that I see the quality levers.
16. As a reader, I want weekly trends, so that I see how the numbers changed.
17. As a reader, I want no individual ticket named, so that the write-up stays a summary.
18. As a developer searching npm, I want the package to carry keywords, so that it is found.
19. As a developer reading the package page, I want a description that matches the repository's.
20. As a Claude Code user, I want the `binnacle` plugin listed in the Claude plugin marketplace, so that I find it there.
21. As a developer browsing MCP directories, I want Binnacle listed, so that I find it where I look.
22. As a developer browsing awesome lists, I want Binnacle listed, so that I find it by topic.
23. As the owner, I want a launch checklist that orders the steps — the README, the site, the listings, the posts — so that I run the launch without missing one.
24. As the owner, I want the checklist to mark the posts as mine, so that the epic's end and my part are clear.
25. As the owner, I want the repository's description and topics as ready strings, so that I apply them in GitHub with one copy.
26. As the owner, I want nothing filed or posted without my hand, so that the launch stays mine.
27. As a reader, I want the README's port statement to be true, so that the autostart service's behaviour with a non-default `BINNACLE_PORT` is checked before the README promises it.
28. As the owner, I want any fix that check turns up to be a ticket of its own, so that epic 24 stays a showcase with no release.

## Implementation Decisions

- **The storefront is the README plus a site.** The site is one static page on GitHub Pages, kept in this repository, in English and Russian with a language switch. The README and the site link to each other.
- **The demo is an animated GIF everywhere.** One GIF of the dashboard in action goes into the README and the site, with static screenshots of the dashboard's pages beside it. The GIF is captured from the running dashboard.
- **The write-up keeps to summary aggregates**, read from Binnacle's own usage data: tokens by role and by model, rework share, first-pass acceptance and weekly trends. No individual ticket or task is named; a calculated reading is marked as such.
- **The repository's description and topics** are prepared as ready strings, applied by the owner in the GitHub settings, not by the epic.
- **The npm package gains keywords**, and its description matches the repository's.
- **The listings are prepared by the epic and filed by the owner**: the Claude plugin marketplace, MCP directories and awesome lists, with the exact targets fixed during slicing. Each submission's text is prepared here, ready to paste; nothing is submitted without the owner.
- **The launch checklist** is a Markdown document that orders the steps — README, site, listings, posts — and marks the posts as the owner's.
- **The requirements and the Docker sentence** land in the README and its twin, in both languages, and the site repeats the requirements.
- **The `BINNACLE_PORT` check** runs as part of the README ticket: it verifies what the README states about the autostart service and a non-default port. A defect it finds is a ticket of its own, outside this epic.
- **Questions go to GitHub Discussions**, which the launch checklist turns on; a subreddit of its own waits until users ask questions.
- **No code, no release.** The epic changes no behaviour and releases no version.

## The storefront, reworked (2026-11-01)

The owner read the finished storefront after ticket 07 and asked for two changes; the Product session of 2026-11-01 recorded them here.

- **The README opens as a landing page.** A centred logo, the wordmark *Binnacle Dev* under it, the tagline, a badge row (CI, the npm version, the license, the Node baseline) and a row of links — the site, the quick start, the guides, the containers, the mod, Discussions. The demo, the screenshots, the requirements and the install path follow, as tickets 01 and 03 left them.
- **The site is a documentation site, not one page.** VitePress, built from the repository's own markdown: the guides in `docs/operations/` and the write-up in `docs/showcase/` stay the only copies, and the build reads them. A landing page, a quick start, the guides, the write-up and the containers and mod, with navigation and search, both languages under one switch, a dark theme by default. The demo GIF must load on the deployed site and in a local preview; the one-page `site/index.html` is removed.
- **The same address, the same rules.** The site keeps `https://it-bbox.github.io/binnacle/`, is deployed by `.github/workflows/pages.yml` from the build output, and nothing is submitted or published by the epic.
- **The exit criterion covers the reworked storefront**: the repository's first screen and the site's pages, not one static page.

The catalogues, the listings, the posts and the no-release rule are unchanged. Ticket 08 stays the exit demonstration and now covers the reworked storefront.

## Independent review and landing revision (2026-11-01)

The owner requested tickets for the independent review's five findings and a new first page. Tickets 12 to 14 address the findings; ticket 15 changes the landing. Ticket 08 waits for all four.

- **Languages and search:** one visible language control preserves the current page at desktop and phone widths; the English-version links inside Russian guides reach their English twins; search returns results in each language. The checks exercise each locale, rather than looking for route strings in a concatenation of every index.
- **The port statement:** both quick starts say that `BINNACLE_PORT` applies with autostart off, as the README already does. Fixing the daemon's environment propagation stays outside this epic.
- **Registry prerequisites:** prepare the npm ownership marker `mcpName: io.github.it-bbox/binnacle` and correct the submission instructions. Published 0.7.1 has no marker; an npm-backed Registry entry therefore needs a subsequent release containing it. This epic prepares metadata and instructions; the owner cuts that release separately. Do not claim that the current release meets every prerequisite.
- **A product landing, with a restrained graphic:** replace the oversized hero logo with a responsive native illustration showing portable project sources, Binnacle's compact context and a choice of coding agent. The owner accepted a graphic instead of a generated bitmap. Subtle motion explains continuity; selecting another agent preserves the project memory. Label the illustration as explanatory, with no invented live metrics, agent execution or autonomous orchestration. Honour reduced motion and keep keyboard controls accessible.
- **The first page only:** improve hierarchy, spacing, calls to action and the presentation of the real demo and screenshots, in both languages and both themes. Keep the established name and tagline, requirements, install path, repository/npm links and route addresses. The documentation retains its standard layout and canonical Markdown sources. Add no dependency and publish nothing.

The five findings were: the visible stock language menu returns to the locale's home; English-version body links on Russian pages point to themselves; Russian search requests an index which was built only as `root`; both quick starts omit the autostart port limitation; and the Registry instructions overlook the required npm ownership marker. The Registry requirement is documented at <https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/package-types.mdx#ownership-verification>.

## Testing Decisions

A good test checks what a person sees, not how a file is laid out. This epic adds no behaviour, so its checks are over the artifacts' files, links and claims.

- **The README and its twin** are already covered by the user-guides test that fails when a guide lacks its twin or a relative link does not resolve; the new links to the GIF, the screenshots and the site pass through it.
- **The images exist**: the demo GIF and the screenshots are present and are the targets the README and the site link to.
- **The site builds**, and every page of both languages exists, with every internal link and image target resolving; no local path, worktree, session or ticket id appears in the output.
- **The npm manifest** carries a non-empty keyword list and a description.
- **The write-up's numbers** are checked against `usage_get` when it is prepared; this is not an automated test.
- **Both languages**: the README, its twin and the site are each in English and Russian, linked both ways.

## Contested points

- **A site, or the README alone.** A site publishes another surface and its own deploy; the README alone shows less. Taken in the grilling: a site, one static page.
- **A full write-up, or summary aggregates.** The full breakdown by ticket is more proof but more disclosure. Taken in the grilling: summary aggregates, no individual tickets.
- **A release in this epic, or none.** A defect found by the `BINNACLE_PORT` check could ship a fix and a new version. Taken in the grilling: no release; a fix is a ticket of its own.

## Out of Scope

- The posts — Reddit, Hacker News, X, Habr and Telegram — which are the owner's.
- Any code change and any release, including a fix for the `BINNACLE_PORT` check's finding.
- A subreddit of its own.
- Paid promotion or advertising.

## Further Notes

- Nothing is posted or filed without the owner: the epic prepares the description, topics, listing texts and checklist, and the owner applies, publishes and posts.
- The test seams were confirmed by the owner on 2026-10-31: the README and its twin, the npm manifest, the site, and the write-up's numbers.
- The epic's slug is `showcase-and-launch`.

## Risks

**What the epic can break.** The README, its Russian twin and their links, which `pnpm test` guards: a missing twin or an unresolved relative link fails the suite. The npm manifest, whose description and keywords reach the published package page. Ticket 03 starts a daemon and exercises the autostart service to check a non-default `BINNACLE_PORT`, so a careless check can disturb the owner's running daemon or its autostart entry.

**The riskiest step.** Ticket 06, the listings: it submits Binnacle to the Claude plugin marketplace, MCP directories and awesome lists — public and outward-facing, not undone by a commit, on the owner's accounts. The spec names no exact targets, and its Further Notes say nothing is filed without the owner.

**What was dropped, and why.** The posts (Reddit, Hacker News, X, Habr, Telegram) are the owner's. A fix for a `BINNACLE_PORT` defect is a ticket of its own, so the epic stays a showcase with no release. A subreddit waits until users ask questions, and paid promotion is out of scope.
