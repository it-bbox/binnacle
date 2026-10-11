# 01: The type scale across the dashboard

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** every page of the dashboard reads at the spec's type scale (spec, *Implementation Decisions*, *The type scale*): body text 16 px, secondary text 14 px, and nothing below 13 px, Nuxt UI's components, badges and figures included. The scale is set once and every page uses it; spacing grows with it, a page still fills the width and prose keeps its measure. Use the Impeccable and UI UX Pro Max skills for the scale and spacing. One mechanical pass over every page, so that the floor's test can pass.

- [x] A test over the dashboard's sources, beside the palette's, fails on any text size below 13 px.
- [x] Every page uses the shared scale: body 16 px, secondary 14 px.
- [x] The palette, both themes, both languages and the layout down to 1024 px are unchanged.
- [x] Checked in a browser: every page in light and dark, English and Russian.

## Comments

The scale is Tailwind's own steps, declared once in `main.css`'s `@theme`: `xs` 13 px (the floor), `sm` 14 px (secondary), `base` 16 px (body), with `lg`, `xl` and `2xl` above for headings and figures; Tailwind's spacing unit, which Nuxt UI uses too, grows from 4 to 4.8 px. Every arbitrary `text-[Npx]` moved one role up: 10 to 11 px to `xs`, 11.5 to 12.5 px and `xs` to `sm`, 13 px and `sm` to `base`, 17 px to `lg`, `lg` to `xl`, `xl` and 22 px to `2xl`. Nuxt UI's `sm` and `xs` badges, 10 and 8 px of its own, are set to `xs` in `app.config.ts`. The next ticket can use `text-xs`, `text-sm` and `text-base` as the roles, and no `text-[…]` size: the test refuses one.

At 1024 px the larger type overlapped or scrolled sideways in four places, each now fixed: the Overview's epic stepper wraps onto a second row instead of overlapping its numbers; the Project page's usage-by-role table scrolls inside its panel; the Usage page's "Bars show" label wraps above its tabs in Russian; the Settings page's manifest sections stack in one column when two do not fit. In the browser, every page, light and dark, English and Russian, at 1024 and 1440 px, computed sizes are 13, 14, 16, 18, 20 and 24 px only, and nothing scrolls sideways.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, its sub-agents in the foreground. The ticket names no role beyond the Developer and the Reviewer.

**Standards: no hard violation.** To fix, both fixed:

1. **The badge check hangs on indentation** **Fixed** in f619266. (`apps/dashboard/test/type-scale.test.ts`): `/\bbadge:\s*\{([\s\S]*?)\n {4}\},/` reads the badge's block by its four-space closing line, so reformatting `app.config.ts` fails the test for no reason. Fix: match `badge:`, then its `size:`, then each size's `base` with `text-xs`, whatever the layout.
2. **Sizes the test does not see** **Fixed** in f619266. (same file): a style binding's `fontSize: '11px'` and the CSS `font:` shorthand pass unread. Fix: both are read with the other literal sizes.

Kept:

3. Only the badge of Nuxt UI's own sizes is held by the test: the others the dashboard uses size their text with `text-xs`, which the theme holds at 13 px, and reading Nuxt UI's theme would reach into a module's internals (spec, *Testing Decisions*); the browser measures them.
4. The `xs` badge override with no `size="xs"` badge in use: the floor covers Nuxt UI's components whatever size a later page picks.
5. `em` counted from 16 px and the `length:` prefix in the test: two characters each, and a guess that errs toward failing.
6. The floor test and the scale test overlap: each fails with its own message, one for a size below 13 px, one for a size outside the scale.
7. Commented-out `//` and `<!-- -->` sizes still fail the test: a size left in a comment is one to delete.

**Spec.** To fix, both fixed:

8. **A badge's line height followed the new spacing unit** **Fixed** in f619266. (`apps/dashboard/app/app.config.ts`): `text-xs/4` set it to four spacing units, 19.2 px rather than the scale's 18 px. Fix: `text-xs` alone.
9. **One row height did not grow** **Fixed** in f619266. (`apps/dashboard/app/components/BarList.vue`): `py-[7px]` stayed at 7 px while every other padding grew. Fix: `py-1.5`.

Kept:

10. The ticket's body, its Review and its questions on the Task page are 14 px monospace: raw source text, which ticket 04 renders as Markdown at body size.
11. Board card titles and bar labels at 14 px: labels in dense lists, secondary text by the spec's roles.
12. The four layout fixes above: forced by the larger type at 1024 px, and the criterion asks the layout down to 1024 px to keep working; the stepper itself moves to *Full* in ticket 02.
13. The spacing unit widens the rail and sidebar by 55 px: their text grew too, and the page still fills the width; fixed pixel values (`size-[26px]`, radii, `max-w-[520px]`) stay as they were.
14. The test refuses any arbitrary size, beyond the spec's floor: the ticket's second criterion asks that every page use the shared scale.
