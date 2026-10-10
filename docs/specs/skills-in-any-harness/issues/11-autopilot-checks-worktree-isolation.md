# 11: Autopilot's first step checks what the harness offers, not what the model believes

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** `binnacle-autopilot`'s first step no longer passes on the model's own reading of its harness. On 2026-10-09, in epic 14's exit demonstration, ZCode with GLM-5.3 passed it: its `Agent` tool has `run_in_background` but no worktree isolation, and the model reasoned that it could start background agents "each pointed at a git worktree I set up for it". The step asks for a separate checkout that the harness creates for the agent. The run stopped only because epic 14 had no ticket for an agent left; with one, ZCode would have run it in a way the skill forbids.

The step names the signal it reads: the tool that starts an agent offers a worktree of its own as a parameter the harness acts on (Claude Code's `isolation: "worktree"`). A model that can only start agents in the background, or that would create the worktree itself, refuses at the step, changes nothing, and says why, in both the `binnacle` plugin's skill and the package's `binnacle-autopilot` copy.

- [ ] The skill's first step names the parameter it looks for, and says that a worktree the model would create itself does not count.
- [ ] In ZCode, `binnacle-autopilot 14` refuses at its first step and changes nothing. Only the owner can verify this; the script is under `## Comments`.

## Comments

- The step names the parameter by what it does, "a parameter, such as an isolation or worktree option, that has the harness create the agent's worktree", not by Claude Code's `isolation: "worktree"`: the spec's *One neutral text per skill* and ADR-0039 keep every harness's mechanism out of the skills, and `pack.test.ts` forbids that very string. The refusal also says which of the two the harness lacks, a background agent or a worktree the harness creates, which is the "why" the ticket asks for. The package's `binnacle-autopilot` copy is built from the plugin's text by `prepareSkills`, so it carries the same step without an edit of its own.
- Script for the second criterion, once this ticket is merged and the skills are refreshed (`docs/workflow/02-development-workflow.md`, *Per ticket*): open this repository in ZCode, start a new task, run `binnacle-autopilot 14`. It should say at once that ZCode cannot start an agent in a worktree the harness creates, start nothing, and leave `git status` and `git worktree list` as they were.
