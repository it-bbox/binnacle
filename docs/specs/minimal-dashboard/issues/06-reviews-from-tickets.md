# 06: Reviews, read from the tickets

Status: READY
Triage: ready-for-agent
Blocked by: 02, 04
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** a Task's Review, as its ticket records it, shows on its Task page, and a `DONE` Task without one is an attention item. Decided in the spec, under *The Review*.

- [ ] The local tracker reads a ticket's Review: the text under `### Review` inside `## Comments`, up to the next heading of the same level or above.
- [ ] `task.get`'s brief carries it as `review`:
  - cut at the body limit, with `truncated`;
  - `null` when the ticket has none;
  - unavailable on GitHub and GitLab, with the reason that comments are not read.
- [ ] `task.list` says, for each Task, whether a Review is recorded, or `null` where that is unavailable.
- [ ] `review.missing` names each `DONE` Task on the local tracker that has no Review. It does not run on a remote tracker.
- [ ] The Task page shows the Review as text. Otherwise it says that none is recorded, or that it is not available and why.
- [ ] A Done card without a Review is marked.
- [ ] Tests through the daemon seam cover a Review found, a Review cut at the limit, a missing Review raising `review.missing`, and a Review unavailable on a remote tracker.
