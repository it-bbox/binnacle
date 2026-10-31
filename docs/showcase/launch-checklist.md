# The launch checklist

Four steps, in this order: the README, the site, the listings, the posts. Each says where its artifact lives and what done looks like.

Everything below is the owner's hand. The repository prepares the artifacts, but nothing is applied, published, filed or posted for you: the GitHub settings, the Pages switch, every listing and every post are yours, from your accounts.

## 1. The README

**Where it lives:** `README.md`, its Russian twin `README.ru.md`, and the demo assets they embed — `assets/demo.gif` and the screenshots `assets/overview.png`, `assets/tasks.png`, `assets/usage.png`, `assets/attention.png`.

- [ ] Open the repository's page on GitHub and check the README it shows.

**Done looks like:** the page opens with the demo GIF and its screenshots; the requirements — Node.js 24 LTS and the loopback port, `127.0.0.1:7717` by default — and the one sentence on why not Docker come before any reference page; the install path is `binn init` and then the agent's skills; the English README links the Russian twin and the twin links back; every image loads.

## 2. The site

**Where it lives:** `site/index.html`, published by `.github/workflows/pages.yml` to `https://it-bbox.github.io/binnacle/`; the write-up it shows is `docs/showcase/write-up.md` with its Russian twin `docs/showcase/write-up.ru.md`, copied into the page itself.

- [ ] In the repository's **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. This is a one-time switch.
- [ ] Wait for the latest *Pages* run under **Actions** to finish.
- [ ] Open `https://it-bbox.github.io/binnacle/` and switch between English and Russian.

**Done looks like:** the page opens with the name, the demo and `npm i -g @it-bbox/binnacle`; both write-ups show the same figures; the demo and screenshots load; the README's link to the site resolves. From a terminal, this prints `served`:

```bash
curl -fsSL https://it-bbox.github.io/binnacle/ | grep -q '<h1>Binnacle</h1>' && echo served
```

The write-up's figures are one reading of 31 October 2026. The site carries a copy of the write-up inside `site/index.html`; if its figures are refreshed later, re-read `usage_get` and update `docs/showcase/write-up.md`, `docs/showcase/write-up.ru.md` and both copies in `site/index.html` together, never one table alone.

## 3. The listings

**Where it lives:** `docs/showcase/listings.md` holds every target, the text to paste and the steps below; the description and the topics are in `docs/showcase/identity.md`.

The owner's ordered steps, from [listings.md](listings.md), *What the owner must do, in order*:

- [ ] Apply the description and the topics from [identity.md](identity.md) in the repository's settings; the listing texts assume them.
- [ ] Submit the plugin to the official Claude Code plugin marketplace, `claude-plugins-official`.
- [ ] Publish the entry to the official MCP Registry, `registry.modelcontextprotocol.io`.
- [ ] Submit to mcp.so and Smithery; check PulseMCP and Glama after the registry entry, and submit there only if the entry is missing.
- [ ] Open the two awesome-list pull requests: `punkpeye/awesome-mcp-servers` and `hesreallyhim/awesome-claude-code`.

**Done looks like:** the repository page shows the description and the twelve topics; the plugin is listed in the marketplace; the registry entry is published and the two catalogs and the two lists carry Binnacle; every text filed is the one in [listings.md](listings.md).

The npm keywords reach the package page with the next release. No release is part of this launch.

## 4. The posts

**The owner's.** The posts are not part of the epic, no text for them is prepared in this repository, and nothing here waits on the code: the channels are Reddit, Hacker News, X, Habr and Telegram.

- [ ] Turn on **GitHub Discussions** in the repository's settings, so that questions have a home from the first post. A subreddit of its own waits until users ask questions.
- [ ] Post in the channels, close together, each linking the repository and the site.

**Done looks like:** each post is live and links `https://github.com/it-bbox/binnacle` and `https://it-bbox.github.io/binnacle/`; questions arrive in GitHub Discussions; the repository itself changes nothing for this step.
