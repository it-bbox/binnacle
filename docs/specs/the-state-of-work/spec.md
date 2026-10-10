# Spec: The state of work

Status: READY
Triage: ready-for-agent

Epic 11 of v1, as defined in `docs/05-mvp-plan.md` phase 11, and ADR-0040. Exit criterion, restated while specifying: on this repository, after an overnight autopilot run, a fresh Product session sees in the snapshot, the daily, the dashboard and the vault what waits for the owner — a question an agent asked on its branch, a Task waiting for an approval, a `ready-for-human` ticket — answers the question from the chat with `/binnacle:answer`, and autopilot resumes that ticket on its branch; every Task shows its roles with Binnacle's suggestions beside them; and the GitHub Actions workflow this epic adds runs on the owner's push, its state shown for `main` and for an open pull request. The phase was grilled on 2026-10-10; the owner confirmed the decisions and this spec's test seams that night, recorded under *Further Notes*.

## Problem Statement

The owner runs epics overnight with autopilot and comes back in the morning to a fresh Product session. What waits for them is not where that session can see it.

A question only the owner can answer lives in the chat: autopilot's agent puts it at the top of its report and autopilot sends a push notification. Nothing records it. A fresh session cannot list it, the snapshot's *Pending decisions* section says "Not available in this version of Binnacle", the Task page's *Questions and answers* says they are "not yet explicit artifacts", and once answered, nothing resumes the ticket: autopilot started again sees a ticket with a branch and runs, In progress, and starts no agent for it.

Who should look at a Task is not written anywhere. The baseline says Product and Developer are permanent, and an Architect, a Reviewer, QA or Security are called when needed, with Binnacle recommending and the owner deciding. No ticket says which, and Binnacle recommends nothing.

CI is not seen at all. The snapshot's *CI* section is "Not available", this repository has no CI, and an open pull request on GitHub or GitLab shows nowhere in Binnacle.

Two attention items mislead. A Next action of `/binnacle:autopilot <epic>` whose epic has nothing left for an agent passes as current: after epic 14's run it read `/binnacle:autopilot 10` with both epics done, and nothing proposed the next course. And a `ready-for-human` demonstration ticket, which has no code to review, is flagged `review.missing` once it is `DONE`.

## Solution

**Questions and answers in the ticket** (ADR-0040). An implementation session that meets a question only the owner can answer records it in the ticket, `### Question` under `## Comments`, on its branch, and stops. Binnacle reads a Task's questions and answers from its branch while the branch is unmerged, from the checkout otherwise, and from the issue's comments on GitHub or GitLab. `/binnacle:answer`, started by the owner, lists the unanswered questions, takes the owner's answer in the chat and writes it as `### Answer` into the ticket on the branch, committed there, or as an issue comment. Autopilot started again resumes the answered ticket on its branch.

**Waiting for the owner.** The snapshot's *Pending decisions* section, the daily, the dashboard and the vault's snapshot and daily notes list three things: the unanswered questions, the Tasks waiting for an approval (`READY_FOR_REVIEW`), and the `ready-for-human` Tasks ready to start. The Task brief, `/task` and the Task page show each question with its answer.

**Roles.** A ticket header carries a `Roles:` line, which `/to-tickets` or the owner writes; without it a Task needs a Developer and a Reviewer. Beside it Binnacle suggests roles of its own, each with its reason, labelled as its calculation: an Architect when the Task touches many modules of the graph, Security when it touches secrets or authentication. `/task`, the snapshot and the dashboard show both. Autopilot's per-ticket review covers every role the line names beyond the Developer and the Reviewer. Binnacle starts no one.

**CI and pull requests.** Binnacle reads, from GitHub or GitLab with the read-only token, the CI state of the default branch and the open pull or merge requests with their CI state, and shows them in the snapshot, the daily, the dashboard, the vault and on the Task they map to by branch. A failing default branch is an attention item. The forge is the tracker when it is GitHub or GitLab, and the Git remote otherwise, so this repository, whose tracker is local, is read too. This repository gains a GitHub Actions workflow that runs the typecheck and the tests. Autopilot reads `main`'s CI at the end of its run and reports a failing or unfinished one.

