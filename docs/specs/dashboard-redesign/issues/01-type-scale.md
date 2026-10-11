# 01: The type scale across the dashboard

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** every page of the dashboard reads at the spec's type scale (spec, *Implementation Decisions*, *The type scale*): body text 16 px, secondary text 14 px, and nothing below 13 px, Nuxt UI's components, badges and figures included. The scale is set once and every page uses it; spacing grows with it, a page still fills the width and prose keeps its measure. Use the Impeccable and UI UX Pro Max skills for the scale and spacing. One mechanical pass over every page, so that the floor's test can pass.

- [ ] A test over the dashboard's sources, beside the palette's, fails on any text size below 13 px.
- [ ] Every page uses the shared scale: body 16 px, secondary 14 px.
- [ ] The palette, both themes, both languages and the layout down to 1024 px are unchanged.
- [ ] Checked in a browser: every page in light and dark, English and Russian.
