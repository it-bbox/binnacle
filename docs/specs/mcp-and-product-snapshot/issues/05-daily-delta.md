# 05: Daily delta

Status: READY
Triage: ready-for-agent
Blocked by: 03, 04
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

**What to build:** a Product session asks what changed since the previous daily and gets only that: commits, Task state transitions, new tickets, roadmap status changes and ADRs, ending with what can start next and what needs attention. Each daily becomes the baseline for the next one without anybody remembering when they last looked. Decided in the spec, under *Daily delta* and *Events*.

- [ ] `daily.get` returns the delta from a baseline commit to the caller's HEAD, over committed state only, with the dirty flag.
- [ ] Contents: commits (count and subjects, limited, with a remainder count); Task state transitions from each ticket's `Status:` at the baseline and at HEAD; tickets that did not exist at the baseline; roadmap status changes; ADRs added or changed; ready-to-start Tasks; attention items.
- [ ] The baseline is the head commit of the most recent `daily` or `checkpoint` event for this project on this machine.
- [ ] Each call records a `daily` event carrying the caller's HEAD; a second call in a row returns an empty delta.
- [ ] An explicit `since` commit overrides the baseline and records nothing.
- [ ] With no prior event, or a baseline commit that is no longer reachable, the delta falls back to the last seven days of commits, and the response states which fallback applied and why.
- [ ] The Git adapter gains `log` and `show` at a revision, and stays read-only by construction.
- [ ] `daily_get` is exposed over MCP, mapped one-to-one like the others.
- [ ] The `daily` event is tier 2 and survives a schema rebuild.
- [ ] Tests through the daemon seam cover the first call's fallback, two calls in a row, an explicit `since`, a baseline removed by rewriting history, a dirty tree, a `READY` → `DONE` transition, a new ticket, a roadmap status change and a new ADR.

## Comments
