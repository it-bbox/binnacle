# 05: The site

Status: DONE
Triage: ready-for-agent
Blocked by: 01, 02
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** a static, bilingual site on GitHub Pages that opens with the tool's name, the demo and the install command, shows the write-up, and links back to the repository and the npm package.

- [ ] One static page, in this repository, is served by GitHub Pages.
- [x] The page opens with the tool's name, the demo GIF and the install command.
- [x] The write-up appears on the page.
- [x] The page is in English and Russian, switched between them, and links back to the repository and the npm package.
- [x] Every image and link on the page resolves, in both languages.

## Comments

### Review

Reviewed the branch against `main` on 2026-10-31, in a sub-agent separate from the implementation.

#### Standards

Fixed:
- `site/index.html`: `display: block` on the tables dropped the table role for some screen readers. Each table is now wrapped in a scrolling `div` and keeps `display: table`; every header cell carries `scope="col"`.
- `apps/cli/test/site.test.ts`: the figure check compared a set of digit runs with the whole write-up, so a reordered or dropped table row could pass. It now compares the page article's digit runs, in order, with the same language's write-up, and compares the two languages' heading and row counts.
- `apps/cli/test/site.test.ts`: image and link targets were collected across both languages, so a Russian block that lost an image passed. Targets are now checked per language.
- `apps/cli/test/site.test.ts`: the public-page patterns now also catch `/Users/`, Windows paths, `.claude`, `.scratch`, `file://` and session UUIDs.

Kept:
- The requirements' numbers (`24`, `127.0.0.1:7717`) sit in the opening section, outside the write-up, because the spec repeats the README's requirements on the site; the figure check covers the write-up's articles, where every number must match the write-up in order.

#### Spec

Fixed:
- The site did not repeat the requirements and the Docker sentence (the spec's *The requirements and the Docker sentence ... and the site repeats the requirements*). Both language sections now carry them, worded as the README and its twin are.
- The install command sat below the four screenshots. It now follows the demo GIF, so the page opens with the name, the demo and the install command.

Checked:
- Both language articles match `docs/showcase/write-up.md` and `write-up.ru.md` figure by figure, in order.
- `site/index.html` is deployed by `.github/workflows/pages.yml` as `_site/index.html` beside a copy of `assets/`, so `assets/...` resolves under `/binnacle/`.
- The page names no local path, worktree, session or ticket.
- The change adds no dependency and touches nothing outside the ticket.
- `pnpm typecheck` passes. `LANGUAGE=C pnpm test`: 989 pass, 1 skipped, 0 fail. Without `LANGUAGE=C`, `apps/cli/test/locale.test.ts` fails on this machine's `LANG=ru_RU.UTF-8`, unrelated to this change.

### The deploy check for the owner

Deploying is the owner's. The one setting to switch on: in the repository's **Settings → Pages → Build and deployment**, set **Source** to **GitHub Actions**. The workflow then publishes `site/` at `https://it-bbox.github.io/binnacle/` on every push to `main`. After the first deployment, this prints `served`:

```bash
curl -fsSL https://it-bbox.github.io/binnacle/ | grep -q '<h1>Binnacle</h1>' && echo served
```
