# 04: binn init writes the planning conventions itself

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** one `binn init` sets a project up for planning, with no `/setup-matt-pocock-skills` and no second run (spec, *`binn init` writes the planning conventions itself*, *Two conventions in `issue-tracker.md`*). In the one plan it shows, each only where it is missing: `docs/agents/issue-tracker.md` for the tracker init detected — local Markdown under `docs/specs/`, GitHub or GitLab issues — with the ticket-header section in it; `docs/agents/triage-labels.md` with the five canonical labels; `docs/agents/domain.md` for a single context; and the *Agent skills* block pointing to the three, in `AGENTS.md`, or in `CLAUDE.md` when only it exists, creating `AGENTS.md` when neither does. The files keep the shape `/setup-matt-pocock-skills` writes. Where they exist, only the missing ticket-header section is added, as today, and a present block is left alone. The conventions gain the Epic brief and `## Contested points`, in what init writes and in this repository's `docs/agents/issue-tracker.md`. The roadmap skeleton's Next action names `/binnacle:roadmap`. Init's Summary, `/binnacle:init` and the README's paragraph on init no longer send anyone to the setup.

- [x] Through init's plan and writes, on bare repositories with a local, a GitHub and a GitLab remote: the three `docs/agents/` files for that tracker, the ticket header and both conventions in `issue-tracker.md`, and the block in a new `AGENTS.md`.
- [x] With only `CLAUDE.md`, the block goes there; with the files and the block present, only a missing ticket-header section is planned, and nothing else is touched.
- [x] A second run plans none of it.
- [x] The skeleton's Next action names `/binnacle:roadmap`.
- [x] This repository's `docs/agents/issue-tracker.md` describes the Epic brief and the contested points; the init skill and the README no longer mention `/setup-matt-pocock-skills` as a step.

## Comments

- Where the spec is silent: a new manifest now always declares `workflow: provider: matt-pocock`, since the same plan writes the conventions Matt Pocock Skills read, as `docs` and `docs/specs` are declared when the plan creates them; an existing manifest is never rewritten (ADR-0026). The conventions are written even when the manifest declares `matt_pocock_skills: false`: that capability governs the install, and the ticket header is Binnacle's. The local tracker's file says `docs/specs/` whatever `tracker.local.issues` declares, as the spec does. A new `AGENTS.md` starts with `# Agent Instructions`, then the block.
- The texts live in `apps/cli/src/conventions.ts`; the ticket header moved there from `init.ts`. The local file splits the seed's `Status:` line into `Status:` and `Triage:`, as this repository's does, and the remote ones say that a spec and a brief stay in Git (ADR-0017).
- `binn audit`'s layout findings now recommend `binn init` instead of the setup, and `docs/operations/01-new-project.md`, `03-external-tools.md` and `05-installation-checklist.md` no longer name the setup as a step. For ticket 06: the README's new-project short path only lost its setup line; its order, and `01-new-project.md` and `02-existing-project-adopt.md` as a whole, are yours.

### Review

Against `main`, on the standards and the spec; the ticket names no role beyond the Developer and the Reviewer.

1. **The convention paths were written twice**: `conventionsStep` keyed the texts by literals beside `MATT_POCOCK_FILES`, joined by a `!`. **Fixed**: `layout.ts` exports `TRIAGE_LABELS` and `DOMAIN`, and `conventions.ts`'s `conventionFiles(provider)` maps each path to its text, which init iterates.
2. **Names**: `PLANNING` hid what it holds, and `REMOTE_PUBLISH` is a function. **Fixed**: `PLANNING_CONVENTIONS`, `remotePublish`; `issueTrackerFile` and the two file texts are no longer exported.
3. **`docs/operations/03-external-tools.md`** still said to hardcode no upstream detail, beside files copied in the setup's shape. **Fixed**: it names that shape as the one exception, with ADR-0042.
4. **`proposeManifest`'s comment** said only what is there is declared, above an unconditional `workflow`. **Fixed**: "or what the plan creates"; a missing space at the step's call fixed too.
5. **A test's name** said init writes neither instruction file, which it now may. **Fixed**: "a declined plan writes neither".
6. Three `Record<TrackerProvider, …>` maps in `conventions.ts`. **Kept**: each is one concern, the header, the file and the block's line.
7. With a `CLAUDE.md` that does not import `AGENTS.md`, Claude Code does not see the block in `AGENTS.md`. **Kept**: the spec puts it in `AGENTS.md` when that exists.
8. The skeleton names `/binnacle:roadmap` before ticket 06 writes it. **Kept**: the spec's order; 06 is blocked by this ticket.
9. An existing manifest without `workflow` gets the conventions but no `workflow`. **Kept**: init never rewrites a manifest (ADR-0026).
10. An existing `issue-tracker.md` gets the ticket header but not the brief and contested points (story 57). **Kept**: the spec adds only the header to an existing file, as today.
11. `audit.ts` and the operations docs changed beyond the ticket's list. **Kept**: they sent users to the setup, which the ticket retires.
12. The local file splits the seed's `Status:` line into `Status:` and `Triage:`. **Kept**: the ticket header (ADR-0024) needs `Status:` for the state.
