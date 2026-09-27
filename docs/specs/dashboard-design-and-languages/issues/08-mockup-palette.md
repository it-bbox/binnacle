# 08: The mockup's palette, in light and dark

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** found by the owner in the exit demonstration (ticket 06, *Comments*): the dashboard is darker than the mockup. Only the accent was taken from the mockup; the neutrals are Tailwind's `zinc`, whose `zinc-950` background is nearly black. The dashboard takes the mockup's neutral tokens (`design/Binnacle Dashboard.dc.html`, its `:root` and `prefers-color-scheme: dark` blocks), in both themes. Decided in the spec, under *Look and build* and *Further Notes*.

- [x] Nuxt UI's semantic colours (`--ui-bg`, `--ui-bg-muted`, `--ui-bg-elevated`, `--ui-bg-accented`, `--ui-border` and its variants, `--ui-text` and its variants) are set from the mockup's tokens: background, panel, code background, hover, chip, border, strong border, text, muted and faint, in light and in dark.
- [x] The rail and the sidebar take the mockup's own `--rail` and `--sidebar` backgrounds, distinct from the page's.
- [x] Warning, success and error take the mockup's `--warn`, `--ok` and `--err-text` families, with their soft backgrounds and lines where Nuxt UI's soft and outline variants use them.
- [x] The colours stay declared in the stylesheet, as ticket 01 left them: no inline `<style>`, and the daemon's Content-Security-Policy is unchanged.
- [ ] Every page, beside the mockup in the same theme, shows the same background, panel and border tones. A human checks this; the steps are under `## Comments`.

## Comments

- **Where it lives.** `apps/dashboard/app/assets/css/main.css` declares the mockup's tokens, as the mockup names and writes them, for light (`:root, .light`) and dark (`.dark`), and sets Nuxt UI's semantic colours from them. `apps/dashboard/test/palette.test.ts`, which the root `pnpm test` runs, reads the mockup's `:root` and dark blocks and fails when a token's value in the stylesheet differs, or when the stylesheet mentions zinc. `apps/dashboard/app/app.config.ts` gives the warning and error badges and alerts the mockup's soft backgrounds and lines. The shell and the pages name a token directly (`bg-(--rail)`, `bg-(--sidebar)`, `text-(--warn)`) only where no semantic colour stands for it.
- **The mapping.** The page is `--bg`, on `body`. `--ui-bg`, which Nuxt UI puts under cards, menus and the modal, is `--panel`. `--ui-bg-muted` is `--code-bg`, `--ui-bg-elevated` is `--hover` and `--ui-bg-accented` is `--chip`. `--ui-border` and `--ui-border-muted` are `--border`, and `--ui-border-accented` is `--border-strong`. `--ui-text` and `--ui-text-highlighted` are `--text`, `--ui-text-toned` and `--ui-text-muted` are `--muted`, and `--ui-text-dimmed` is `--faint`. The inverted text is `--on-accent`, and the inverted background and border are `--text`. `--ui-primary` is `--accent`, as before.
- **Decided here, where the ticket and spec are silent:**
  - **Text or dot.** The mockup writes warning text in `--warn-text` and draws dots and triangles in `--warn`. Nuxt UI has one `--ui-warning` for both, so it is `--warn-text`, which reads on the panel. The dots (the rail's chip and the freshness line) and the triangles (the attention items, the unreachable state, the missing Review and the warning alert's icon) use `--warn`. `--ui-error` is `--err-text`, and `--ui-success` is `--ok`.
  - **Soft and lines.** A warning soft badge or alert sits on `--warn-soft`. The subtle and outline ones are ringed with `--warn-line`, and the error ones sit on `--err-soft`. The mockup has no soft or line tokens for success, or a line for error, so Nuxt UI's own mix of the colour stays for those.
  - **Quiet badges** (neutral soft and subtle) sit on `--chip`, as the mockup's done and Review badges do, rather than on the hover shade Nuxt UI would give them. The initials squares are on `--chip`, the board's columns on `--sidebar` and a card's latest run on `--code-bg`, as in the mockup.
  - **The numbered shades are gone.** No component the dashboard uses reads a numbered shade: primary, success, warning, error or zinc. So none is declared, and the stylesheet names no Tailwind palette.
  - **Out of scope.** The accent's soft family (`--accent-soft`, `--accent-line`, `--accent-text`) is not taken: the ticket names the neutrals and warning, success and error. A primary soft badge still mixes `--accent` with transparency.
  - **No document changes.** No document describes the palette. The roadmap's focus stays as it is, because tickets 07 and 09 are still ready beside this one, and ticket 06 runs after them.
