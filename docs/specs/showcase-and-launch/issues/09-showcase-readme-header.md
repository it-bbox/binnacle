# 09: The README header

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** the README's first screen as a landing page (the spec's *The storefront, reworked*, 2026-11-01), in `README.md` and `README.ru.md`: the logo, the wordmark, the tagline, the badges and the row of links, above the demo the earlier tickets left.

- [x] `assets/logo.png` is committed as the source, and the header uses a plain version of it — a vector (SVG) if one can be drawn from it, otherwise a copy downsized to about 200–320 px wide — centred, with no glow, shadow or other effect added, in both READMEs, with the wordmark *Binnacle Dev* under it.
- [x] The tagline under the wordmark is the one the README already carries — **One project memory. Any coding agent.** — with the second line, **Claude today. Codex tomorrow. Your project never starts from zero.**, kept beneath it.
- [x] A badge row follows the wordmark: CI (the `ci.yml` workflow), the npm version of `@it-bbox/binnacle`, the license from `LICENSE`, and the Node baseline from `engines`. Each badge is live — read from GitHub Actions, npm, the license file and `package.json` — and links its target.
- [x] A link row follows the badges: the site, the quick start, the guides, the containers, the mod and Discussions.
- [x] The demo, the screenshots, the requirements and the install path follow unchanged; the install path still precedes the first `docs/` reference in both READMEs, and both twins carry the same header and link each other.
- [x] `node --test apps/cli/test/user-guides.test.ts` passes, and the header adds no local path, worktree path, session or ticket id.

## Notes

- The wordmark is *Binnacle Dev*, as the owner asked on 2026-11-01. Everywhere else the product is *Binnacle*; this line is the only place that carries the second word.
- The logo is a plain mark, as the owner said on 2026-11-01: it is not made to glow, and no effect is added around it. A vector is preferred because it stays sharp at any size and weighs a fraction of the PNG.
- Badge images are read at render time from their services, so nothing in the repository goes stale; the license and Node values are the ones the repository already declares.
- A badge that reports a live failure (CI red on `main`) is shown as it is, not hidden.

## Comments

### Review

Reviewed the branch against `main` on 2026-11-01, in a sub-agent separate from the implementation, on two axes: the project's standards and the ticket's spec; a follow-up re-checked the logo switch.

Standards: none. Each commit is authored and committed by `miker059@gmail.com`, with an English subject and no trailers; the change touches `README.md`, `README.ru.md` and the logo asset only, with no new dependency and no emoji. The header's raw HTML renders on GitHub: the blocks are separated by blank lines, `align`, `width` and `name` pass the sanitizer, and every `#` anchor matches a heading slug or an `<a name>` target (`#install`, `#user-guides`, `#containers`, `#mod`; `#установка`, `#руководства`).

Spec: none. A centred 280 px logo with no glow, shadow or other effect; the wordmark *Binnacle Dev*; the two tagline lines; four live badges, each linking its target — CI (`github/actions/workflow/status`, passing), npm (`v0.7.1`), license (`Apache-2.0`, from the repository's `LICENSE`) and Node (`>=24 <27`, from `engines`); six links; the demo, the screenshots, the requirements and `## Install` unchanged, and the first `docs/` reference after them (line 81 in both files); the twins carry the same header and link each other; no local path, worktree path, session or ticket id.

Fixed during review, after the owner read the preview:
- The first header used a traced, flattened copy of `assets/logo.png`, and the mark lost its shape at header size. The owner supplied the real vector, `assets/logo.svg`, and the header now uses it as it came; the traced copy is gone.

Kept:
- The Containers and Mod links are same-page anchors, not `docs/` links: any `docs/` link in the header would put a reference before the install path, which the ticket forbids. An `<a name>` on each of the two `## More` bullets keeps both reachable.
- The Node badge reads `engines` from npm's copy of the published package and links the repository's `package.json`; both declare `>=24 <27`.
- The SVG's canvas is 1536×1024 with the source's margins, so at `width="280"` the visible mark is about 177 px. The width stays as the ticket and the owner fixed it; ticket 10 uses the same asset on the site.

### Decisions

- **The header uses the owner's own vector.** `assets/logo.svg` is the header image in both READMEs, added to the repository by the owner; nothing was redrawn, retraced or recoloured, and `assets/logo.png` stays as the raster source.
- **The link row mixes page anchors and absolute links.** The site and Discussions are absolute; quick start, guides, containers and mod are anchors on the same page, so the install path keeps its place before the first `docs/` reference. Ticket 11 points the site-facing links at the site's pages once the documentation site exists.
- **The badges read at render time.** Shields serves the CI workflow status, the npm version, the repository's license and the package's `engines`, so nothing in the repository goes stale; a red CI on `main` shows as it is.

Checked: `node --test apps/cli/test/user-guides.test.ts` — 2 pass. `pnpm typecheck` — exit 0. `LANGUAGE=C pnpm test` — 999 pass, 1 skipped, 0 fail.
