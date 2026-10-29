# 08: The skills list *Mod — мод*, and the MCP and skills reference describes the mod

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/claude-code-mod/spec.md`
Roles: Developer, Reviewer

**What to build:** the two gaps epic 22's tickets left in the spec's *Docs*. The grilling added *Mod — мод* to `CONTEXT.md`'s *Russian words*, but no skill's Words paragraph lists it, so `pnpm test` fails on `main` ("the five reporting skills … list CONTEXT.md's Russian words") and CI with it. And `docs/03-mcp-and-skills.md` does not describe the mod yet (ticket 02's notes).

- [x] Every skill under `apps/cli/plugin/skills/` lists `Mod — мод` in its Words paragraph, word for word as `/binnacle:product`'s.
- [x] `docs/03-mcp-and-skills.md` describes `binnacle-mod`: the status line, the *Waiting for you* band, the pane by `/binnacle-pane`, the toasts and the session-start lines; that it reads `project_snapshot` with its `session`; and that it shows nothing with the daemon stopped.
- [x] The typecheck and `pnpm test` pass.

## Comments

### Decisions

- The skills' source is `.claude/skills/binnacle/skills/`; `apps/cli/plugin/` is the ignored copy `prepare` builds. *Mod — мод* sits between *Autostart* and *Vault projection*, as in `CONTEXT.md`'s table.
- The mod's section in `docs/03-mcp-and-skills.md` is `## The Binnacle mod`, before *Harnesses and their levels*. `project_snapshot`'s `session` argument was already described under *How the interface reaches a harness*, so the section points at it rather than repeating it. A test in `pack.test.ts` pins the section's parts.

### Review

Reviewed in a sub-agent against `main`, on the project's standards and the spec. The Words paragraphs and the test were found sound; the findings were all in the new section:

- Fixed: "at the same version" was wrong, since the mod's version is drawn from its own files; now said so.
- Fixed: "writes no file, ticket or setting" overstated it; now "nothing to the project", its store keeping only the changes it toasted.
- Fixed: the status line shows the Task id and the role, not the id alone.
- Fixed: the session-start lines are added once per conversation, to its first prompt, and only when the snapshot answers within 8 seconds.
- Fixed: `/binnacle:init` declines the mod, since `--plan` and `--apply` without `--mod` do.
- Fixed: refreshes add no forge calls beyond the daemon's cache, not none.
- Fixed: two sessions refreshing in the same instant may both toast (the `ponytail:` in `hooks.ts`).
