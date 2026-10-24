# 06: The roadmap's derived part written without a yes

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer

**What to build:** after an autopilot run, a checkpoint or a Product session, an epic's status from `tickets` on and the focus's *Done* line are right with no question to the owner (spec, *The derived part of the roadmap*, *Where the rule is written*). The writer takes progress and `roadmap.status_mismatch` from `project_snapshot`, or the tickets' `Status:` lines without the daemon, counts nothing itself, and commits `docs/roadmap.md` alone, on its branch, with a subject that says it is derived from the tickets, only when something changed, never pushed. The focus's other prose and the `Next action:` stay on the owner's yes, in a commit of their own; `not started` and `spec` stay a Product session's to write on that yes; a ticket still never touches the roadmap.

- [x] `/binnacle:autopilot`'s report writes the derived part at the run's end without a yes, and still asks for the focus's prose and the `Next action:`.
- [x] `/binnacle:checkpoint` writes a `position` draft that is only derived without a yes, and shows it as written.
- [x] `/binnacle:product`'s guidance says the same for a Product session.
- [x] The roadmap's *Keeping this current*, *Who writes what*, `docs/workflow/01-product-workflow.md`, `02-development-workflow.md` and `CLAUDE.md`'s *Project operating model* state the rule.
- [x] In the package build's test, the three skills' texts and their copies carry it.

## Comments

- Decisions where the ticket is silent:
  - One paragraph states the rule, word for word, in autopilot's step 13, the checkpoint's step 3 and `/binnacle:product`'s closing guidance; the package build's test holds it as `DERIVED` in `apps/cli/test/pack.test.ts` and checks it once in each text and each `binnacle-<action>` copy. A change to the rule changes all four together.
  - Autopilot writes the derived part from step 12's snapshot, on `main` in the main checkout, after the run has ended; the report gives it as written, then proposes the rest of the focus and the `Next action:` for the yes, committed apart.
  - The checkpoint calls `project_snapshot` once for the derived part, commits it in step 3, shows it in step 4 as written, and passes it to `checkpoint_record` with the confirmed items. A `roadmap.status_mismatch` for an epic still `not started` with tickets stays a draft on the yes.
  - `/binnacle:product`'s opening still changes nothing; the derived part is written later in the session it opens. Its description now says "Its opening changes nothing".
  - The roadmap's *Who writes what* gains the derived part, the rest of the focus and `not started`/`spec` as three entries; *The status column* points to the first. These are the roadmap's rules, which the ticket names, not its position.
- What agents do with the new text, autopilot and a checkpoint committing the derived part with no question, is the exit demonstration's (ticket 09), as the spec says; the criteria above are ticked on the texts and the test that pins them.
- For the next ticket: `/binnacle:roadmap`'s *Again* (ticket 07) runs in a Product session, so the derived part's rule binds there too; the paragraph is in `product/SKILL.md`, not in `roadmap/SKILL.md`.

### Review

Against `main`, in a sub-agent, on the standards and the spec. Typecheck and the full suite pass; one author, no attribution, no dependency, nothing outside the ticket.

1. **The `tickets` clause lost "while it has tickets"** (the spec's words), so an epic with none read as vacuously `done`. **Fixed** in the shared paragraph of the three skills, `DERIVED` and `docs/roadmap.md`.
2. **`checkpoint/SKILL.md` step 3 still said "Like every draft, it is written only once the human says yes"** for the `Next action:`. **Fixed**: "Like every draft but the derived part".
3. **`/binnacle:product`'s description still said "Changes nothing."** **Fixed**: "Its opening changes nothing."
4. The checkpoint's description named only confirmed writes. **Fixed**: it names the derived part without a yes.
5. *Session rotation*'s diagram in `docs/workflow/01-product-workflow.md` showed every write after the yes. **Fixed**: one line under it names the derived part as the exception.
6. The tests did not check that the epic's status left the yes-bound proposals. **Fixed**: `doesNotMatch` on autopilot's *Roadmap* item and the checkpoint's step 3.
7. `docs/03-mcp-and-skills.md` describes autopilot's end and `/checkpoint` without the derived part. **Kept**: not among the places the spec names, and it contradicts nothing.
