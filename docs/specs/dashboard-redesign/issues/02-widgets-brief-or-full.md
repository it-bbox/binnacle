# 02: Widgets brief or full, on the Overview and Attention

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/dashboard-redesign/spec.md`

**What to build:** the shared widget frame with its *Brief* / *Full* control (spec, *A widget with two levels*), and the Overview's and the Attention page's widgets in it, each *Brief* as the spec's user stories say (11 to 14). The level is kept in the browser per widget and page, *Brief* when nothing is stored or storage is unavailable; a long list or text folds in place with a control to unfold it. "What's next" has no control and is always in full.

- [ ] Each Overview widget but "What's next", and the Attention page's, has the control; *Brief* shows what the spec's stories name, *Full* everything `docs/04-telemetry-dashboard.md` lists for it.
- [ ] A widget's level survives a reload, and the page renders in *Brief* when the browser's storage throws.
- [ ] Long lists and texts fold in place and unfold on request.
- [ ] The control's labels are in both dictionaries, and the dictionaries' test passes.
- [ ] `docs/04-telemetry-dashboard.md` describes the two levels.
- [ ] Checked in a browser: both levels in light and dark, English and Russian.
