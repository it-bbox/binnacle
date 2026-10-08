# 10: A skills add that fails for one harness still leaves Claude Code clean

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** `binn init`'s skills step no longer takes one harness's failure for the whole add's. On 2026-10-08, in epic 10's exit demonstration, `npx skills add mattpocock/skills -g -y --json` and the same for Ponytail, with `skills` 1.7.1, exited non-zero and reported every skill `failed` with `PromptScript does not support global skill installation`, while installing them into Antigravity, Claude Code, Codex, Continue, Gemini CLI, OpenCode, Pi and ZCode. `binn init` recorded both adds as failed and skipped their removal from Claude Code, which left 44 skills in `~/.claude/skills` beside the two plugins; the owner removed them by hand with `npx skills remove -g -a claude-code`.

The step reads what the add installed, not its exit status alone: the set's skills are removed from Claude Code whenever the add installed them there, and the Summary names a harness the add failed for, with the CLI's reason, rather than calling the whole add failed (spec, *One install for every harness*).

- [ ] Process test with a stub `npx skills` whose add exits non-zero and reports one harness's failure for every skill while it installs them elsewhere: the removal from Claude Code runs for the set's skills, and the Summary names the failing harness and its reason.
- [ ] An add that installed nothing is still recorded as failed, and nothing is removed.

## Comments

- How to tell what was installed is this ticket's to choose: the add's own output, or the installed skills listed after it.
