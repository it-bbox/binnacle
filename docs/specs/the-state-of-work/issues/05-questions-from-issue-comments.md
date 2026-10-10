# 05: Questions and answers from GitHub and GitLab issue comments

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** on a GitHub or GitLab tracker, an issue comment whose body starts with `### Question` or `### Answer` is one, in creation order, read with the tracker's read-only token, so that a remote Task shows its questions as a local one does (ADR-0040; spec, *Read from issue comments*). GitHub: the repository's issue comments through every page, matched to issues by number. GitLab: the notes of each open issue, system notes left out.

- [x] Loopback-forge tests, as `github.test.ts` and `gitlab.test.ts` serve the issues: questions answered and unanswered, comments on several pages, a comment not starting with a heading ignored, GitLab's system notes ignored.
- [x] A failure to read comments (401, 403, 429, unreachable) leaves the Tasks readable and their questions unavailable with the reason; the token never appears in what is returned.
- [x] Requests go to the declared host only, as the issues' do.
- [x] `task_get` and the snapshot's `pendingDecisions` show the remote questions.

## Comments

- **Where it lives.** The comments are read in `packages/adapters/src/remote-tracker.ts` (`readQuestions`), beside the issues and through the same `readPages`, so the declared host, the token and the failure codes are the issues' own; `github.ts` and `gitlab.ts` say where each forge lists them (`IssueComments`). The pairing of Questions and Answers is the ticket's own (`addQuestionOrAnswer` in `local-tracker.ts`). A Task's `questions` is now `Question[]` or unavailable with the reason, so `taskQuestions` in `apps/daemon/src/task.ts` gives the issue's, and the brief, the Task page and whatever reads `taskQuestions` show them.
- **Decided here, where the spec does not say:**
  - **A comment is a Question or an Answer when its first line is the heading exactly**, `### Question` or `### Answer` with nothing after it but spaces, as a ticket's heading is read; its text is the rest of the comment without the blank lines around it.
  - **The order is the forge's**: GitHub's comments asked for by `sort=created&direction=asc`, GitLab's notes by `order_by=created_at&sort=asc`.
  - **A closed GitLab issue's questions are unavailable**, saying it is closed and only open issues' notes are read, rather than an empty list that would say it has none.
  - **A failure to read comments is no attention item**: the Tasks are read, and the questions carry the reason where they are shown.
  - **The Review's reason on a remote tracker** no longer says comments are never read: "Binnacle reads only questions and answers from an issue's comments", in English and Russian on the dashboard.
- **Test-first, as read here.** `github.test.ts` and `gitlab.test.ts` serve the comments and notes from their loopback forges; the existing tests that counted requests or tokens now count the comments' too, and `init.test.ts`, whose tracker check reads the tracker, sees the comments read.
- **The snapshot and the board, after ticket 04.** Ticket 04 merged first, its `pendingDecisions` and question counts saying nothing was read on GitHub or GitLab; this branch, rebased onto it, reads them from `TrackerTask.questions` in `readQuestions` (`apps/daemon/src/snapshot.ts`), each Task's questions or why they could not be read. *Waiting for the owner*'s `questions` is unavailable with the reason when an open Task's could not be, the approvals and the owner's Tasks still listed; a Task's count is null where its own could not be, a closed GitLab issue's included.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings, all judgement calls:

1. **Divergent Change**: `remote-tracker.ts` imports the pairing rule and `sectionText` from `local-tracker.ts`. **Kept**: the spec reads questions "parsed once", as the ticket's are, and the ticket's parser is where that rule lives; one import.
2. **Duplicated Code, Primitive Obsession**: `{ available: false; reason: string }` is spelled in core, beside three other declarations of the same shape. **Kept**: the shape is structural, so the daemon's `Unavailable` is the same type; one `Unavailable` in core would touch the daemon, the dashboard and `git.ts`, a refactor this ticket does not need.
3. **Repeated Switches**: `IssueComments.lists` gives one repository list, `issue: null`, or one per issue, and GitLab's `toComment` checks `issue === null`, which cannot happen. **Kept**: two variants as two types would cost more than the one check.
4. **The shared module writes GitLab's reason** that an issue no list covers is closed. **Kept**: by construction only GitLab leaves issues out, and only closed ones; a forge that left issues out for another reason would bring its own.
5. **Casts to `'Question' | 'Answer'`** in both parsers. **Kept**: each follows a regular expression that matches only those words.
6. **`ticketComments` spells its return type** instead of `Pick<TrackerTask, …>`. **Kept**: the Pick would carry the union that a ticket's questions never are; it goes with 2.
7. **The ticket is still `READY`, its criteria unticked.** **Kept**: the order of commits the workflow sets, which the commits after this one complete.

**Spec: the criteria hold but one, half of which waits on ticket 04.** Findings:

8. **GitLab's failures are tested on a 403 only, without a token.** **Fixed**: `gitlab.test.ts` fails one issue's notes on a 401, a 403, a 429 and a dropped connection, with a token, which is in nothing returned, and the Tasks are read.
9. **The declared host only is tested for GitHub's comments, not GitLab's notes.** **Fixed**: `gitlab.test.ts` points a next page of notes at another host, which is not read, and the questions are unavailable saying so.
10. **`pendingDecisions` does not show the remote questions**: it is still the placeholder ticket 04 replaces, on its own branch. **Fixed**: once 04 merged, this branch was rebased onto it, and `readQuestions` gives each remote Task's questions from its issue's comments, or why they could not be read, to `pendingDecisions`, the snapshot's Task items and the board's cards; `github.test.ts` and `gitlab.test.ts` cover the section, the counts and the cards, read and unavailable.
11. **Comments are read on every tracker reading**, the board's and `binn init`'s too, not only the snapshot's, the daily's and the brief's. **Kept**: the spec reads them "as the tracker's issues are", and the board is to mark an unanswered question (ticket 04).
12. **A closed GitLab issue's questions are unavailable, not empty.** **Kept**: decided under *Comments*.
13. **GitLab's notes are read all at once**, so one 429 makes every question unavailable. **Kept**: the spec's "uncached, `ponytail:` until a forge's rate limit is reached in practice", marked in the code.
14. **The heading rule and the pairing match the ticket's.** No finding.
