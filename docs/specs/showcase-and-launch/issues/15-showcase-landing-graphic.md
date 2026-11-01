# 15: A considered landing with an explanatory project-memory graphic

Status: READY_FOR_REVIEW
Triage: ready-for-agent
Blocked by: 09, 10, 11
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** redesign the English and Russian landing pages around a concrete explanation of the tool and a useful first-use example. This reflects the owner's revised direction on 2026-11-01; it supersedes the earlier compass/provider selector and requirement to keep every screenshot on the landing. Standard documentation stays as it is.

- [x] The hero names **Binnacle Dev** and describes a local app and agent skills: tasks, portable project context, progress and token usage. Use the favicon mark in the header. Keep the quick start and guide links visible.
- [x] Replace the compass and provider names with restrained abstract SVG artwork. It carries no controls, simulated activity or invented telemetry; it is omitted on phones to keep installation nearby.
- [x] The CI/npm/license/Node badges sit directly below the platform line in the hero's text column. Remove its non-copyable inline npm command.
- [x] Installation is the second section: copyable commands install Binnacle, start its daemon, initialise the current project and open the dashboard. Retain the requirements and autostart port caveat.
- [x] Replace the automatic slideshow and four-image gallery with one visitor-controlled scenario: find a ready task, check its requirements, copy its start command. Use actual English dashboard captures from a labelled example project, with no personal data or fabricated activity.
- [x] All three steps and full-size links match the selected light/dark theme. Step controls work with pointer and keyboard and expose selection. No autoplay or new dependency.
- [x] Preserve header-aligned content, a 60/40 text/media split on desktop, text before media on phones, and equal content in both languages. At 375 px and 1440 px nothing overflows horizontally.
- [x] Keep documentation routes and sources, the README's existing media and repository/npm links. Build the site, update its artifact checks and inspect both themes/languages in the browser.

## Capture notes

`assets/tour/` contains six 1280×720 JPEG captures of the actual dashboard, taken on 2026-11-01. The isolated **Example shop** project uses the local Markdown tracker: cart `DONE`, checkout validation `READY` after the cart, receipt `READY` but waiting for validation, keyboard review `READY_FOR_REVIEW`. It has no agent runs or usage records. The shown `/tmp/binnacle-example-…` path belongs to that disposable sample, not a user's project.

The sequence opens Project, opens checkout validation, then scrolls to its start command and copies it. Both themes show the same project and actions; colours come from the dashboard's own theme. Captures are unretouched. The temporary harness uses `startTestDaemon`, a copied dashboard build and browser-only theme/language preferences; it never reads the user's harness sessions or changes their daemon. No capture server is needed by the website.

## Comments

### Earlier review (superseded presentation)

Reviewed against `00ea3cd` on 2026-11-01, with separate Standards and Spec reviews. Neither found a concrete issue. The implementation changes the two landing pages, their theme component and landing styles; the only shared navigation change is the small brand mark. Guide sources and the documentation layout stay unchanged.

The illustration is native Vue/SVG/CSS. Selecting Claude Code, Codex or Gemini CLI updates only its local explanatory destination; the source cards and project memory persist. Native buttons expose their selected state, support keyboard activation and show focus. Motion runs once on a selection and honours reduced motion. No agent is started, and no telemetry is invented.

Checks: `node --test apps/cli/test/site.test.ts` — 9 pass; `LANGUAGE=C pnpm test` — 1004 pass, 0 fail; `pnpm typecheck` — pass. The site checks build both languages, resolve links, images and fragments, and reject private paths in the output. Imported media fixes the development server's handling of assets outside `docs/` while the build emits portable hashed URLs.

Browser checks: English and Russian at 375 px and 1440 px, dark and light themes, agent selection by pointer and keyboard, selected state, loaded local media and no horizontal page overflow. The four screenshot links open their full-size assets. Reduced motion was checked in the stylesheet; a separate media-preference emulation was not available in the browser tooling.

Tickets 12 to 14 remain open by design: this ticket does not implement the independent review's locale, quick-start or Registry corrections. Ready for the owner's review and merge; nothing was pushed or deployed.

Follow-up on the owner's layout corrections: the landing takes the header's maximum width and breakpoint-specific gutters. Browser measurements confirmed equal left and right content edges. The desktop demo has a wider left column for its description and three explanatory points, with the smaller GIF on the right; below 768 px the whole text column precedes the GIF. Both language pages changed together. The rebuilt site's 9 artifact checks pass; the local preview was restarted after the build so its asset list is current.

### Revised landing verification, 2026-11-01

Implemented the owner's subsequent corrections recorded above. The previous provider-selector illustration and landing media review describe a superseded version. The hero now defines the product in plain language, uses the favicon mark, keeps the badges below the platform line and leads into the installation section. One three-step walkthrough replaces the gallery and GIF on the site; the README keeps its original assets.

Checks after the revision: `LANGUAGE=C pnpm test` — 1004 pass, 0 fail; `pnpm typecheck` — pass. Site artifact checks cover the new section order, badge position, copy control, three accessible steps and all six themed captures, alongside routes and privacy checks. Browser checks covered English and Russian at 375 px and 1440 px, the matching image after a manual theme change, step selection by pointer and Enter, and exact clipboard contents for all four installation commands. No horizontal overflow at either width. The preview was restarted after the final build to serve the current asset hashes.

The example daemon was stopped after capture. The website needs only its static build. No dependencies, dashboard source changes, publication or merge; tickets 12 to 14 remain separate.