**The course kept current.** A Next action of `/binnacle:autopilot <epic>` whose epic has no ticket left for an agent is `next_action.stale`. Autopilot's report and `/binnacle:checkpoint` propose the new Next action paragraph, written only once the owner says yes in the chat (ADR-0037). A `ready-for-human` ticket is no longer flagged `review.missing`.

## User Stories

### Questions and answers

1. As an implementation session that meets a question only the owner can answer, I want to record it in the ticket under `### Question` on my branch and stop, so that the question outlives my session.
2. As the owner, I want a question an agent asked overnight on its branch to show in the morning's snapshot, so that I see it without the chat that ran overnight.
3. As the owner, I want a Task's questions read from its branch only while the branch is unmerged, so that a branch left behind after its merge shows nothing stale.
4. As the owner, I want a question to count as answered once a `### Answer` follows it before the next `### Question`, so that a Task with several questions shows which one is still open.
5. As the owner on GitHub or GitLab, I want an issue comment starting with `### Question` or `### Answer` read as one, so that a remote tracker works the same way.
6. As the owner, I want the Task brief and `/task` to show each question with its answer, or as unanswered, so that one command tells me where a Task stands.
7. As the owner, I want the Task page to show its questions and answers in place of "not yet explicit artifacts", so that the dashboard agrees with the ticket.
8. As the owner, I want `/binnacle:answer` to list the unanswered questions, each with its Task, ticket and the question's text, so that I pick one from the chat.
9. As the owner, I want `/binnacle:answer <task>` to go straight to that Task's open question, so that answering one takes one command.
10. As the owner, I want my answer written into the ticket on the Task's branch and committed there, so that the agent that resumes the ticket reads it where it works.
11. As the owner, I want my answer to a Task with no branch written into the ticket in the checkout and committed, so that a question asked during planning is answered the same way.
12. As the owner on GitHub or GitLab, I want my answer posted as an issue comment with the harness's own tooling, so that Binnacle still writes nothing (ADR-0013).
13. As the owner, I want `/binnacle:answer` to refuse when anything but a human started it, so that an agent never answers a question, its own or another's.
14. As the owner, I want the commit of an answer to change only the ticket, so that Binnacle's reading of review and rework is not disturbed.
15. As the owner, I want autopilot started again on the epic to resume a ticket whose questions are all answered, on its existing branch, so that answering and restarting autopilot is all I do before going back to sleep.
16. As the owner, I want autopilot to leave a ticket with an unanswered question for me and list it under *Waiting for the owner*, so that it never guesses.

### Waiting for the owner

17. As the owner, I want the snapshot's *Pending decisions* section to list the unanswered questions, the Tasks in `READY_FOR_REVIEW` and the `ready-for-human` Tasks ready to start, so that everything that waits for me is in one place.
18. As the owner, I want each item to name its Task, its title and its ticket, and a question its text, so that I can act on it without opening anything.
19. As the owner, I want an approval to remain a status change I make, so that Binnacle never approves anything.
20. As the owner, I want `/binnacle:product` to present the section, so that a fresh Product session reports it.
21. As the owner, I want the daily to show the same three lists, so that `/binnacle:daily` says which questions wait for a decision and which reviews wait for me.
22. As the owner, I want the project page of the dashboard to show the section in place of "Not available", and the board to mark a Task with an unanswered question, so that the dashboard shows what waits for me.
23. As the owner, I want the vault's snapshot and daily notes to carry the section, so that Obsidian shows it too.
24. As autopilot, I want each Task in the snapshot to say how many questions it has and how many are unanswered, so that I can tell an answered ticket from one still waiting without reading every ticket.

### Roles

