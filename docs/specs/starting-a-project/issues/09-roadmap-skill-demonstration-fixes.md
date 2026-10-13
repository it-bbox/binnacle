# 09: A done epic without a spec, and the product inbox's path

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** the two defects ticket 08's demonstration found on an existing project (ticket 08, *Defects found, to be filed as tickets*).

1. **A `done` epic with no spec is not an attention item.** On an adopted project the finished work has no spec, so `roadmap.spec_missing` on each `done` row never clears, and the roadmap skill's agent left the finished epics out to avoid it. `roadmapAttention` (`packages/core/src/roadmap.ts`) reports `roadmap.spec_missing` only for a row at `spec`, `tickets` or `in progress` whose Spec cell is `—`. The roadmap skill's step 2 (`apps/cli/plugin/skills/roadmap/SKILL.md`, and the copy the build makes) no longer tells the agent to warn about it, and `docs/roadmap.md`'s *Keeping this current* says so where it names the item.
2. **The roadmap skill names the product inbox's file.** Its step 3 says the product inbox is `<knowledge.docs>/product-inbox.md`, so a backlog document is moved or folded there rather than kept in place.

- [x] Through `project.snapshot`'s attention: a `done` row whose Spec cell is `—` raises nothing; an `in progress` one still raises `roadmap.spec_missing`.
- [x] The roadmap skill's step 2 proposes finished epics as `done` with no warning, and its step 3 names `<knowledge.docs>/product-inbox.md`; the package build's test over the skill texts passes.

## Comments

- The skill's source is `.claude/skills/binnacle/skills/roadmap/SKILL.md`; `apps/cli/plugin/` and `apps/cli/skills/` are git-ignored copies that `apps/cli/src/prepare.ts` makes from it, so the change is there and the build carries it.
- `roadmap.spec_missing` now covers `spec`, `tickets` and `in progress`; a `done` row with `—` is history, often older than Binnacle. Ticket 06's Comments and Review still describe the old warning, as the record of that ticket.

### Review

Against `main`, in a sub-agent, on the standards and the spec; the ticket names no role beyond the Developer and the Reviewer.

1. No finding on the standards: one condition and one comment in `roadmapAttention`, the skill edited at its source, docs in English.
2. No finding on the spec: `done` with `—` raises nothing and `in progress` still does (`apps/daemon/test/snapshot.test.ts`), step 2 has no warning and step 3 names `<knowledge.docs>/product-inbox.md` (`apps/cli/test/pack.test.ts`), `docs/roadmap.md` says which statuses the item covers. No live doc still says a `done` epic raises it.
3. The ticket was not yet `DONE` with its criteria ticked. **Fixed**: this commit and the next.
