# 06: The owner answers a question from the chat

Status: READY
Triage: ready-for-agent
Blocked by: 04, 05
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** `/binnacle:answer [task]`, in the `binnacle` plugin and as `binnacle-answer` in the `skills` CLI's copy: human-started only, it lists the unanswered questions or goes to the named Task's, takes the owner's answer from the chat as given, and writes it — into the ticket on the Task's branch, committed there, in the worktree that has the branch or a temporary one it removes; into the ticket in the caller's checkout when the Task has no branch; as an issue comment through `gh` or `glab` on a remote tracker. It never pushes, and ends by saying how the work resumes (spec, the `/binnacle:answer` decision).

- [ ] The skill's text carries the human-only rule as autopilot's does, with `disable-model-invocation`, and the check over the skill texts covers it.
- [ ] The commit of an answer changes only the ticket, puts `### Answer` with the date right after the question's text, and has no `Co-Authored-By` and no assistant named.
- [ ] It ends with `/binnacle:autopilot <epic>` for a Task of a planned epic, or the Task's start command otherwise.
- [ ] `pack.test.ts` covers `binnacle-answer` in the copy.
- [ ] `docs/03-mcp-and-skills.md`, `/binnacle:help`, and the README and `README.ru.md` where they list skills, name it.
- [ ] The skill's steps followed by hand on a throwaway repository with a temporary `BINNACLE_HOME`: a question on a branch checked out in a worktree is answered, and `task_get` shows the answer; the script is under Comments.

## Comments

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings, all judgement calls:

1. **Step 10, the check through `task_get`, sits under *On GitHub or GitLab***, so a local answer may skip it. **To fix**: it holds on every tracker.
2. **GitLab's answer goes on the command line**, `glab issue note … --message <body>`, where the shell would expand a backtick, `$(…)` or a quote in the owner's words; GitHub's goes through `--body-file`. **To fix**: the body from a file on both, never typed into the command.
3. **Duplicated Code**: `pack.test.ts` lists the daemon-dependent skills and the skills that call a tool apart, and `answer` joined both. **Kept**: two rules that happen to hold the same skills today; `/binnacle:daemon`'s family shows a skill can be in one and not the other.
4. **The human-only rule is checked in autopilot's old test and in the new one.** **Kept**: the old test is epic 14's, about the harness; the new one pins the sentence the two skills share.
5. **Shotgun Surgery**: one skill named in seven files. **Kept**: the ticket's criterion and the help and copy tests ask for each of them.
6. **The marketplace listing does not name `answer`.** **Kept**: it names no Product action one by one.
7. **The `/answer` item in `docs/03-mcp-and-skills.md` restates the skill.** **Kept**: the neighbouring `/autopilot` and `/init` items do the same.

**Spec: every criterion holds but the hand check, done apart.** Findings:

8. **A GitHub tracker with a declared `host`** is not used: `gh` would post on github.com. **To fix**: `GH_HOST` set to its host name, as `GITLAB_HOST` is.
9. **The second `task_get`, and the warning about which question a comment answers**, are not asked for. **Kept**: the check is what the hand criterion verifies, and the warning is 10's.
10. **On GitHub or GitLab, a comment answers only the issue's latest question, and only while it is unanswered** (`addQuestionOrAnswer`); the skill warned only when a later question is open, so an earlier one, behind a later answered one, would get a comment read as nothing. **To fix**: say before posting that a comment cannot answer it, and post nothing then.
11. **The epic is found by the slug in the brief's `spec` path**, while the roadmap matches a Task to its epic by its spec slug, the prefix of a local Task's id. **To fix**: on the local tracker the slug is the id's part before `/`; on GitHub or GitLab, the `spec` path's.
12. **The question is found by its text**, which two questions of one ticket could share. **To fix**: by its position among the ticket's Questions, as `questions.items` orders them.