25. As `/to-tickets` or the owner, I want to write `Roles: Developer, Reviewer, Security` in a ticket header, so that the roles a Task needs are part of the ticket.
26. As the owner, I want a ticket without a `Roles:` line to need a Developer and a Reviewer, shown as the default, so that every Task has its two permanent roles.
27. As the owner, I want a role outside the vocabulary — Developer, Reviewer, Architect, QA, Security, DevOps, Analyst — reported as a diagnostic, so that a typo is not silently dropped.
28. As the owner, I want Binnacle to suggest an Architect when the Task touches many modules of the graph, with how many, so that wide changes get a second look.
29. As the owner, I want Binnacle to suggest Security when the Task touches secrets or authentication, with what matched, so that such changes get a security look.
30. As the owner, I want each suggestion labelled as Binnacle's calculation, and never written to the ticket, so that the `Roles:` line stays mine (ADR-0032).
31. As the owner, I want a suggested role the line already names left out of the suggestions, so that a role is not shown twice.
32. As the owner, I want the roles and suggestions in `/task`, in the snapshot's Tasks in flight and ready to start, and on the Task page, so that I see them where I decide.
33. As the owner, I want autopilot's per-ticket review to cover each role the `Roles:` line names beyond the Developer and the Reviewer, recorded in the ticket's Review, so that the roles I set are acted on overnight.
34. As the owner, I want the convention for `Roles:` in `docs/agents/issue-tracker.md` and in what `binn init` offers to add to a project's, so that `/to-tickets` writes it in every project.

### CI and pull requests

35. As the owner, I want this repository to run the typecheck and the tests in GitHub Actions on every push to `main` and every pull request, so that a red build shows without me running it.
36. As the owner, I want the snapshot to show the CI state of the default branch's latest commit, with when and a link, so that I know whether `main` is green.
37. As the owner, I want the snapshot to list the open pull or merge requests, each with its title, branch, the Task it maps to and its CI state, so that I see what is in review.
38. As the owner, I want a failing default branch to be an attention item, `ci.failing`, so that it is not missed.
39. As the owner of a project whose tracker is local but whose code is on GitHub or GitLab, I want CI read from the Git remote, so that this repository is read too.
40. As the owner, I want CI read with the token Binnacle already holds for that host, read-only, and anonymously without one, so that no new credential is needed.
41. As the owner, I want a forge that cannot be read to make the section unavailable with the forge's reason, never empty, so that "no CI" and "cannot read CI" differ (ADR-0007).
42. As the owner, I want the Task brief, `/task` and the Task page to show the Task's pull or merge request and its CI state, so that one Task's state is in one place.
43. As the owner, I want the daily, the dashboard's project page and the vault's notes to show the CI state and the open requests, so that every surface agrees.
44. As the owner on GitLab, I want pipelines and merge requests read the same way, so that GitLab is not second-class.
45. As the owner, I want autopilot to read `main`'s CI at the end of its run and report it under *Waiting for the owner* when it is failing or still running, so that a run that broke CI does not look finished.

### The course

46. As the owner, I want a Next action of `/binnacle:autopilot <epic>` whose epic has no ticket left for an agent to be `next_action.stale`, so that a stale course is caught.
47. As the owner, I want autopilot's report to end with a proposed Next action paragraph, written and committed once I say yes in the chat after the run, so that the course moves with the work.
48. As the owner, I want `/binnacle:checkpoint` to propose the Next action paragraph among its candidates when it is stale, so that a Product session moves it as part of its delta.
49. As the owner, I want a `DONE` ticket whose `Triage:` is `ready-for-human` not flagged `review.missing`, so that a demonstration with no code to review raises no false item.

## Implementation Decisions

