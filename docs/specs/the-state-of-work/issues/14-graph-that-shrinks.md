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

### Question

Should the daemon pass `--allow-dedup-shrink` on every extraction, or try without it first and pass it only when graphify refuses a shrinking graph? Always passing it is one constant and one run; retrying keeps graphify's guard for a shrink that dedup did not cause, at the cost of a second run and of matching graphify's refusal text.

### Answer

2026-10-11

Always pass the flag

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings, all judgement calls:

1. **The ticket is still `READY` with nothing ticked.** To fix, in the last commit.
2. **Duplicated Code**: graphify's refusal is written out in both tests, and the two texts differ: init's lacks `Refusing to overwrite graphify-out/graph.json.`, though the daemon's calls its text the last line graphify 0.9.76 writes. To fix: init's test gives the same line.
3. **Duplicated Code**: `init.test.ts` escapes a string for a regular expression twice now. Kept: two uses, below the rule of three; a helper waits for a third.
4. **A misleading comment**: both tests say the refusal is what an older graphify that does not accept the flag gives, yet the refusal itself names the flag, and graphify skips an argument it does not know rather than refusing it. To fix: the comments say the refusal stands for a failed extract, and `03-external-tools.md` says a graphify that does not know the flag skips it, so a refusal of a shrinking graph fails that run with graphify's reason.
5. **Duplicated Code (documentation)**: the reason the graph may shrink, ADR-0036's rebuildable projection, is in `GRAPH_EXTRACT`'s JSDoc and in `03-external-tools.md`. Kept: the code's comment and the operations document serve different readers, as elsewhere in this repository; both cite the ADR.
6. **`0.9.76 when this was written`** ties the operations document to a version. Kept: it names the version the flag was checked against, which is what the second criterion asks the document to say.

**Spec: the owner's answer, always pass the flag, is implemented**: `GRAPH_EXTRACT` carries `--allow-dedup-shrink`, and `binn init` runs the same constant. Findings:

7. **The ticket is still `READY`.** As 1.
8. **The run on this repository after a merge that shrinks the graph** cannot be checked before the merge. Kept: left unticked for the owner, with a script below.
9. **No check by hand that the installed graphify accepts the flag** is recorded, only its source read. To fix: a code-only extract with the flag, on a scratch directory Git ignores, recorded below.
10. **`docs/product-inbox.md` still lists the defect.** Kept: the inbox is the Product session's to tidy.
11. **The tests' comments on an older graphify**: as 4.
12. **The tests' failed extracts are now graphify's refusal** rather than a missing grammar or no source files, so no arbitrary failure is tested. Kept: the refusal is one more stderr line on the same path, the one this ticket's criterion names.

#### Security

The ticket's `Roles:` names Security beyond the Developer and the Reviewer, so the change was also read for its security concerns.

13. **None found.** No secret, authentication, permission or trust boundary is touched: the flag is one more constant argument to the same `spawn` with no shell. It loosens only graphify's node-count guard, which the owner chose (ADR-0036: the graph is rebuildable), and ADR-0012 holds: no model, no network, no API key.
