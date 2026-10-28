# 08: The exit demonstration of epic 21, and 0.5.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`

**What to build:** epic 21's exit criterion, demonstrated by the owner, then the 0.5.0 release (spec, the exit criterion, *The release*).

- [ ] `/binnacle:task` with a ticket's path, without `run`, gives that Task's brief.
- [ ] A Task whose branch is merged with `git merge` leaves the Tasks in flight, and the Suggested step does not wait for it.
- [ ] A context-pressure warning names its session's own start and the threshold for its model, a number set on the Settings page.
- [ ] The vault in Russian has no `(англ.)` for a pair or a failed Graphify run, and says "пулл-реквесты".
- [ ] In an interactive Claude Code session, after `/clear` and after `--resume`, the warning says "this" or "another" only where it is true.
- [ ] `/binnacle:checkpoint` proposes a trap for a fact that cost time in the session, and writes it to `AGENTS.md` only on the owner's yes.
- [ ] The CLI package's version is 0.5.0; 0.5.0 published by `CONTRIBUTING.md`'s *Releasing* and installed from the registry into a clean container, where `binn daemon status` gives 0.5.0.

## Comments

### For the `/clear` and `--resume` criterion (from ticket 06)

`binn mcp` now sends no session, so through the MCP tools the context-pressure warning says neither "this" nor "another"; `binn call` in the shell still says which. In an interactive Claude Code session on this repository, with a Product session over the threshold:

1. Run `/binnacle:product`: the warning names the session with neither word.
2. Run `binn call project_snapshot` in the shell (`!binn call project_snapshot`): `params.own` is `true` for this session.
3. Run `/clear`, then `binn call project_snapshot` again: `echo $CLAUDE_CODE_SESSION_ID` gives a new id, and an item still naming the session before `/clear` has `params.own` `false`; through `/binnacle:product` it still says neither word.
4. Quit, start `claude --resume <the old id>`, and repeat step 2: `params.own` is `true` for it.
