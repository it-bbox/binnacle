# 01: Skills free of one harness's mechanisms

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** the `binnacle` plugin's skills say what to do, not with which harness's tool, so the same text runs in any harness (spec, *Implementation Decisions*, *The skills' text*). No skill names an agent tool, a question tool, `claude plugin`, a `.claude/` path or "Claude Code asks": a skill asks the human in the chat, starts a background agent in a worktree of its own through whatever the harness offers, and takes harness-specific facts, such as when a harness reads its MCP servers, from `binn`'s output. Autopilot's text states that only a human starts it, refuses at its first step and changes nothing where the harness cannot start a background agent in a worktree of its own, telling the human to run the tickets by hand, describes a linked worktree in general rather than Claude Code's, and sends a push notification only where the harness can. Skills keep naming each other `/binnacle:<action>`; ticket 03 rewrites that for other harnesses.

- [ ] No plugin skill names a harness-specific mechanism; one check in the package's tests rejects each of them in every plugin skill text.
- [ ] Autopilot's text carries the human-only rule, the refusal at its first step and the conditional push notification; the package's tests hold that wording.
- [ ] `/binnacle:init` advises a new session from `binn init`'s output, not from Claude Code's name.
- [ ] Every skill still does in Claude Code what it did before: the existing wording tests pass, adjusted only where the wording was the mechanism.
