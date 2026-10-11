# 14: A graph that shrinks is still rebuilt

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** a defect found in epic 11's autopilot run, taken into epic 11 as the carrier of its exit demonstration (12) by the owner on 2026-10-11, out of epic 18. graphify 0.9.76 refuses `graphify extract . --code-only` when deduplication merges nodes and the graph would shrink, so the daemon's update fails, the graph stays at an older commit, and conflict risk reads a stale graph; on 2026-10-11 it was rebuilt by hand with `--allow-dedup-shrink`, and it recurs on the next merge. The graph is a rebuildable projection (ADR-0036), so a smaller graph after a merge is expected, not a loss: the daemon's extraction, `GRAPH_EXTRACT` in `apps/daemon/src/graph.ts`, which `binn init` also runs for the first graph, lets it shrink. The graphify version `binn init` installs must accept the flag; one that does not is a failed run with graphify's reason, as today.

- [ ] A test with a stand-in `graphify` executable shows the daemon's and `binn init`'s extraction pass the flag, and a refusal still gives a failed run with its reason.
- [ ] The graphify that `binn init` installs (`uv tool install graphifyy`) accepts the flag; the document that names graphify's commands says so.
- [ ] On this repository, after a merge that shrinks the graph, the snapshot's `graph` is current, not behind.

## Comments
