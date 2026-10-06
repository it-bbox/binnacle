# 01: Skills free of one harness's mechanisms

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** the `binnacle` plugin's skills say what to do, not with which harness's tool, so the same text runs in any harness (spec, *Implementation Decisions*, *The skills' text*). No skill names an agent tool, a question tool, `claude plugin`, a `.claude/` path or "Claude Code asks": a skill asks the human in the chat, starts a background agent in a worktree of its own through whatever the harness offers, and takes harness-specific facts, such as when a harness reads its MCP servers, from `binn`'s output. Autopilot's text states that only a human starts it, refuses at its first step and changes nothing where the harness cannot start a background agent in a worktree of its own, telling the human to run the tickets by hand, describes a linked worktree in general rather than Claude Code's, and sends a push notification only where the harness can. Skills keep naming each other `/binnacle:<action>`; ticket 03 rewrites that for other harnesses.

- [x] No plugin skill names a harness-specific mechanism; one check in the package's tests rejects each of them in every plugin skill text.
- [x] Autopilot's text carries the human-only rule, the refusal at its first step and the conditional push notification; the package's tests hold that wording.
- [x] `/binnacle:init` advises a new session from `binn init`'s output, not from Claude Code's name.
- [x] Every skill still does in Claude Code what it did before: the existing wording tests pass, adjusted only where the wording was the mechanism.

## Comments

Decisions taken while implementing, within the spec:

- **Claude Code's plugin refresh stays in the development workflow.** Autopilot's step 8 no longer names `claude plugin` or `.claude/skills/binnacle/`: it refreshes the plugin as `docs/workflow/02-development-workflow.md` says under *Per ticket* for a merge that changed the plugin's skills, where the commands already were. The package's test holds them there, so the rule moved rather than went. Ticket 07 adds the `skills` CLI's reinstall beside it.
- **The new-session advice comes from `binn init`.** Claude Code's entry in `binn init`'s harness table gained a `note`, printed where the entry is offered, as Codex's trust note is: Claude Code reads `.mcp.json` only when a session starts, so open a new session and approve the server. `/binnacle:init` passes such a note on when the Summary shows that file created or extended, and says nothing of a new session otherwise.
- **The refusal is autopilot's step 1**, before any Binnacle call, so the later steps are numbered one higher; the skill's own step references follow.
- **A harness that starts background agents but cannot message them**, a case the spec does not name: whatever autopilot would send an agent (a relayed review, an answer, a send-back) stops that ticket instead, with what would have been sent as the reason. It is the smallest rule that keeps the run from waiting forever; the refusal at step 1 stays the spec's condition alone.
- **`$ARGUMENTS`** is left in the skills: the ticket's list of mechanisms does not name it, and the sentences around it say in words what it stands for ("if the human passed a path").

Hand check, optional, for criterion 4 in Claude Code, after refreshing the plugin as `docs/workflow/02-development-workflow.md` says under *Per ticket*, in a new session:

```sh
# 1. In a session opened in a linked worktree: /binnacle:autopilot refuses at its step 3, names project.path,
#    and gives no desktop-app or --worktree instructions.
# 2. On a repository with no .mcp.json and Claude Code installed: /binnacle:init, then yes;
#    the answer ends with the new-session advice binn init printed.
# 3. /binnacle:product, /binnacle:daily and /binnacle:status answer as before.
```

### Review

Code review against `main`, both axes.

Standards:
- Fixed: autopilot pointed at the workflow's refresh by step number ("its step 4"), which a renumbering would silently break; it now names the section and the case.
- Kept: the plugin's wording test reads `docs/workflow/02-development-workflow.md`, a file the diff does not change, because it guards the commands the skill now defers to.
- Kept: the init test repeats the note's exact text, as the repository's wording tests do.
- Kept: the rule for a harness that cannot message its agents, recorded above; it is now held by the autopilot test.
- Kept: the check rejects any `.claude/` path in every plugin skill, as the spec lists it.

Spec:
- No requirement missing or implemented wrongly.
- Kept: the messaging rule, beyond the spec's wording but forced by removing `SendMessage`; recorded above and tested.
- Kept: "created or extended" in `/binnacle:init`, wider than `.mcp.json` needs, since the skill now speaks of any harness's file.
- Left: earlier `DONE` tickets cite autopilot's old step numbers; they are history.

Rebased onto `main` after ticket 03 merged: the forbidden-mechanism check and the copy's tests pass together, and `help`'s description, which 03's review left to this ticket, now says "which Binnacle skill to use when" rather than "which /binnacle skill", held by the help test.
