# 08: The skills list *Mod — мод*, and the MCP and skills reference describes the mod

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/claude-code-mod/spec.md`
Roles: Developer, Reviewer

**What to build:** the two gaps epic 22's tickets left in the spec's *Docs*. The grilling added *Mod — мод* to `CONTEXT.md`'s *Russian words*, but no skill's Words paragraph lists it, so `pnpm test` fails on `main` ("the five reporting skills … list CONTEXT.md's Russian words") and CI with it. And `docs/03-mcp-and-skills.md` does not describe the mod yet (ticket 02's notes).

- [ ] Every skill under `apps/cli/plugin/skills/` lists `Mod — мод` in its Words paragraph, word for word as `/binnacle:product`'s.
- [ ] `docs/03-mcp-and-skills.md` describes `binnacle-mod`: the status line, the *Waiting for you* band, the pane by `/binnacle-pane`, the toasts and the session-start lines; that it reads `project_snapshot` with its `session`; and that it shows nothing with the daemon stopped.
- [ ] The typecheck and `pnpm test` pass.
