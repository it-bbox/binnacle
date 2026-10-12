# Issue tracker: Local Markdown

Specs and issues for this repo live in Git under `docs/specs/`, not in `.scratch/`.

`.scratch/` is git-ignored and declared disposable and worktree-local by `docs/adr/ADR-0005-scratch-ephemeral.md`. A spec written in one session and consumed by another in a later session cannot live there. `docs/adr/ADR-0017-specs-in-git-tickets-in-tracker.md` records the split: a spec is a committed document, a ticket is a work item.

## Conventions

- One effort per directory: `docs/specs/<slug>/`
- The spec is `docs/specs/<slug>/spec.md`
- Implementation issues are one file per ticket at `docs/specs/<slug>/issues/NN-<slug>.md`, numbered from `01`, never a single combined tickets file
- A ticket's slug — its file name without the number — is unique across every `docs/specs/*/issues/`, because it names the ticket's branch, `feat/<slug>`. A branch two tickets share credits neither (`docs/specs/telemetry/spec.md`, ticket 11)
- Two separate fields near the top of each issue file, because they are orthogonal axes and must not share one line:
  - `Status:` — lifecycle state from `docs/workflow/03-state-machines.md`
  - `Triage:` — role string from `triage-labels.md`
- Comments and conversation history append to the bottom of the file under a `## Comments` heading
- A grilling ends with an Epic brief, `docs/specs/<epic>/brief.md`: what it decided, in the owner's words, in five parts — the problem, the outcome wanted, who it concerns, the systems it touches, constraints and open questions. The owner reads it whole before `/to-spec`, which starts from it, and a Next action that grills an epic names its brief (`CONTEXT.md`, *Epic brief*)
- A spec lists its contested points under a `## Contested points` heading: where requirements conflict or a choice was close, each with the option taken
- The Task's Review goes under a `### Review` heading inside `## Comments`, and runs to the next heading of that level or above, so its own sub-headings are `####`. Binnacle reads it there, and a `DONE` ticket without one is the attention item `review.missing`, unless its `Triage:` is `ready-for-human`: the owner's own work, such as a demonstration, has no review
- The Review is short: a finding to fix in full, with its place and its fix; a finding kept in one line, with its reason. It may be committed before or after its fixes: Binnacle reads review and rework from the runs (`CONTEXT.md`, *Review run*, *Rework run*)
- The acceptance criterion "checked in a browser" belongs only to a ticket that changes the dashboard (`apps/dashboard`); `/to-tickets` writes it there alone
- A question only the owner can answer goes under a `### Question` heading inside `## Comments`, in a commit that changes only the ticket, on the branch where the work is; the owner's reply goes right after it under `### Answer`, written by the owner or `/binnacle:answer`, never by an agent. Binnacle reads them from the Task's branch while it is unmerged (`ADR-0040`)
- After its text, a question lists its options, each with its cost, the recommended one first and marked "(recommended)"; the owner chooses one or writes their own answer. The options are part of the question's text: the asker writes them, and only the owner answers. `/binnacle:answer` writes the date above the answer, `YYYY-MM-DD` on a line of its own, and Binnacle reads the answer without it: an Answer that is a date alone answers nothing, as an empty one does. For example:

  ```text
  ### Question

  Which store should the cache use?

  - SQLite (recommended): one file and no server; slower when many processes write at once.
  - PostgreSQL: fast under many writers; a server to install, run and back up.
  ```

`.scratch/` keeps only genuinely disposable working material: intermediate output, throwaway experiments, anything nobody needs after the task closes.

## Ticket header

Binnacle reads a ticket's state, dependencies and spec from its header: these lines, one per line, at the top of every ticket, before anything else. Write them in every ticket, and keep `Status:` current.

- `Status:` — the ticket's state, one of `BACKLOG`, `READY`, `ACTIVE`, `BLOCKED`, `READY_FOR_REVIEW`, `APPROVED`, `MERGE_READY`, `MERGED`, `DONE`, `CANCELLED`.
- `Blocked by:` — the numbers of the tickets in the same spec it waits for, such as `01, 03`, or `None`.
- `Spec:` — the spec it implements, as its path, such as `docs/specs/<slug>/spec.md`.
- `Roles:` — the roles the Task needs, comma-separated, from Developer, Reviewer, Architect, QA, Security, DevOps and Analyst, such as `Developer, Reviewer, Security`. Optional: without it a Task needs a Developer and a Reviewer. Binnacle shows its own suggested roles beside the line and never changes it.

A ticket's slug, its file name without the number, is unique across every spec's tickets: it names the ticket's branch, `feat/<slug>`, and Binnacle credits the work on a branch two tickets share to neither.

For example:

```text
Status: READY
Blocked by: 01, 03
Spec: `docs/specs/<slug>/spec.md`
Roles: Developer, Reviewer, Security
```

## When a skill says "publish to the issue tracker"

Create a new file under `docs/specs/<slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `docs/specs/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `docs/specs/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); the `Status:` line records `claimed`/`resolved` for these.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `docs/specs/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

## Projects using a remote tracker

In a project whose tracker is GitHub or GitLab, tickets are issues there and only the spec stays in Git. Each issue body starts with the same ticket header as a local ticket — `Status:`, `Blocked by:` with issue numbers, `Spec:` and, optionally, `Roles:` — and closing the issue outranks its `Status:` line (`ADR-0024`). A question and its answer are issue comments that start with `### Question` and `### Answer`, the question with its options as in a ticket. Binnacle reads that tracker and never writes to it (`ADR-0013`). The roadmap stays in `docs/roadmap.md` (`ADR-0025`).
