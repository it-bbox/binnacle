# 12: The exit demonstration

Status: READY
Triage: ready-for-agent
Blocked by: 05, 06, 07, 09, 10, 11
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** epic 3's exit criterion, demonstrated for real: a remote issue is represented as a Binnacle Task and a compact task brief in a fresh session, and `binn init` sets up a fresh repository end to end. Decided in the spec, under *Further Notes*.

- [ ] A scratch project whose manifest points at the GitHub test repository from ticket 07 is registered. A fresh Claude Code session in it runs `/binnacle:product` and `/binnacle:task #<n>`, and the Task and brief match the issue.
- [ ] `binn init` runs on a fresh clone of a repository with a GitHub remote, every step confirmed; a fresh session there has Binnacle's tools and the `binnacle` skills.
- [ ] Every defect found is filed as a ticket in this spec, not fixed in passing.
- [ ] The roadmap marks epic 3 `done` and moves the current focus to epic 4, or, if defects were filed, moves it to them and keeps epic 3 `in progress`.
