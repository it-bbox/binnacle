# 07: Autopilot follows /binnacle:task run and asks the plan's three questions

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** autopilot's agents follow the same process as a ticket run by hand, and the owner sees the epic's risks before the run (spec, *Autopilot's brief*, *Autopilot's three questions*). The brief tells each agent to run `/binnacle:task run <ticket path>` unattended and keeps only what being unattended adds: nobody answers, so questions go to the ticket with their options; a temporary `BINNACLE_HOME` and `BINNACLE_PORT=0` inside its worktree, every daemon it started stopped; nothing outside its worktree; the report's contents; the resume paragraph. Step 8's verification is unchanged. A new step after the epic is found planned and before the loop drafts, from the spec and the tickets, what the epic can break, which step is the riskiest and what was dropped and why, shows them, and on the owner's yes writes them under the spec's `## Risks` and commits the spec alone to `main`; without a yes it starts nothing. When the spec already has `## Risks`, it shows them and asks whether to go on, writing nothing.

- [ ] Autopilot's brief, in the plugin and the copy, points to `/binnacle:task run` and no longer copies the process's rules; the package build's test checks it and that the copy matches.
- [ ] The three questions come before the loop, start nothing without the owner's yes, and are written only when the spec has no `## Risks`; the package build's test checks the step's place.
- [ ] Step 8's checks are unchanged.