- **Verified in a browser.** The generated dashboard ran against a daemon on a temporary `BINNACLE_HOME` and port, with this worktree registered, in light and dark at 1280 px. The page, the rail, the sidebar and the cards computed to the mockup's `--bg`, `--rail`, `--sidebar` and `--panel`, and the borders and text to its `--border` and `--text`, in both themes. The board's columns, the latest-run box and the done badges computed to `--sidebar`, `--code-bg` and `--chip`. No warning or error badge was on screen, so the variant classes were checked with Nuxt UI's generated themes and `tailwind-variants` in Node. A warning soft badge resolves to `text-warning bg-(--warn-soft)`, and an outline one to `ring-(--warn-line)`. An error soft badge resolves to `bg-(--err-soft)`, the warning alert's icon to `text-(--warn)`, and a warning chip to `bg-(--warn)`. Every class is in the built stylesheet. `index.html` has no `<style>`, the console showed no CSP violation, and every request went to the daemon.
- **Rebased onto ticket 10.** There were no conflicts. The Settings page uses only Nuxt UI's cards, radio group and semantic colours, and the sidebar keeps `--sidebar`. In the browser, both showed the mockup's page, panel, sidebar and rail tones in light and dark. The typechecks and the suite were rerun after the rebase.
- **For the owner: the criterion left unticked.** Whether the tones match the mockup is a judgement only a human makes. To check it on the running daemon:
  1. `pnpm dashboard:generate`, then `binn dashboard`.
  2. Open `docs/specs/dashboard-design-and-languages/design/Binnacle Dashboard.dc.html` in the same browser, beside it.
  3. With the system theme light, go through Overview, Project, a Task, Usage, Attention, Projects and Settings. The page behind the cards, the cards, the rail, the sidebar and the borders match the mockup's tones on the same page. So do the badges, and the warning lines and triangles.
  4. Switch the system theme to dark and go through them again. The page is the mockup's charcoal (`#111215`), not near-black, and the rail is darker than the sidebar, which is darker than the page.

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violations.** The authorship, the branch name and the test's form follow the repository's rules. Judgement calls:

1. **The test's theme entries named their regexes `mockup` and `stylesheet`**, the same names as the texts they read. **Fixed**: they are `mockupBlock` and `stylesheetBlock`.
2. **`bg-(--warn-soft)` and `bg-(--warn)` are written both in `app.config.ts` and in the shell** (the unreachable icon, the freshness dot). **Kept**: two elements outside Nuxt UI's components, under the rule of three.
3. **`[...warningAndError]` and the alert's `{ root }` reshaping.** **Kept**: they are what the readonly type and the alert's slots need, and they are shorter than writing the five entries twice.

**Spec: criteria 1 to 4 hold.** Findings:

4. **The human check had no steps under `## Comments`.** **Fixed** above.
5. **The neutral soft badge sat on the hover shade**, where the mockup's done and Review badges use `--chip`. **Fixed** in `app.config.ts`.
6. **The initials squares, and the alternatives' icon square, were on the hover shade**, where the mockup uses `--chip`. **Fixed**: `bg-accented`.
7. **The board's columns and a card's latest run were swapped.** The columns were on `--code-bg` and the latest run on `--hover`. The mockup has `--sidebar` and `--code-bg`. **Fixed**.
8. **The warning triangles were `--warn-text`**, where the mockup draws them in `--warn`. **Fixed**: the attention items, the unreachable state, the missing Review and the warning alert's icon.
9. **The numbered shades of primary, success, warning and error were removed along with zinc.** The ticket names only zinc. **Kept**: nothing reads them, and the stylesheet is shorter without them.
10. **The rail's chip is ringed with `--rail`**, which the ticket does not ask for. **Kept**: the mockup rings it with the rail's colour, and without that the ring was the panel's white on the rail.
