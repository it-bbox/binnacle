# 07: `/binnacle:roadmap` proposes epics from the product inbox

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer

**What to build:** `/binnacle:roadmap`, run again on a roadmap that lists epics, reads `<knowledge.docs>/product-inbox.md` too (spec, `/binnacle:roadmap`'s *Again*). Each entry not marked "Planned as epic N" or "Planned into epic N" is proposed as a new epic with its line of scope, as part of an existing `not started` epic, or named as left out, each with its reason. On the owner's yes, beside the roadmap's change, each entry taken gets `**Planned as epic N on YYYY-MM-DD.**` or `**Planned into epic N on YYYY-MM-DD.**` under its heading and stays in the inbox. *New project* and *Existing project* do not read it.

- [x] The skill's *Again* reads the inbox, proposes, names what it leaves out, and marks the entries taken only on the yes.
- [x] An entry already marked is never proposed again.
- [x] In the package build's test, the skill's text and its copy carry it.

## Comments

- Decisions where the ticket is silent:
  - An entry is a `## ` heading of the inbox with the text under it; a `### ` heading inside it, such as *More, 2026-10-22*, is part of its entry.
  - An entry marked `**Planned on YYYY-MM-DD:**` with the parts it planned into epics, as the inbox's first entry is, counts as planned for those parts; only the parts it names in none are weighed, each as an entry of its own. A part taken later gets a `**Planned on YYYY-MM-DD:**` line of its own, so that the rest stays unplanned rather than covered by a whole-entry mark.
  - When *Again* renumbers an epic `not started` that a mark names, the mark's number changes with it, shown beside the other marks before the yes.
  - An entry left out is named with its reason every run and stays unmarked: the ticket marks only the entries taken.
  - `docs/operations/01-new-project.md` and its Russian twin, which describe *Again*, and `docs/workflow/01-product-workflow.md`'s inbox paragraph say the same.
- `/binnacle:roadmap` proposing from this repository's inbox is the exit demonstration's (ticket 09), as the spec says; the criteria above are ticked on the text and the test that pins it.

### Review

Against `main`, in a sub-agent, on the standards and the spec. Typecheck and the full suite pass; one author, no attribution, no dependency, nothing outside the ticket.

1. **A part taken from an entry planned in parts would have been marked as the whole entry**, so its other parts were never proposed again. **Fixed**: a part taken gets its own `**Planned on YYYY-MM-DD:**` line (`roadmap/SKILL.md`, *Again*), pinned by the test.
2. **Renumbering an epic `not started` left the inbox's marks naming the old number.** **Fixed**: *Again* changes the number in each mark that names a renumbered epic.
3. **The test compared only the start of the copy's *Writing***, cut at the example's `## Epics`. **Fixed**: it compares to the end of the file, with the copy's renaming applied.
4. The test did not check the rule for an entry planned in parts. **Fixed**: one `assert.match` each for weighing and marking parts.
5. "Propose every other entry once" read as "once ever". **Fixed**: "once" removed.
6. The Russian guide's sentence was a calque and dropped the reason, as did the English one. **Fixed** in both: "each with its reason", the Russian split in two.
7. A second `section` helper beside the one in the roadmap skill's other test. **Kept**: each test owns its helper, as the file does elsewhere.
8. The inbox's own header and the product workflow still say an entry is removed once it becomes a spec, while entries of epic 20 stay. **Kept**: outside the ticket, for a Product session.
