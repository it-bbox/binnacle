# 02: /binnacle:task run carries a ticket's process

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** a ticket is worked by Binnacle's own skill, which holds the whole per-ticket process (spec, *`/binnacle:task run <ticket>`*). The `task` skill takes `run` and a ticket path, URL or Task id; without `run` it gives the brief, as today. It becomes model-invocable, and `run` starts only when a human or autopilot's brief asks for it. The run reads the Task through `task_get`, or from the ticket when the daemon is down; refuses a Task `DONE`, `CANCELLED` or with an Unmet dependency, saying why; resumes an unmerged branch by rebasing it onto `main`, or branches `feat/<slug>` from an up-to-date `main`; implements test-first, typechecks and runs the full suite; reviews the branch against `main` in a sub-agent where the harness can start one, on the project's standards and the ticket's spec and each role its `Roles:` line names; records the Review short; ticks the criteria; makes `Status: DONE` the last commit; leaves the roadmap alone; never merges, pushes or touches `main`. A question only the owner can answer is asked in the chat when the owner is there, and recorded in the ticket with its options when unattended. `docs/workflow/02-development-workflow.md`'s *Per ticket* starts from this command and keeps no second copy of the rules; `/binnacle:help` lists `run`.

- [x] `/binnacle:task`, in the plugin and the skills copy, takes `run` and carries the process above; the package build's test checks its text, that it is model-invocable, and that the copy matches the plugin.
- [x] Without `run`, the brief is unchanged.
- [x] *Per ticket* in the development workflow points to `/binnacle:task run` instead of `/mattpocock-skills:implement`.
- [x] `/binnacle:help` names `run`.

## Comments

- The run's process is in `.claude/skills/binnacle/skills/task/SKILL.md`, under `## run`; *Per ticket* and `docs/03-mcp-and-skills.md` point to it and keep no copy. The workflow's durable rules (the next ticket's notes under `## Comments`, a retired document's rules moved, a question that blocks nothing, no `DONE` without the Review and the criteria) moved into the skill.
- `task_get` takes ids only, so the run turns a ticket path into `<spec-slug>/NN` and an issue URL into `#<number>` itself; the brief without `run` still takes an id, as before.
- For ticket 07: autopilot's brief still holds its copy of the process, and its "sub-agents in the foreground" rule is not in the run; keep it in the brief when the copy goes.
- For a Product session: `docs/roadmap.md`'s rules still give `/mattpocock-skills:implement <ticket path>` as an example of a Next action command; a ticket leaves the roadmap alone.

### Review

Against `main`, on the standards and the spec; the ticket names no role beyond the Developer and the Reviewer.

1. **The run's fallback contradicted the brief's step 1**, "If it fails, stop", while the run read the ticket with the daemon down. **Fixed**: run step 1 goes on where the brief would stop on `daemon.unreachable` or `project.not_registered`.
2. **A resumed branch with an unanswered `### Question`** would have gone on past it. **Fixed**: run step 2 stops there and leaves it to the owner; the test pins it.
3. **"Never touch `main`" against step 2's fast-forward.** **Fixed**: step 5 says "beyond step 2's fast-forward", and step 2 says so when `main` cannot be updated.
4. **The workflow's *Questions and answers* always recorded the question**, against the run's ask-in-the-chat when the owner is there. **Fixed**: the workflow says both, naming `/binnacle:task run`.
5. **A second copy of the process in `docs/03-mcp-and-skills.md`.** **Fixed**: one clause pointing to the skill.
6. **`argument-hint` suggested a path without `run`**, which the brief's `task_get` cannot read. **Fixed**: `<task id: spec-slug/NN, or #number> | run <ticket path, URL or task id>`.
7. **The branch without Binnacle on GitHub or GitLab** had no file name to come from. **Fixed**: `feat/<number>-<slug of its title>`, as `taskBranch` names it; a question there is an issue comment (ADR-0040).
8. **"brief" meant two things** in the brief's last sentence. **Fixed**: "the human's call, or an autopilot agent's, through *run* below".
9. **The test's guard came after the slices it guarded**, and its description check was weak. **Fixed**: `\n## run\n` is asserted first; the description's `run` sentence is matched whole.
10. **A stale test name**, "say what autopilot's brief says", over a test that now checks *Per ticket* points to the run. **Fixed**: renamed.
11. The run trusts an autopilot brief, which `HUMAN_ONLY` would treat as an agent's word. **Kept**: ADR-0042 and the spec's contested point make the skill model-invocable for exactly that.
12. Reading an issue on GitHub or GitLab with the daemon down goes beyond the spec's "from the ticket file". **Kept**: a Task may be an issue URL, and it costs one clause.
13. An existing `feat/<slug>` with no commit of its own reads as merged, so the run would try to create it again. **Left**: `git` refuses it loudly, and the case needs a branch made and abandoned empty.