- **Questions and answers, parsed once.** The parser that reads a ticket's Review learns `### Question` and `### Answer` inside `## Comments`, with the same rules for headings and code fences: each Question runs to the next heading of level three or above, and is answered by the first `### Answer` after it and before the next `### Question`. A Task carries its questions in order, each with its text and its answer's text or null. An Answer with no Question before it is ignored.
- **Read from the branch** (ADR-0040). On the local tracker, for each Task whose branch (`taskBranch`) exists as a local branch of the registered repository and is not an ancestor of the default branch, the daemon reads the ticket at the branch's tip through the Git adapter's commit tree and takes its questions and answers from it; otherwise from the caller's checkout. The ticket header, the Task's state and its Review are read from the caller's checkout as before. The default branch is the one usage already uses: `origin/HEAD`'s, or else `main`.
- **Read from issue comments.** On GitHub, the repository's issue comments, through every page (`/repos/{repo}/issues/comments`), matched to issues by number; on GitLab, the notes of each open issue, system notes left out. A comment whose body starts with `### Question` or `### Answer` is one, its text the rest of the body, in creation order. A failure to read comments leaves the Tasks readable and their questions unavailable with the reason, never empty.
- **Waiting for the owner** fills the snapshot's `pendingDecisions` section, replacing its placeholder: `questions` (Task id, title, ticket, the question's text, and the branch it was read from, if any), `approvals` (Tasks in `READY_FOR_REVIEW`) and `owner` (`ready-for-human` Tasks ready to start), each with the snapshot's limit and remainder. Each Task item of the snapshot gains `questions: { asked, unanswered }`. The daily carries the same section as of now. Unavailable with the tracker's reason when Tasks cannot be read.
- **`task_get`** gains `questions`, `roles`, and `request`: the Task's pull or merge request with its CI state, or null, or unavailable with the forge's reason. The Task page's *Questions and answers* row moves from *Not available* to the page.
- **`/binnacle:answer [task]`**, a new skill in the `binnacle` plugin, and `binnacle-answer` in the `skills` CLI's copy. Human-started only (`disable-model-invocation`, and the human-only rule in its text, as autopilot's). It reads the unanswered questions from the snapshot, or the named Task's from `task_get`; shows the question; takes the owner's answer from the chat, written as given; and writes it:
  - local tracker, Task with an unmerged branch: in the worktree where the branch is checked out (`git worktree list`), or else a temporary worktree it removes afterwards, appends `### Answer` with the date right after the question's text, and commits only the ticket on the branch;
  - local tracker, no branch: the same in the caller's checkout on its branch;
  - remote tracker: `gh issue comment` or `glab issue note` with a body starting `### Answer`.
  It never pushes. It ends by saying how the work resumes: `/binnacle:autopilot <epic>` when the Task belongs to a planned epic, or the Task's start command.
