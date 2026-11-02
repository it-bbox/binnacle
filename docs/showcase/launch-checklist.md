# The launch checklist

Four steps, in this order: the README, the site, the listings, the posts. Each says where its artifact lives and what done looks like.

Everything below is the owner's hand. The repository prepares the artifacts, but nothing is applied, published, filed or posted for you: the GitHub settings, the Pages switch, every listing and every post are yours, from your accounts.

## 1. The README

**Where it lives:** `README.md`, its Russian twin `README.ru.md`, and the demo assets they embed — `assets/demo.gif` and the screenshots `assets/overview.png`, `assets/tasks.png`, `assets/usage.png`, `assets/attention.png`.

- [ ] Open the repository's page on GitHub and check the README it shows.

**Done looks like:** the page opens with the logo, the wordmark *Binnacle Dev*, the tagline, the badges — CI, npm, the license and the Node baseline — and a row of links to the site, the quick start, the guides, the containers, the mod and Discussions; the demo GIF and its four screenshots follow; the requirements — Node.js 24 LTS and the loopback port, `127.0.0.1:7717` by default — and the one sentence on why not Docker come before any reference page; the install path is `binn init` and then the agent's skills; the English README links the Russian twin and the twin links back; every image loads.

## 2. The site

**Where it lives:** the VitePress project at the repository root — its config in `.vitepress/config.mts`, its theme in `.vitepress/theme/`, and its own pages `docs/index.md` and `docs/index.ru.md`; the guides in `docs/operations/` and the write-up `docs/showcase/write-up.md` with its Russian twin `docs/showcase/write-up.ru.md` are built into it where they are. `pnpm site:build` writes `.vitepress/dist`, which `.github/workflows/pages.yml` publishes to `https://it-bbox.github.io/binnacle/`.

- [ ] In the repository's **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. This is a one-time switch.
- [ ] Wait for the latest *Pages* run under **Actions** to finish.
- [ ] Open `https://it-bbox.github.io/binnacle/` and switch between English and Russian.

**Done looks like:** the landing opens with the mark and *Binnacle Dev*, a plain-language lead, the platform line and the badges, beside a graphic of the project's sources → Binnacle → the person and the coding agent; the install commands come second, with the requirements and the port caveat; four dashboard views follow — Overview, Tasks, Usage and Attention — each in the selected theme and opening in an on-page lightbox; the quick start, every guide, the write-up and the containers and mod page are each one click away; the switch between English and Russian keeps the reader on the same page, and search answers in each language; the README's links to the home, the quick start and the guides resolve. `pnpm site:preview` shows the same locally. From a terminal, this prints `served`:

```bash
curl -fsSL https://it-bbox.github.io/binnacle/ | grep -q 'Binnacle Dev' && echo served
```

The write-up's figures are one reading of 31 October 2026; re-read `usage_get` when they are refreshed.

## 3. The listings

**Where it lives:** `docs/showcase/listings.md` holds every target, the text to paste and the steps below; the description and the topics are in `docs/showcase/identity.md`.

The owner's ordered steps, from [listings.md](listings.md), *What the owner must do, in order*:

- [ ] Apply the description and the topics from [identity.md](identity.md) in the repository's settings; the listing texts assume them.
- [ ] Submit the plugin to the official Claude Code plugin marketplace, `claude-plugins-official`.
- [ ] Submit to mcp.so and Smithery.
- [ ] Open the two awesome-list pull requests: `punkpeye/awesome-mcp-servers` and `hesreallyhim/awesome-claude-code`.
- [ ] Cut a release of `@it-bbox/binnacle` whose manifest carries `mcpName: io.github.it-bbox/binnacle`, separately from this launch; the published 0.7.1 does not, and the registry reads the marker from the package on npm.
- [ ] Once that release is on npm, publish the entry to the official MCP Registry, `registry.modelcontextprotocol.io`, with the `server.json` in [listings.md](listings.md).
- [ ] Check PulseMCP and Glama after the registry entry, and submit there only if the entry is missing.

**Done looks like:** the repository page shows the description and the twelve topics; the plugin is listed in the marketplace; the two catalogs and the two lists carry Binnacle; the release carrying `mcpName` is on npm and the registry entry is published; every text filed is the one in [listings.md](listings.md).

The launch itself releases nothing. The first four steps need no release; only the registry entry, and the check after it, wait on the owner's release, cut on its own before that step. The npm keywords reach the package page with that same release.

## 4. The posts

**The owner's.** The posts are not part of the epic, no text for them is prepared in this repository, and nothing here waits on the code: the channels are Reddit, Hacker News, X, Habr and Telegram.

- [ ] Turn on **GitHub Discussions** in the repository's settings, so that questions have a home from the first post. A subreddit of its own waits until users ask questions.
- [ ] Post in the channels, close together, each linking the repository and the site.

**Done looks like:** each post is live and links `https://github.com/it-bbox/binnacle` and `https://it-bbox.github.io/binnacle/`; questions arrive in GitHub Discussions; the repository itself changes nothing for this step.
