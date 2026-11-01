# 09: The README header

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** the README's first screen as a landing page (the spec's *The storefront, reworked*, 2026-11-01), in `README.md` and `README.ru.md`: the logo, the wordmark, the tagline, the badges and the row of links, above the demo the earlier tickets left.

- [ ] `assets/logo.png` is committed as the source, and the header uses a copy sized for reading (about 200–320 px wide), centred, in both READMEs, with the wordmark *Binnacle Dev* under it.
- [ ] The tagline under the wordmark is the one the README already carries — **One project memory. Any coding agent.** — with the second line, **Claude today. Codex tomorrow. Your project never starts from zero.**, kept beneath it.
- [ ] A badge row follows the wordmark: CI (the `ci.yml` workflow), the npm version of `@it-bbox/binnacle`, the license from `LICENSE`, and the Node baseline from `engines`. Each badge is live — read from GitHub Actions, npm, the license file and `package.json` — and links its target.
- [ ] A link row follows the badges: the site, the quick start, the guides, the containers, the mod and Discussions.
- [ ] The demo, the screenshots, the requirements and the install path follow unchanged; the install path still precedes the first `docs/` reference in both READMEs, and both twins carry the same header and link each other.
- [ ] `node --test apps/cli/test/user-guides.test.ts` passes, and the header adds no local path, worktree path, session or ticket id.

## Notes

- The wordmark is *Binnacle Dev*, as the owner asked on 2026-11-01. Everywhere else the product is *Binnacle*; this line is the only place that carries the second word.
- Badge images are read at render time from their services, so nothing in the repository goes stale; the license and Node values are the ones the repository already declares.
- A badge that reports a live failure (CI red on `main`) is shown as it is, not hidden.