- **Roles.** The ticket header parser reads `Roles:` on every tracker, a comma-separated list. The vocabulary is the baseline's: Developer, Reviewer, Architect, QA, Security, DevOps, Analyst, matched case-insensitively and written in that form; any other word is a `task.unknown_role` diagnostic and is left out. A Task's roles are `{ required: Role[], source: 'ticket' | 'default', suggested: { role, reason, provenance: 'calculated' }[] }`, with `default` meaning Developer and Reviewer.
- **Suggested roles**, computed in the daemon beside the conflict risk, from the same touched modules (`impact`): Architect when the Task touches at least 8 modules of the graph, the reason naming how many (`ponytail:` a fixed threshold, made a manifest setting if it proves noisy); Security when a touched module's path or the ticket's text holds `auth`, `token`, `secret`, `credential`, `password`, `permission`, `oauth` or `.env` as a word or path segment, the reason naming what matched. Without a graph, only Security from the ticket's text. A role the line already names is not suggested.
- **The convention.** `docs/agents/issue-tracker.md` describes `Roles:` and the Question and Answer headings; the issue-tracker section `binn init` offers to add to a project (ADR-0026) does too, so `/to-tickets` learns to write them.
- **The forge.** The tracker's provider, host and repository when it is GitHub or GitLab; otherwise the first GitHub or GitLab Git remote (`forgeRemote`), `origin` first; otherwise none, and the CI section is unavailable saying so. The token is the one Binnacle holds for that host (`trackerToken`), or none, read anonymously.
- **CI on GitHub**: a commit's state from its check runs and its combined status together — failing when any failed, was cancelled or timed out; running when any is queued or in progress; passing when all succeeded or were skipped; `none` when it has neither. The default branch's latest commit, and the open pull requests (`/pulls?state=open`), each with its head commit's state.
- **CI on GitLab**: the latest pipeline of the default branch, and the open merge requests, each with its head pipeline's status, mapped onto the same four states.
- **The `ci` section** replaces its placeholder: `{ forge, defaultBranch: { branch, commit, state, url, at }, requests: { items: { number, title, branch, taskId, draft, state, url }[], remainder } }`, every state `provenance: 'provider_reported'`. `ci.failing` is an attention item when the default branch's state is failing. A request maps to a Task by its branch (`branchTask`).
- **Reads on request.** Comments and CI are read when a snapshot, a daily or a brief is served, as the tracker's issues are, with no cache (`ponytail:` until a forge's rate limit is reached in practice).
- **The workflow** of this repository, under `.github/workflows/`: on push to `main` and on pull requests, on `ubuntu-latest`, Node 24 and the pnpm version `packageManager` names, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`. Live tests stay out. A test that passes only on the owner's machine is fixed so that it passes in a clean checkout with an empty home.
- **The stale Next action.** `nextActionAttention` also reports `next_action.stale` when the command is `/binnacle:autopilot` (or `binnacle-autopilot`) with an epic, by number or spec slug, whose spec has tickets and none left for an agent: every Task of it `DONE`, `CANCELLED`, or `ready-for-human`.
- **`review.missing`** leaves out Tasks whose `Triage:` is `ready-for-human`.
- **Autopilot** changes in its skill text, plugin and copy alike:
  - the agent's brief: a genuine product question is recorded as `### Question` under `## Comments` in a commit of its own that changes only the ticket, after committing what is sound without `DONE`, and then reported;
  - step 6: a ticket of the epic in flight whose branch exists unmerged, with questions all answered and no agent running, is resumed: its worktree from the earlier run is removed when clean and no daemon runs from it, keeping the branch, and a new agent is started whose brief says to check out the existing branch, rebase it onto `main`, read the Answer in the ticket and go on; a ticket with an unanswered question is listed under *Waiting for the owner*;
  - the brief and step 8: for each role of the ticket's `Roles:` beyond the Developer and the Reviewer, the review covers that role's concerns, under its own `####` heading in the Review; verification checks the headings are there;
  - step 10 and the report: the snapshot's `ci` for `main` after the last push; a failing or running state goes under *Waiting for the owner*;
  - the report ends with a proposed Next action paragraph, ending in exactly one command in backticks; once the run has ended, on the owner's yes in the chat, the session writes and commits it to `main` as a Product session would.
- **`/binnacle:checkpoint`** offers a stale or missing Next action paragraph as one of its candidates, with the proposed text.
- **Skills that present**: `/binnacle:product` and `/binnacle:daily` present *Waiting for the owner* and *CI*; `/binnacle:task` presents roles, questions and the request. `docs/03-mcp-and-skills.md` lists `/binnacle:answer`, and `/binnacle:help` names it.
- **Dashboard**: the project page shows *Waiting for the owner* and *CI* in place of their *Not available* rows; the board marks a card with an unanswered question; the Task page shows roles with the suggestions labelled as calculated, the questions and answers, and the request with its CI state. Every new string in English and Russian. The redesign of epic 16 restyles them; this epic only places them.
- **The vault**: the snapshot note and the daily note gain *Waiting for the owner* and *CI*.

## Testing Decisions

