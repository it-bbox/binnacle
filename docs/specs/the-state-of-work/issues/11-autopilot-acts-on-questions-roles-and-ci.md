# 11: Autopilot acts on questions, roles and CI, and proposes the course

Status: READY
Triage: ready-for-agent
Blocked by: 03, 04, 07
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** `/binnacle:autopilot` and `/binnacle:checkpoint` change as the spec's *Autopilot* and *`/binnacle:checkpoint`* decisions say, in the plugin and the `skills` CLI's copy alike: the agent records a genuine product question as `### Question` in a commit of its own that changes only the ticket; a ticket of the epic whose branch exists unmerged with every question answered is resumed on its branch by a new agent, its earlier worktree removed when clean and no daemon runs from it; the review covers each role of `Roles:` beyond the Developer and the Reviewer under its own `####` heading, and verification checks them; the report gives `main`'s CI after the last push and puts a failing or running one under *Waiting for the owner*; the report ends with a proposed Next action paragraph, written and committed once the owner says yes after the run; the checkpoint offers a stale or missing Next action paragraph as a candidate. `docs/workflow/02-development-workflow.md` says how a session records a question and how the owner answers it.

- [ ] Autopilot's brief and steps 6, 8, 9, 10 and 11 say each of the above; nothing else in it changes.
- [ ] The resume reads the snapshot's `questions: { asked, unanswered }` and the branch, and never starts a ticket with an unanswered question.
- [ ] The checkpoint skill offers the Next action paragraph with its proposed text, written only after the human's yes.
- [ ] The development workflow describes recording a question and `/binnacle:answer`; ADR-0040 is named where the workflow cites ADRs.
- [ ] The check over the skill texts still passes; `pack.test.ts` covers the copy.
- [ ] A resumed ticket merging: left to the exit demonstration (12).
