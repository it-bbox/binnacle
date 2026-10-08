# 15: The exit demonstration of epic 10

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 16
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** epic 10's exit criterion, demonstrated by the owner on their machine (spec, *Further Notes*).

- [ ] `binn init` with one yes configures the export in Claude Code, Codex and Gemini CLI.
- [ ] One session in each of Claude Code, Codex, Gemini CLI, opencode, Antigravity, ZCode and pi on one repository appears with its level; one shows as running before its artifact is written, and counts once afterwards.
- [ ] A Task taken through a Review and a fix shows implementation, review and rework apart.
- [ ] A long Product session raises `context.pressure`.
- [ ] The usage page shows Ponytail's before and after.

Gemini CLI and Antigravity are marked not verified, by the owner's decision of 2026-10-08 (spec, *Further Notes*): their sessions are shown if they run, and the demonstration passes without them.

## Comments

- Left to this demonstration by 07 and 08, each in its ticket's *Decisions*:
  - ZCode: that `input_tokens` holds the input written to cache, which the reader subtracts. A call that writes cache shows whether its input is right (08).
  - Antigravity, if it runs: that a conversation lands in its own project, since the reader takes the first `file://` URI of its summary rather than a numbered field (07, with its script).
