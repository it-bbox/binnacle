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

`.scratch/` keeps only genuinely disposable working material: intermediate output, throwaway experiments, anything nobody needs after the task closes.

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

In a project whose tracker is GitHub or GitLab, tickets are issues there and only the spec stays in Git. Each issue body starts with the same ticket header as a local ticket — `Status:`, `Blocked by:` with issue numbers, and `Spec:` — and closing the issue outranks its `Status:` line (`ADR-0024`). Binnacle reads that tracker and never writes to it (`ADR-0013`). The roadmap stays in `docs/roadmap.md` (`ADR-0025`).
