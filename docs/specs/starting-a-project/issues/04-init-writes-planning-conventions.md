# 04: binn init writes the planning conventions itself

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** one `binn init` sets a project up for planning, with no `/setup-matt-pocock-skills` and no second run (spec, *`binn init` writes the planning conventions itself*, *Two conventions in `issue-tracker.md`*). In the one plan it shows, each only where it is missing: `docs/agents/issue-tracker.md` for the tracker init detected — local Markdown under `docs/specs/`, GitHub or GitLab issues — with the ticket-header section in it; `docs/agents/triage-labels.md` with the five canonical labels; `docs/agents/domain.md` for a single context; and the *Agent skills* block pointing to the three, in `AGENTS.md`, or in `CLAUDE.md` when only it exists, creating `AGENTS.md` when neither does. The files keep the shape `/setup-matt-pocock-skills` writes. Where they exist, only the missing ticket-header section is added, as today, and a present block is left alone. The conventions gain the Epic brief and `## Contested points`, in what init writes and in this repository's `docs/agents/issue-tracker.md`. The roadmap skeleton's Next action names `/binnacle:roadmap`. Init's Summary, `/binnacle:init` and the README's paragraph on init no longer send anyone to the setup.

- [ ] Through init's plan and writes, on bare repositories with a local, a GitHub and a GitLab remote: the three `docs/agents/` files for that tracker, the ticket header and both conventions in `issue-tracker.md`, and the block in a new `AGENTS.md`.
- [ ] With only `CLAUDE.md`, the block goes there; with the files and the block present, only a missing ticket-header section is planned, and nothing else is touched.
- [ ] A second run plans none of it.
- [ ] The skeleton's Next action names `/binnacle:roadmap`.
- [ ] This repository's `docs/agents/issue-tracker.md` describes the Epic brief and the contested points; the init skill and the README no longer mention `/setup-matt-pocock-skills` as a step.
