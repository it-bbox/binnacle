# 15: A considered landing with an explanatory project-memory graphic

Status: READY_FOR_REVIEW
Triage: ready-for-agent
Blocked by: 09, 10, 11
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** redesign the English and Russian landing pages as the owner requested on 2026-11-01. The oversized logo in the hero is replaced by a restrained product graphic, with subtle motion where it explains project continuity. The standard documentation stays as it is.

- [x] The first screen has a clear headline, concise product explanation and visible links to the quick start and guides. Keep *Binnacle Dev* and the established tagline; use the logo as a small brand mark rather than the hero illustration.
- [x] A native SVG/CSS illustration explains portable sources, a compact project snapshot and replaceable coding agents. It is labelled as an illustration. Agent selection changes the explanatory destination while the stored context stays; it starts no agent and shows no invented telemetry.
- [x] Motion is restrained, finishes rather than running unattended forever, and is disabled by `prefers-reduced-motion`. Agent choices are keyboard operable and expose their selected state. Text and controls remain readable in both themes.
- [x] The real GIF, all four screenshots, linked badges, repository/npm links, requirements, port caveat and install commands remain present. Give the demo and screenshots useful space and structure instead of tiny table cells.
- [x] Both language versions offer the same experience. At 375 px and 1440 px the page has no horizontal overflow; the illustration, buttons and demo fit, and focus is visible.
- [x] The docs routes, guide sources and standard documentation layout are preserved. No dependency, raster-image generation pipeline or video runtime is introduced.
- [x] The site builds and its artifact checks pass, with the landing checks updated for the new intended composition. Run `LANGUAGE=C pnpm test` and inspect both languages and themes in the local preview.

## Notes

The owner first suggested a generated, sober illustration, then explicitly allowed a native graphic or animation. Use Vue, SVG and CSS already available in VitePress. The graphic shows what Binnacle does, rather than an enlarged logo or unrelated decoration. Keep this ticket separate from ticket 12's locale fixes, even where they touch the same theme file.


## Comments

### Review

Reviewed against `00ea3cd` on 2026-11-01, with separate Standards and Spec reviews. Neither found a concrete issue. The implementation changes the two landing pages, their theme component and landing styles; the only shared navigation change is the small brand mark. Guide sources and the documentation layout stay unchanged.

The illustration is native Vue/SVG/CSS. Selecting Claude Code, Codex or Gemini CLI updates only its local explanatory destination; the source cards and project memory persist. Native buttons expose their selected state, support keyboard activation and show focus. Motion runs once on a selection and honours reduced motion. No agent is started, and no telemetry is invented.

Checks: `node --test apps/cli/test/site.test.ts` — 9 pass; `LANGUAGE=C pnpm test` — 1004 pass, 0 fail; `pnpm typecheck` — pass. The site checks build both languages, resolve links, images and fragments, and reject private paths in the output. Imported media fixes the development server's handling of assets outside `docs/` while the build emits portable hashed URLs.

Browser checks: English and Russian at 375 px and 1440 px, dark and light themes, agent selection by pointer and keyboard, selected state, loaded local media and no horizontal page overflow. The four screenshot links open their full-size assets. Reduced motion was checked in the stylesheet; a separate media-preference emulation was not available in the browser tooling.

Tickets 12 to 14 remain open by design: this ticket does not implement the independent review's locale, quick-start or Registry corrections. Ready for the owner's review and merge; nothing was pushed or deployed.
