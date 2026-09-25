# 13: `/binnacle:autopilot` ends by telling the owner to run `/binnacle:checkpoint`

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`, `docs/adr/ADR-0022-autopilot.md`

**What to build:** when an autopilot run ends, its report and its push notification tell the owner to run `/binnacle:checkpoint` in the same session before closing it, so that what the run decided reaches canonical sources and the checkpoint is recorded. Found when epic 3 closed on 2026-09-25: the run's report said nothing about it, and the owner had to ask.

- [ ] The autopilot skill's report ends with a **Next** item: run `/binnacle:checkpoint` in this session before closing it, with the reason. The skill says it cannot run it itself, because `/binnacle:checkpoint` is started only by a human.
- [ ] The push notification names the checkpoint as the owner's next step.
- [ ] The autopilot's other rules are unchanged: it still writes no file and makes no commit of its own.

## Comments