- A good test drives the daemon through its HTTP operations, as the MCP tools and the dashboard reach it, against a real Git repository built in a temporary directory, and checks what a caller receives: the snapshot, the brief, the daily, the attention items. It does not reach into the parser's or the adapters' internals.
- **Questions on a branch**: a repository with a ticket on `main` and a Task branch whose ticket adds `### Question`, then `### Answer`; the snapshot, the brief and the daily before and after, and after the branch merges, as `daily.test.ts` and `impact.test.ts` build their repositories.
- **A loopback forge**, as `github.test.ts` and `gitlab.test.ts` serve the issues API: issue comments, check runs and statuses, pull requests, pipelines and merge requests, with a token and without, and failing with 401, 403 and 429, for the comments, the `ci` section, `ci.failing`, the brief's request, and the forge taken from the remote when the tracker is local.
- **Roles**: tickets with a `Roles:` line, without one, and with an unknown role, against a graph fixture as `impact.test.ts` uses, for both suggestions and for a suggestion the line already names.
- **The stale Next action and `review.missing`**: a roadmap and tickets as `next.test.ts` and `snapshot.test.ts` set them up.
- **The dashboard**: `i18n.test.ts` holds every new key in both languages; the pages are checked by eye in the exit demonstration and by the agent in a browser.
- **The skills**: the package build's test (`pack.test.ts`) covers `binnacle-answer` in the copy; one check over the plugin's skill texts that `answer` carries the human-only rule. What an agent does with a skill, and autopilot's resume, belong to the exit demonstration.
- **The workflow**: the full suite and the typecheck pass in a fresh clone with an empty `HOME` and no Binnacle tokens; the run on GitHub is the exit demonstration's.

## Out of Scope

- Binnacle writing a question, an answer, a status or a comment anywhere; skills and humans write (ADR-0013, ADR-0020).
- Changing a Task's `Status:` from the dashboard, an approval included (*Later*, ADR-0020).
- Starting a role's agent, by Binnacle or by autopilot beyond the review it already runs.
- Running CI, re-running it, or waiting for it before a merge.
- Reading a pull request's review comments as questions, or a remote tracker's Review from its comments.
- CI systems other than GitHub's checks and statuses and GitLab's pipelines; an external CI that reports to GitHub as a status or check is read through them.
- Restyling the dashboard; epic 16.
- Notifications for a new question beyond autopilot's push notification.

## Further Notes

- **Decisions taken while grilling, by the owner on 2026-10-10**:
  1. On the local tracker, questions are read from the ticket on the Task's branch while it is unmerged, and the answer is written there (ADR-0040).
  2. Autopilot started again on the epic resumes a ticket whose questions are answered, on its branch.
  3. Autopilot's per-ticket review covers each role of the `Roles:` line beyond the Developer and the Reviewer; Binnacle's suggestions do not drive autopilot.
  4. Three items of `docs/product-inbox.md` join the epic: the stale `/binnacle:autopilot <epic>` Next action, the Next action proposed by autopilot's report and the checkpoint, and no `review.missing` for a `ready-for-human` ticket.
  5. Autopilot reads `main`'s CI at the end of its run and reports a failing or running one; it does not wait for CI.
  6. *Waiting for the owner* holds the `ready-for-human` Tasks ready to start, beside the unanswered questions and the approvals.
- **Test seams confirmed by the owner on 2026-10-10**: the daemon's operations against a Git repository and a loopback forge, the package build for the skill, the i18n check, and the exit demonstration for what agents and the GitHub run do.
- **Defaults taken from the docs and Ponytail, not asked**: the Question and Answer headings as the Review's; issue comments starting with the same headings; `/binnacle:answer` as the skill's name; the answer written with the harness's own tooling; the baseline's role vocabulary, with Developer and Reviewer the default; the Architect threshold of 8 modules and the Security word list; the forge from the Git remote when the tracker is local, with the token Binnacle holds for its host; check runs and statuses together on GitHub, pipelines on GitLab; reads on request, uncached; an approval being `READY_FOR_REVIEW`, per `docs/workflow/03-state-machines.md`; the workflow running the typecheck and the tests, live tests left out.
- **The exit demonstration**, on this repository with the owner: the owner pushes `main` and the workflow runs green, shown in the snapshot and on the dashboard; a branch pushed with a pull request shows with its CI state and its Task; a Task whose agent recorded a question shows it in the snapshot, the daily, the dashboard and the vault; `/binnacle:answer` writes the answer on its branch; `/binnacle:autopilot` resumes that ticket and merges it; a ticket with `Roles: Developer, Reviewer, Security` has a Security section in its Review; `/task` shows roles and Binnacle's suggestions.
