# 13: `/binnacle:autopilot` ends by telling the owner to run `/binnacle:checkpoint`

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`, `docs/adr/ADR-0022-autopilot.md`

**What to build:** when an autopilot run ends, its report and its push notification tell the owner to run `/binnacle:checkpoint` in the same session before closing it, so that what the run decided reaches canonical sources and the checkpoint is recorded. Found when epic 3 closed on 2026-09-25: the run's report said nothing about it, and the owner had to ask.

- [x] The autopilot skill's report ends with a **Next** item: run `/binnacle:checkpoint` in this session before closing it, with the reason. The skill says it cannot run it itself, because `/binnacle:checkpoint` is started only by a human.
- [x] The push notification names the checkpoint as the owner's next step.
- [x] The autopilot's other rules are unchanged: it still writes no file and makes no commit of its own.

## Comments

- **What changed.** One skill file, no code. Step 10 of `/binnacle:autopilot` gains a **Next** item after **Attention**: run `/binnacle:checkpoint` in this session before closing it, and why, with the reason the skill cannot run it. Step 11's push notification names the checkpoint as the next step. Nothing else in the skill moved; `apps/cli/plugin/` picks the change up on the next `pnpm install`.
- **Why the same session.** The checkpoint promotes what was decided in the conversation, and only the session that ran the autopilot holds that conversation.

### Review

Skill text only, reviewed by hand against ADR-0022 and the skill's own rules rather than through the two review sub-agents, which have no code to check here.

1. **Standards.** The added item follows the report's existing form, a bold label and one sentence. Nothing found.
2. **Spec.** Each criterion holds. The autopilot still writes no file and makes no commit: it only tells the owner, and `/binnacle:checkpoint` keeps `disable-model-invocation: true`. Nothing found.

Typecheck is clean and the full suite passes, 254 of 254.
