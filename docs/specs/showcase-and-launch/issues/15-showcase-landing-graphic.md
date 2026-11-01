# 15: A considered landing with an explanatory project-memory graphic

Status: READY
Triage: ready-for-agent
Blocked by: 09, 10, 11
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** redesign the English and Russian landing pages as the owner requested on 2026-11-01. The oversized logo in the hero is replaced by a restrained product graphic, with subtle motion where it explains project continuity. The standard documentation stays as it is.

- [ ] The first screen has a clear headline, concise product explanation and visible links to the quick start and guides. Keep *Binnacle Dev* and the established tagline; use the logo as a small brand mark rather than the hero illustration.
- [ ] A native SVG/CSS illustration explains portable sources, a compact project snapshot and replaceable coding agents. It is labelled as an illustration. Agent selection changes the explanatory destination while the stored context stays; it starts no agent and shows no invented telemetry.
- [ ] Motion is restrained, finishes rather than running unattended forever, and is disabled by `prefers-reduced-motion`. Agent choices are keyboard operable and expose their selected state. Text and controls remain readable in both themes.
- [ ] The real GIF, all four screenshots, linked badges, repository/npm links, requirements, port caveat and install commands remain present. Give the demo and screenshots useful space and structure instead of tiny table cells.
- [ ] Both language versions offer the same experience. At 375 px and 1440 px the page has no horizontal overflow; the illustration, buttons and demo fit, and focus is visible.
- [ ] The docs routes, guide sources and standard documentation layout are preserved. No dependency, raster-image generation pipeline or video runtime is introduced.
- [ ] The site builds and its artifact checks pass, with the landing checks updated for the new intended composition. Run `LANGUAGE=C pnpm test` and inspect both languages and themes in the local preview.

## Notes

The owner first suggested a generated, sober illustration, then explicitly allowed a native graphic or animation. Use Vue, SVG and CSS already available in VitePress. The graphic shows what Binnacle does, rather than an enlarged logo or unrelated decoration. Keep this ticket separate from ticket 12's locale fixes, even where they touch the same theme file.
