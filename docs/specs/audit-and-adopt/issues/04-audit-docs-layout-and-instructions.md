# 04: The audit reads docs, the Matt Pocock layout and agent instructions

Status: DONE
Triage: ready-for-agent
Blocked by: 03
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** three more areas of `binn audit`. Docs, ADRs and context: whether the repository has a `CONTEXT.md`, an ADR directory and `docs/`. The Matt Pocock layout: `docs/agents/issue-tracker.md`, `triage-labels.md` and `domain.md`, and `docs/specs/<slug>/`, a partial layout reported as partial with the missing parts named, and a missing ticket-header convention in `docs/agents/issue-tracker.md` as a gap that names `binn init` (ADR-0024). Agent instructions: `AGENTS.md` and `CLAUDE.md` read as one set when one imports the other (`instructionSets`), two files that do not import each other as a recommendation to decide which is canonical, and no instructions at all as a finding. The detection of the layout moves out of init so that the audit and init read it the same way.

- [x] A fixture with a context file and an ADR directory but no ticket-header convention gets a gap that names `binn init`.
- [x] A partly present layout names what is missing, and a complete one is `ok`.
- [x] A `CLAUDE.md` that holds `@AGENTS.md` is one set and gets no finding about two files; two files that do not import each other get the recommendation.
- [x] A repository with no agent instructions says so.
- [x] The layout detection is shared with `binn init`, not copied.

## Comments

### Decisions

- **Where things live.** The layout detection that was in `init.ts` (the convention files, the ticket-header heading, the instruction files) is now `apps/cli/src/layout.ts`, with `specSlugs` and `describeSets` added; init and the audit both import it. The three areas are three lists in `apps/cli/src/audit.ts`, joined in `audit()`'s one array. The finding type is unchanged.
- **Check codes.** `docs.context`, `docs.adr`, `docs.docs`; `layout.files`, `layout.ticket_header`; `instructions.sets`. A missing file or directory is a `gap` with a recommendation; present is `ok`.
- **The layout** is the three convention files plus at least one directory under `docs/specs/`. None of it is a gap that points to `/setup-matt-pocock-skills`; some of it is a gap that says "partial", lists what is present and names what is missing; all of it is `ok`.
- **The ticket-header gap** is reported whenever the section is absent, including when `issue-tracker.md` is missing: the recommendation then says to run `/setup-matt-pocock-skills` first and `binn init` after, since init only extends an existing file. The two findings then share a root cause, which was kept: the ticket's first criterion has a fixture with no layout files at all.
- **Instructions.** Only `AGENTS.md` and `CLAUDE.md` at the root, as in init. No file is a `gap`; one set, however many files, is `ok`; two sets is a `gap` that recommends deciding the canonical one. An instruction file that cannot be read is left out, so a read-only audit does not crash on it (init gains the same).
- **This repository's own `docs/agents/issue-tracker.md`** states the ticket-header convention in its bullets but has no section headed "Ticket header", so the audit (and init) report the gap on it. Not changed here: ticket 08's exit demonstration expects a clean report, so the owner decides whether that section is added to the file or the detection recognises the existing wording.
- **Not done:** audit recommendations naming `binn init` for every missing Binnacle file (story 45) belong to ticket 07; this ticket's one `binn init` recommendation is the ticket-header gap.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Judgement calls:

1. **The instruction-set sentence was built in both init and audit.** **Fixed**: `describeSets` in `layout.ts`.
2. **`matt()` was a cryptic name.** **Fixed**: `mattPocockLayout()`.
3. **The missing and the partial branches of the layout finding are near-identical literals.** **Kept**: the explicit form reads clearer than a builder.
4. **Finding literals repeat `code`, `area`, `status`.** **Left**, as in ticket 03: a helper when a later area's repetition hurts.
5. **`mattPocockFiles` and `MATT_POCOCK_FILES` differ by case.** **Kept**: one is the list, the other reads it.
6. **`mattPocockLayout` re-derives `present.includes(ISSUE_TRACKER)`.** **Kept**: one line.

**Spec:**

1. **An unreadable `AGENTS.md` or `CLAUDE.md` (a directory, no permission) failed the whole audit.** **Fixed**: it is left out of the sets.
2. **`docs.adr` checks only `docs/adr`, and `existsSync` accepts a file.** **Left**: the documented layout is `docs/adr`; other conventions (`doc/adr`, `docs/decisions`) are a reach the spec does not ask for.
3. **An empty `docs/specs/<slug>/` counts as a spec.** **Left**: the directory is the layout; no read of its content is needed (spec, Out of Scope).
4. **The bare-repository test's area assertion was loosened to a list.** **Kept**: it lists the four areas now present.
5. **`CLAUDE.md` importing an absent `AGENTS.md`** reads as one set, CLAUDE.md. **Kept**.
6. **`layout.ticket_header` shares a root cause with `layout.files` when `issue-tracker.md` is missing.** **Kept**, see Decisions.
7. **Status and the roadmap were not in the first commit.** **Fixed**: they are this ticket's last commit.

Typecheck is clean, and the full suite passes: 401 of 401. The audit run on this worktree prints its findings, with the one gap above.
