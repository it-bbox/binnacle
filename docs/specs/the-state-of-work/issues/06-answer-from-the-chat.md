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
