# ADR-0028: A Run's Branch Comes From Its Harness First, From the Reflog Otherwise

**Status:** Accepted

**Supersedes:** the order of sources in ADR-0018's decision, which made the repository's `git reflog` the source of a session's branch and the harness's own report only a cross-check. The rest of ADR-0018 stands: `cwd` identifies the Project, the branch maps to a Task by naming convention, and no match is `unassigned`.

## Context

ADR-0018 chose the reflog because Git records it for every agent, including one nobody has written yet.

Measured on this repository while specifying epic 4: nearly every ticket of epics 1 to 3 was built in a linked worktree that was removed after its merge, on a branch that was deleted with it. A linked worktree keeps its own reflog, and removing the worktree removes it; deleting a branch removes that branch's reflog. The registered checkout's reflog holds about thirty branch switches. Read through the reflog alone, the work of three epics is `unassigned`.

Claude Code writes the branch the session was on into every record of its session artifact, subagents' included, at the moment the record is written. Codex writes none.

## Decision

- A record's branch is the one its harness wrote into the artifact, where the harness writes one.
- Where it does not, the branch is recovered from the reflog of the checkout the record's `cwd` names, matched against the record's timestamp, as ADR-0018 describes.
- Neither source is a guess, and both carry `measured` provenance. Where neither answers, the record is `unassigned`.

## Consequences

- History built in removed worktrees stays attributable wherever its harness recorded the branch.
- A harness that records no branch is attributed only while its checkout and its branch's reflog still exist. That is the same 90-day horizon and the same loss on removal ADR-0018 already accepts, now limited to such harnesses.
- An agent nobody has written yet still gets reflog attribution, so ADR-0018's reason for the reflog still holds.
