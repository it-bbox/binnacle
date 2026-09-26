# 06: The exit demonstration of the redesign

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** epic 6's exit criterion, demonstrated by the owner on their running daemon after `pnpm dashboard:generate`. Decided in the spec, under *Further Notes*.

- [ ] The Overview opens in the browser's language.
- [ ] Switched to the other language, it keeps the choice across a reload.
- [ ] The "What's next" block shows the Next action and Binnacle's alternatives, each labelled, and the owner takes a step from it in a fresh session without asking an agent what to type.
- [ ] Ready to start says "in any order" and how many Tasks can run in parallel.
- [ ] Every page holds at 1024 px, in light and in dark.
- [ ] The browser's network log shows requests to the daemon only.
- [ ] The owner records under `## Comments` whether the dashboard is now easy to follow, in both languages. Defects are filed as tickets, and the roadmap marks epic 6 done only when none is open.
