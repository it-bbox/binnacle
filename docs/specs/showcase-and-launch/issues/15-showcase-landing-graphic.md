# 15: A considered landing with an explanatory project-memory graphic

Status: DONE
Triage: ready-for-agent
Blocked by: 09, 10, 11
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** redesign the English and Russian landing pages around a concrete explanation of the tool and a useful first-use example. This reflects the owner's revised direction on 2026-11-01; it supersedes the earlier compass/provider selector, abstract wave and three-frame task walkthrough. Standard documentation stays as it is.

- [x] The hero names **Binnacle Dev** and describes a local app and agent skills: tasks, portable project context, progress and token usage. Use the favicon mark in the header. Keep the quick start and guide links visible.
- [x] Use the agreed project → Binnacle → person/agent graphic in the hero. Name the portable sources, context/task/usage functions, and the person’s responsibility for choosing tasks and starting agents. No duplicated screenshot, abstract wave, provider selector or simulated activity. Adapt the graphic vertically on phones.
- [x] The CI/npm/license/Node badges sit directly below the platform line in the hero's text column. Remove its non-copyable inline npm command.
- [x] Installation is the second section: copyable commands install Binnacle, start its daemon, initialise the current project and open the dashboard. Retain the requirements and autostart port caveat.
- [x] Show four distinct dashboard pages: Overview, Project (tasks), Usage and Attention. Use actual English captures from an explicitly labelled sample dataset. Do not count a scrolled or cropped version of the same page as a separate view.
- [x] All four views match the selected light/dark theme and open in an on-page lightbox. Support previous/next buttons and arrow keys, Escape, close button and backdrop dismissal. Contain focus while open, restore focus and scrolling on close. Keep direct image URLs as the no-JavaScript fallback. No autoplay or new dependency.
- [x] Preserve header-aligned content, a 60/40 text/media split on desktop, text before media on phones, and equal content in both languages. At 375 px and 1440 px nothing overflows horizontally.
- [x] Keep documentation routes and sources, the README's existing media and repository/npm links. Build the site, update its artifact checks and inspect both themes/languages in the browser.

## Capture notes

`assets/tour/` contains eight 1280×720 JPEG captures: Overview, Project, Usage and Attention in light and dark, taken on 2026-11-01. The isolated **Example shop** uses the local Markdown tracker. Three synthetic harness records in disposable Git worktrees supply sample token counts and recent activity; the UI labels these captures **sample data**. They are not measurements of Binnacle's development or claims about an agent's performance. Missing provider and reasoning fields stay unavailable.

Each capture opens a distinct dashboard route at the top of the page. The hero uses a separate explanatory graphic. Both themes use the dashboard's own colours; captures are unretouched. The temporary harness uses `startTestDaemon`, a copied dashboard build and isolated artifact directories, never the user's daemon or sessions. The four discarded task/detail captures were removed. No capture server is needed by the website.

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

### Four-view correction (hero superseded below), 2026-11-01

The owner rejected the unrelated wave and the near-duplicate task/detail frames. The hero now shows the actual overview; the lower selector has four distinct routes: Overview, Project, Usage and Attention. Each has light/dark captures and matching full-size links. The sample activity and token counts are explicitly labelled demonstration data. Badges, the installation section and the desktop text/media proportions stay in their agreed positions.

Verified this correction with `node --test apps/cli/test/site.test.ts` (9 pass), `pnpm typecheck`, and the browser: four distinct image URLs, theme switching, keyboard activation, both languages and no horizontal overflow at 375 px. The desktop hero was inspected at 1440 px. The preview was restarted after the build. The earlier full-suite result above belongs to the preceding revision; it was not repeated for this presentation-only correction.


### Agreed product graphic and lightbox, 2026-11-01

The owner chose the project → Binnacle → person/agent concept before implementation. The hero now shows that static, localized diagram in both themes: Markdown, Git and tracker sources; Binnacle’s context, task state and token usage; the person choosing a task and starting a generic coding agent. The graph stacks vertically on phones. It does not duplicate any dashboard image or imply autonomous agent launching.

The four dashboard screenshots open in a native modal dialog within the page, with selected-theme images, previous/next controls and keyboard arrows. Escape, the close button and the background dismiss it. Native dialog focus containment and return-to-trigger are preserved; background scrolling is locked and restored, including component teardown. Image links remain a direct fallback without JavaScript. Everything ships in the static Pages build, without a service or additional dependency.

Validation: `node --test apps/cli/test/site.test.ts` — 9 pass (including the static build); `pnpm typecheck` and `git diff --check` — pass. Browser checks covered the desktop graph at 1440 px, both languages at 375 px without horizontal overflow, four distinct lightbox pages, theme-matched images, mouse and keyboard navigation, Escape, close button, background dismissal, restored scrolling and return-to-trigger focus. No publication or merge.

### Review

Reviewed `feat/showcase-landing-graphic` against `main` on 2026-11-01, after rebasing it onto `a1a51b0`, in a separate review session on two axes. Standards: commits, authorship, dependencies and SSR safety in order. Spec: all eight criteria met; English and Russian pages match; README media and docs routes untouched.

- Fixed — `apps/cli/test/site.test.ts`: the landing test checked only two install commands. It now requires all four commands, `BINNACLE_PORT` and `127.0.0.1:7717` inside the installation section.
- Fixed — `.vitepress/theme/LandingTour.vue`: focus returned to the trigger only where the browser focuses a clicked link (not Safari). The trigger is kept and focused on close.
- Fixed — the same file: the caption's enlarge link duplicated the image link in the tab order, and its `⤢` was read aloud. The caption link is out of the tab order; the symbol is `aria-hidden`.
- Fixed — the site test now requires the lightbox's three buttons (close, previous, next).
- Kept — the badge check asserts the order after the platform line, not adjacency: the markup has nothing between them, and a stricter string match would break on harmless markup changes.

Checks after the fixes: `pnpm typecheck` — pass; `LANGUAGE=C pnpm test` before the fixes — 1004 tests, 1003 pass, 0 fail; `node --test apps/cli/test/site.test.ts` after them — 9 pass. Nothing pushed or published.
