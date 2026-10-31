# Showcase and launch: what the grilling decided

Epic 24's material is `docs/product-inbox.md`: *Showcase and launch* (2026-10-23) and *A first reader's path to installing* (2026-10-24); and the roadmap's line for epic 24. This brief is what `/to-spec` starts from.

## The problem

Binnacle has a few stars and its repository no description, no topics and no image in the README: a visitor who arrives from a post sees a wall of text. Projects like it grow through a storefront that shows the tool in seconds, launch posts close together, listings where people look for tools, and write-ups with real data. Binnacle's own usage data — what 220 tickets cost and where the tokens went — is the material others do not have.

A first reader took the long way round: he read the agent-facing docs, found them long, and set out to install Binnacle in Docker himself before the README's one command. The human path — one `binn init`, then everything from the agent's skills — is not what a visitor sees first.

## The outcome wanted

A visitor who arrives from a post sees Binnacle in seconds and finds it where people look for tools: the GitHub repository carries a description, topics, a demo and dashboard screenshots in the README; a site shows the demo and a write-up from Binnacle's own usage data in both languages; the npm package has keywords; Binnacle is listed in the Claude plugin marketplace, MCP directories and awesome lists; and a launch checklist holds the rest. The posts themselves are the owner's.

## Who it concerns

A visitor from a post, on GitHub or elsewhere; a developer deciding whether to install, in English or Russian; the owner, who runs the launch and posts.

## The systems it touches

- the README and its Russian twin: a demo GIF, dashboard screenshots, the install path first, the requirements up front, the reason not to use Docker;
- the GitHub repository's description and topics;
- a new site, a static page deployed on GitHub Pages, in both languages;
- the npm package's manifest, its keywords;
- the Claude plugin marketplace, MCP directories and awesome lists, where Binnacle is listed;
- a write-up built from Binnacle's own usage data;
- a launch checklist.

## Decided in the grilling, 2026-10-31

- **A site, not the README alone.** The storefront is the README plus a separate site, one static page on GitHub Pages, in this repository, in both languages.
- **The demo is an animated GIF everywhere**, in the README and on the site, with dashboard screenshots beside it.
- **The write-up keeps to summary aggregates**: usage by role and by model, rework share, first-pass acceptance, weekly trends; no individual tickets.
- **The epic files every listing itself**: the Claude plugin marketplace, MCP directories and awesome lists.
- **No code and no release.** The check whether the autostart service keeps a `BINNACLE_PORT` other than the default runs as part of the README ticket, so the README states the truth; a fix, if one is needed, is a ticket of its own after.

Defaults, from the docs and the inbox, not put to the owner:

- **The posts are the owner's** — Reddit, Hacker News, X, Habr and Telegram — not part of the epic.
- **Questions live in GitHub Discussions**; a subreddit of its own waits until users ask questions.
- **The README stays bilingual**, with its Russian twin, by the repository's rules.
- **The requirements come first**: Node 24 LTS, and the loopback port, `127.0.0.1:7717` by default, changed with `BINNACLE_PORT`.
- **One sentence says why not Docker**, in both languages.
- **The repository's description and topics** are prepared by the epic and applied by the owner, who holds the GitHub settings.
- **npm keywords** and the launch checklist's form are picked during slicing.

## Constraints and open questions

- Nothing is posted or filed without the owner: the listings' texts and submissions are prepared here, and the owner publishes and posts as before.
- Open: where the site lives in the repository and how GitHub Pages serves it; which MCP directories and awesome lists exactly; the npm keywords; how the GIF is captured; how the site switches language.
