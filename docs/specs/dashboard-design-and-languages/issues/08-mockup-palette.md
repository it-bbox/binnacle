# 08: The mockup's palette, in light and dark

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** found by the owner in the exit demonstration (ticket 06, *Comments*): the dashboard is darker than the mockup. Only the accent was taken from the mockup; the neutrals are Tailwind's `zinc`, whose `zinc-950` background is nearly black. The dashboard takes the mockup's neutral tokens (`design/Binnacle Dashboard.dc.html`, its `:root` and `prefers-color-scheme: dark` blocks), in both themes. Decided in the spec, under *Look and build* and *Further Notes*.

- [ ] Nuxt UI's semantic colours (`--ui-bg`, `--ui-bg-muted`, `--ui-bg-elevated`, `--ui-bg-accented`, `--ui-border` and its variants, `--ui-text` and its variants) are set from the mockup's tokens: background, panel, code background, hover, chip, border, strong border, text, muted and faint, in light and in dark.
- [ ] The rail and the sidebar take the mockup's own `--rail` and `--sidebar` backgrounds, distinct from the page's.
- [ ] Warning, success and error take the mockup's `--warn`, `--ok` and `--err-text` families, with their soft backgrounds and lines where Nuxt UI's soft and outline variants use them.
- [ ] The colours stay declared in the stylesheet, as ticket 01 left them: no inline `<style>`, and the daemon's Content-Security-Policy is unchanged.
- [ ] Every page, beside the mockup in the same theme, shows the same background, panel and border tones. A human checks this; the steps are under `## Comments`.
