# 03: Roadmap, decisions, Git and attention in the snapshot

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

**What to build:** the Product Snapshot becomes complete for this epic. Besides Tasks, a fresh Product session sees where the project stands on its roadmap, what the last session recorded as its focus, which decisions are fresh, the Git facts of its own checkout, and every deterministic inconsistency between the roadmap and the tickets. The sections Binnacle cannot fill yet say so. Decided in the spec, under *Roadmap*, *Product Snapshot* and *Attention items*.

- [ ] The roadmap is read from `<knowledge.docs>/roadmap.md` on the local tracker; a missing roadmap leaves its section absent with a diagnostic.
- [ ] The epic table (`# | Epic | Status | Spec`) is parsed strictly against the roadmap's status vocabulary; a row that does not parse produces a diagnostic and is left out, never repaired.
- [ ] `## Current focus` is returned as written, cut at a fixed character limit with an explicit truncation marker; every other `##` section is returned as its heading only.
- [ ] An epic row is linked to its tickets through the spec slug in its Spec cell.
- [ ] The five most recent ADRs by last commit date are listed with title and path.
- [ ] The Git section carries the facts of the caller's checkout. Once ticket 01 lands it describes a worktree correctly; this ticket does not depend on it.
- [ ] Pending decisions, CI state and usage are present as sections with an explicit unavailable marker and no content.
- [ ] Attention items: an epic whose roadmap status disagrees with its tickets (each of the three cases in the spec); an epic at `spec` or later with no spec link; manifest warnings and `tracker.remote_mismatch`. Together with ticket 02's two, that is the whole list, and nothing heuristic is added.
- [ ] Attention items are computed on every call and never stored.
- [ ] `docs/roadmap.md` says, under *Keeping this current*, that its table header and `Current focus` heading are read by Binnacle (already added at `/to-spec`; confirm it still matches what is parsed).
- [ ] Tests through the daemon seam cover a roadmap row that does not parse, a missing roadmap, a focus over the limit, each roadmap attention case, and the unavailable sections.

## Comments
