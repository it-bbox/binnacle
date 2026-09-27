# Audit and adopt: what the grilling starts from

Epic 7's scope is `docs/05-mvp-plan.md`, phase 6. This brief holds only the owner's feedback that reached it before its grilling. The grilling decides each question; nothing here is decided.

## The owner's feedback, 2026-09-27

- **Continuing in another harness is not discoverable.** Moving this project's Product session to Codex took five messages with an agent's help, and the owner asked how they would have done it alone, for Codex or for GLM:
  - `binn init` registers the MCP server for a detected harness, but for Codex only in the project's `.codex/config.toml`, which Codex reads in a trusted project alone. The Codex desktop app ships its CLI outside PATH, at `/usr/lib/chatgpt/resources/codex`.
  - Binnacle's skills install into Claude Code alone. Any other harness is left to "read `.claude/skills/binnacle/skills/product/SKILL.md` and follow it".
  - The README has no section on working from another harness. GLM is a model, reached through a harness such as Claude Code or opencode.
- **`binn init` asks too many questions.** Its eight steps confirm each write on its own (`ADR-0026`). The question: one plan shown, one confirmation?
- **Enter means no.** Every question defaults to no, so that a run without a terminal writes nothing (`ADR-0026`). The question: yes by default when stdin is a terminal, and no without one?

The hang the owner also met, init not exiting after its Summary, is a defect rather than a question, and is ticket 01.
