# 07: Autopilot follows /binnacle:task run and asks the plan's three questions

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** autopilot's agents follow the same process as a ticket run by hand, and the owner sees the epic's risks before the run (spec, *Autopilot's brief*, *Autopilot's three questions*). The brief tells each agent to run `/binnacle:task run <ticket path>` unattended and keeps only what being unattended adds: nobody answers, so questions go to the ticket with their options; a temporary `BINNACLE_HOME` and `BINNACLE_PORT=0` inside its worktree, every daemon it started stopped; nothing outside its worktree; the report's contents; the resume paragraph. Step 8's verification is unchanged. A new step after the epic is found planned and before the loop drafts, from the spec and the tickets, what the epic can break, which step is the riskiest and what was dropped and why, shows them, and on the owner's yes writes them under the spec's `## Risks` and commits the spec alone to `main`; without a yes it starts nothing. When the spec already has `## Risks`, it shows them and asks whether to go on, writing nothing.

- [x] Autopilot's brief, in the plugin and the copy, points to `/binnacle:task run` and no longer copies the process's rules; the package build's test checks it and that the copy matches.
- [x] The three questions come before the loop, start nothing without the owner's yes, and are written only when the spec has no `## Risks`; the package build's test checks the step's place.
- [x] Step 8's checks are unchanged.

## Comments

- The three questions are autopilot's step 6, so the loop and the end moved one down: "Step 8's checks" are now step 9's, *Verify, then merge*, word for word.
- Where the spec is silent: the brief keeps two lines the spec's list does not name, no `Co-Authored-By`, "Generated with" or assistant in a commit, and no dependency or change beyond the ticket, since step 9 checks them and the task skill defers to the project's instruction files; and the sub-agents in the foreground, since step 8 relays a report that reaches autopilot instead. `## Risks` goes at the spec's end.
- What the agents do with it, and the three questions shown to the owner, is ticket 08's demonstration.

### Review

Against `main`, on the standards and the spec; the ticket names no role beyond the Developer and the Reviewer.

1. **The brief dropped the guard on `main`**, and `/binnacle:task run` fetches and fast-forwards `main` where it can: unattended, with no terminal guard, from a worktree whose `main` is checked out in the run's checkout. **Fixed**: the brief says to branch from the local `main` as it is, fetch nothing and leave `main` alone; `pack.test.ts` pins it.
2. **Step 9 checks the diff stays in the ticket's scope**, which nothing told the agent. **Fixed**: the brief's line on what step 9 checks names it.
3. The resume paragraph repeats the task skill's step 2. **Kept**: the spec keeps it.
4. The brief's commit and dependency line repeats step 9's checks. **Kept**: the agent must know what is checked; the task skill leaves it to the instruction files.
5. The ticket says "Step 8"; the step is now 9. **Kept**: recorded above, the ticket's text left as written.
6. A missing space in a test's regex list. **Fixed**.
