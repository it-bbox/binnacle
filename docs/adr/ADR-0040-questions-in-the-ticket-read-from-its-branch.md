# ADR-0040: Questions and Answers Live in the Ticket, Read From the Task's Branch

**Status:** Accepted

**Extends:** ADR-0022, whose autopilot stops a ticket at a question only the owner can answer, and now resumes it once the question is answered. ADR-0013 and ADR-0020 stand: Binnacle still writes nothing.

## Context

The baseline makes Questions and Answers explicit artifacts of the Project Brain, and `/daily` says which questions wait for a decision. Until epic 11 a question lived in the chat: autopilot's agent put it at the top of its report, autopilot sent a push notification, and nothing recorded it once the session closed. Phase 11 puts it where the Review already is, in the ticket: `### Question` and `### Answer` under `## Comments`, or the issue's comments on a remote tracker.

On the local tracker that leaves a gap. A question is asked by an implementation session, which works on the Task's branch, `feat/<slug>`, in a worktree of its own, and never commits a ticket to `main` (`docs/workflow/02-development-workflow.md`). Binnacle reads tickets from the caller's checkout, which is `main` for a Product session. The question would reach Binnacle only once the branch merged, which a ticket stopped on a question never does.

On a remote tracker Binnacle reads an issue's body and never its comments, so no question there is read either.

## Decision

- **A question is recorded in the ticket**: `### Question` under `## Comments`, answered by the `### Answer` that follows it before the next `### Question`. On GitHub or GitLab, an issue comment that starts with `### Question` or `### Answer` is one, in the order the comments were made. A Question with no Answer after it is unanswered.
- **On the local tracker, Binnacle reads a Task's questions and answers from the tip of its branch** when the branch exists in the repository and is not merged into the default branch, and from the caller's checkout otherwise. Git is read, never written. Only the questions and answers are read from the branch: the ticket header, and so the Task's state, its dependencies and its Review, are still read from the caller's checkout (ADR-0032).
- **On GitHub or GitLab, Binnacle reads the issues' comments** with the tracker's read-only token, for questions and answers only.
- **The answer is written by a skill a human starts**, `/binnacle:answer`, never by Binnacle: on the local tracker into the ticket on the Task's branch, committed there, or on the checkout's branch when the Task has none; on a remote tracker as an issue comment, with the harness's own tooling (ADR-0013). An agent never answers a question, its own or another's.
- **Autopilot resumes an answered ticket.** Started again on the epic, it gives a ticket whose branch exists unmerged and whose questions are all answered to a new agent, on that branch.

## Considered Options

- **The question committed to `main`**, by the implementation session, as an exception to its rule. Rejected: every question is then a commit on `main` from a session that must not touch it, and the ticket file differs on `main` and on the branch, so the branch's merge conflicts in the ticket it was meant to finish.
- **The question in autopilot's report alone**, with only the answer reaching the ticket. Rejected: the question is lost with the session, the snapshot and the daily cannot list it, and a fresh Product session in the morning cannot see what waits for the owner without the chat that ran overnight.

## Consequences

- The daemon reads one more file per Task with an unmerged branch, from Git, on each snapshot. A branch left behind after its merge reads nothing from it, as it is merged.
- The Task brief, the snapshot, the daily, the dashboard and the vault show what waits for the owner: the unanswered questions, the Tasks waiting for an approval (`READY_FOR_REVIEW`, which the owner moves to `APPROVED` or back), and the `ready-for-human` Tasks ready to start.
- Reading comments on a remote tracker costs requests: GitHub lists a repository's issue comments in one paginated call; GitLab reads the notes of each open issue.
- The ticket on the branch and the ticket on `main` may differ until the merge; that is by design, and the branch's version wins at the merge, as it always has for its Review.
