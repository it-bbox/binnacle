# 15: A considered landing with an explanatory project-memory graphic

Status: READY_FOR_REVIEW
Triage: ready-for-agent
Blocked by: 09, 10, 11
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** redesign the English and Russian landing pages around a concrete explanation of the tool and a useful first-use example. This reflects the owner's revised direction on 2026-11-01; it supersedes the earlier compass/provider selector, abstract wave and three-frame task walkthrough. Standard documentation stays as it is.

- [x] The hero names **Binnacle Dev** and describes a local app and agent skills: tasks, portable project context, progress and token usage. Use the favicon mark in the header. Keep the quick start and guide links visible.
- [x] Use the actual dashboard overview in the hero, with its light/dark versions. No abstract wave or provider-selector graphic. Omit the hero preview on phones to keep installation nearby; all four dashboard views remain below.
- [x] The CI/npm/license/Node badges sit directly below the platform line in the hero's text column. Remove its non-copyable inline npm command.
- [x] Installation is the second section: copyable commands install Binnacle, start its daemon, initialise the current project and open the dashboard. Retain the requirements and autostart port caveat.
- [x] Show four distinct dashboard pages: Overview, Project (tasks), Usage and Attention. Use actual English captures from an explicitly labelled sample dataset. Do not count a scrolled or cropped version of the same page as a separate view.
- [x] All four views and full-size links match the selected light/dark theme. View controls work with pointer and keyboard and expose selection. No autoplay or new dependency.
- [x] Preserve header-aligned content, a 60/40 text/media split on desktop, text before media on phones, and equal content in both languages. At 375 px and 1440 px nothing overflows horizontally.
- [x] Keep documentation routes and sources, the README's existing media and repository/npm links. Build the site, update its artifact checks and inspect both themes/languages in the browser.

## Capture notes

`assets/tour/` contains eight 1280×720 JPEG captures: Overview, Project, Usage and Attention in light and dark, taken on 2026-11-01. The isolated **Example shop** uses the local Markdown tracker. Three synthetic harness records in disposable Git worktrees supply sample token counts and recent activity; the UI labels these captures **sample data**. They are not measurements of Binnacle's development or claims about an agent's performance. Missing provider and reasoning fields stay unavailable.

Each capture opens a distinct dashboard route at the top of the page. The same overview is reused explicitly in the hero. Both themes use the dashboard's own colours; captures are unretouched. The temporary harness uses `startTestDaemon`, a copied dashboard build and isolated artifact directories, never the user's daemon or sessions. The four discarded task/detail captures were removed. No capture server is needed by the website.

## Comments

### Earlier review (superseded presentation)

Reviewed against `00ea3cd` on 2026-11-01, with separate Standards and Spec reviews. Neither found a concrete issue. The implementation changes the two landing pages, their theme component and landing styles; the only shared navigation change is the small brand mark. Guide sources and the documentation layout stay unchanged.

The illustration is native Vue/SVG/CSS. Selecting Claude Code, Codex or Gemini CLI updates only its local explanatory destination; the source cards and project memory persist. Native buttons expose their selected state, support keyboard activation and show focus. Motion runs once on a selection and honours reduced motion. No agent is started, and no telemetry is invented.

Checks: `node --test apps/cli/test/site.test.ts` — 9 pass; `LANGUAGE=C pnpm test` — 1004 pass, 0 fail; `pnpm typecheck` — pass. The site checks build both languages, resolve links, images and fragments, and reject private paths in the output. Imported media fixes the development server's handling of assets outside `docs/` while the build emits portable hashed URLs.

Browser checks: English and Russian at 375 px and 1440 px, dark and light themes, agent selection by pointer and keyboard, selected state, loaded local media and no horizontal page overflow. The four screenshot links open their full-size assets. Reduced motion was checked in the stylesheet; a separate media-preference emulation was not available in the browser tooling.

Tickets 12 to 14 remain open by design: this ticket does not implement the independent review's locale, quick-start or Registry corrections. Ready for the owner's review and merge; nothing was pushed or deployed.

Follow-up on the owner's layout corrections: the landing takes the header's maximum width and breakpoint-specific gutters. Browser measurements confirmed equal left and right content edges. The desktop demo has a wider left column for its description and three explanatory points, with the smaller GIF on the right; below 768 px the whole text column precedes the GIF. Both language pages changed together. The rebuilt site's 9 artifact checks pass; the local preview was restarted after the build so its asset list is current.

### Earlier three-step revision (superseded), 2026-11-01

Implemented the owner's subsequent corrections recorded above. The previous provider-selector illustration and landing media review describe a superseded version. The hero now defines the product in plain language, uses the favicon mark, keeps the badges below the platform line and leads into the installation section. One three-step walkthrough replaces the gallery and GIF on the site; the README keeps its original assets.

Checks after the revision: `LANGUAGE=C pnpm test` — 1004 pass, 0 fail; `pnpm typecheck` — pass. Site artifact checks cover the new section order, badge position, copy control, three accessible steps and all six themed captures, alongside routes and privacy checks. Browser checks covered English and Russian at 375 px and 1440 px, the matching image after a manual theme change, step selection by pointer and Enter, and exact clipboard contents for all four installation commands. No horizontal overflow at either width. The preview was restarted after the final build to serve the current asset hashes.

The example daemon was stopped after capture. The website needs only its static build. No dependencies, dashboard source changes, publication or merge; tickets 12 to 14 remain separate.

### Four-view correction, 2026-11-01

The owner rejected the unrelated wave and the near-duplicate task/detail frames. The hero now shows the actual overview; the lower selector has four distinct routes: Overview, Project, Usage and Attention. Each has light/dark captures and matching full-size links. The sample activity and token counts are explicitly labelled demonstration data. Badges, the installation section and the desktop text/media proportions stay in their agreed positions.

Verified this correction with `node --test apps/cli/test/site.test.ts` (9 pass), `pnpm typecheck`, and the browser: four distinct image URLs, theme switching, keyboard activation, both languages and no horizontal overflow at 375 px. The desktop hero was inspected at 1440 px. The preview was restarted after the build. The earlier full-suite result above belongs to the preceding revision; it was not repeated for this presentation-only correction.
