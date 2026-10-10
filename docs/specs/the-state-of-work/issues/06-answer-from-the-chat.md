# 06: The owner answers a question from the chat

Status: DONE
Triage: ready-for-agent
Blocked by: 04, 05
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** `/binnacle:answer [task]`, in the `binnacle` plugin and as `binnacle-answer` in the `skills` CLI's copy: human-started only, it lists the unanswered questions or goes to the named Task's, takes the owner's answer from the chat as given, and writes it — into the ticket on the Task's branch, committed there, in the worktree that has the branch or a temporary one it removes; into the ticket in the caller's checkout when the Task has no branch; as an issue comment through `gh` or `glab` on a remote tracker. It never pushes, and ends by saying how the work resumes (spec, the `/binnacle:answer` decision).

- [x] The skill's text carries the human-only rule as autopilot's does, with `disable-model-invocation`, and the check over the skill texts covers it.
- [x] The commit of an answer changes only the ticket, puts `### Answer` with the date right after the question's text, and has no `Co-Authored-By` and no assistant named.
- [x] It ends with `/binnacle:autopilot <epic>` for a Task of a planned epic, or the Task's start command otherwise.
- [x] `pack.test.ts` covers `binnacle-answer` in the copy.
- [x] `docs/03-mcp-and-skills.md`, `/binnacle:help`, and the README and `README.ru.md` where they list skills, name it.
- [x] The skill's steps followed by hand on a throwaway repository with a temporary `BINNACLE_HOME`: a question on a branch checked out in a worktree is answered, and `task_get` shows the answer; the script is under Comments.

## Comments

- **Where it lives.** The skill is `.claude/skills/binnacle/skills/answer/SKILL.md`; the package's build copies it as `binnacle-answer`, so no code changed. It reads what tickets 02, 04 and 05 built: the snapshot's `pendingDecisions.questions`, and `task_get`'s `questions` with the `branch` they were read from, which tells the branch's ticket from the checkout's. `pack.test.ts` holds the skill's rules, the human-only sentence it shares with autopilot word for word, and `binnacle-answer` in the copy.
- **Decided here, where the spec does not say:**
  - **The date is the Answer's first line**, `YYYY-MM-DD` alone, then the answer: the heading must stay `### Answer` exactly for the parser, so the date goes in its text, and `task_get` shows it with the answer.
  - **An issue comment carries no date**: the forge dates every comment.
  - **The temporary worktree is a new, empty directory outside the repository**, which `git worktree add` accepts, removed once the commit is made; the branch stays.
  - **A ticket with changes not committed where the answer would go is left alone**: the skill stops and says where, so an answer never lands in someone's work in progress.
  - **The skill checks through `task_get`** that the answer is read, on every tracker.
- **The hand check**, run on 2026-10-11 against this branch's `binn`, in a throwaway repository and a `BINNACLE_HOME` under `.scratch/`, which Git ignores, with the daemon on `BINNACLE_PORT=0` and stopped at the end. The snapshot listed the question with its branch; `git worktree list --porcelain` gave the worktree with `feat/first`; the commit changed the ticket alone; `task_get` showed the answer, dated, read from `feat/first`. The temporary-worktree path was run too, by hand, after removing that worktree: a second question answered and committed there, the worktree removed, and `task_get` showing both answers. Run from a Binnacle checkout with its dependencies installed; step 6, an edit the skill makes by hand, is done here by `awk`:

  ```bash
  set -euo pipefail
  WT=$(git rev-parse --show-toplevel)
  CHECK="$WT/.scratch/answer-check"
  export BINNACLE_HOME="$CHECK/home" BINNACLE_PORT=0
  binn() { node "$WT/apps/cli/src/bin.ts" "$@"; }
  rm -rf "$CHECK" && mkdir -p "$CHECK/repo/.binnacle" "$CHECK/repo/docs/specs/epic/issues" && cd "$CHECK/repo"
  git init -q --initial-branch=main && echo .claude/worktrees/ > .git/info/exclude
  printf 'version: 1\nproject:\n  id: answer-check\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\nknowledge:\n  docs: docs\nworkflow:\n  provider: matt-pocock\n' > .binnacle/project.yaml
  printf '# Roadmap\n\n| # | Epic | Status | Spec |\n|---|---|---|---|\n| 1 | Epic | in progress | [spec](specs/epic/spec.md) |\n' > docs/roadmap.md
  echo '# Spec' > docs/specs/epic/spec.md
  printf '# 01: First\n\nStatus: READY\nSpec: `docs/specs/epic/spec.md`\n\nBody.\n' > docs/specs/epic/issues/01-first.md
  git add . && git commit -qm Start
  git worktree add -q -b feat/first .claude/worktrees/first
  T=.claude/worktrees/first/docs/specs/epic/issues/01-first.md
  printf '\n## Comments\n\n### Question\n\nShould the limit be 10 or 20?\n\n### Review\n\nNothing yet.\n' >> "$T"
  git -C .claude/worktrees/first commit -qam 'A question'
  binn daemon start >/dev/null && binn project register "$PWD" >/dev/null
  trap 'binn daemon stop >/dev/null' EXIT
  # Steps 3-5: the question, its branch, and the worktree that has the branch checked out.
  binn call project_snapshot | node -e 'console.log(JSON.parse(require("fs").readFileSync(0)).pendingDecisions.questions.items)'
  git worktree list --porcelain | grep -B2 'refs/heads/feat/first'
  test -z "$(git -C .claude/worktrees/first status --porcelain -- docs/specs/epic/issues/01-first.md)"
  # Step 6: ### Answer with the date right after the question's text, before ### Review.
  awk -v d="$(date +%F)" '/^### Review/ && !x { print "### Answer\n\n" d "\n\n20, as the spec says.\n"; x=1 } { print }' "$T" > "$T.new" && mv "$T.new" "$T"
  # Step 7: the ticket alone.
  git -C .claude/worktrees/first commit -qm 'The owner answers the question of epic/01 in its ticket' -- docs/specs/epic/issues/01-first.md
  git -C .claude/worktrees/first show --stat --format=%B HEAD
  # Step 11: task_get shows the answer, read from the branch.
  binn call task_get '{"id":"epic/01"}' | node -e 'console.log(JSON.parse(require("fs").readFileSync(0)).questions)'
  ```

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings, all judgement calls:

1. **Step 10, the check through `task_get`, sits under *On GitHub or GitLab***, so a local answer may skip it. **Fixed**: it is step 11, under *Check*, on every tracker.
2. **GitLab's answer goes on the command line**, `glab issue note … --message <body>`, where the shell would expand a backtick, `$(…)` or a quote in the owner's words; GitHub's goes through `--body-file`. **Fixed**: the body is in a temporary file on both, GitLab's passed as `--message "$(cat <file>)"`, whose output the shell does not read again.
3. **Duplicated Code**: `pack.test.ts` lists the daemon-dependent skills and the skills that call a tool apart, and `answer` joined both. **Kept**: two rules that happen to hold the same skills today; `/binnacle:daemon`'s family shows a skill can be in one and not the other.
4. **The human-only rule is checked in autopilot's old test and in the new one.** **Kept**: the old test is epic 14's, about the harness; the new one pins the sentence the two skills share.
5. **Shotgun Surgery**: one skill named in seven files. **Kept**: the ticket's criterion and the help and copy tests ask for each of them.
6. **The marketplace listing does not name `answer`.** **Kept**: it names no Product action one by one.
7. **The `/answer` item in `docs/03-mcp-and-skills.md` restates the skill.** **Kept**: the neighbouring `/autopilot` and `/init` items do the same.

**Spec: every criterion holds but the hand check, done apart.** Findings:

8. **A GitHub tracker with a declared `host`** is not used: `gh` would post on github.com. **Fixed**: `GH_HOST` is set to its host name, as `GITLAB_HOST` is.
9. **The second `task_get`, and the warning about which question a comment answers**, are not asked for. **Kept**: the check is what the hand criterion verifies, and the warning is 10's.
10. **On GitHub or GitLab, a comment answers only the issue's latest question, and only while it is unanswered** (`addQuestionOrAnswer`); the skill warned only when a later question is open, so an earlier one, behind a later answered one, would get a comment read as nothing. **Fixed**: step 9 says before posting that the comment answers the latest question when that one is open, posting only on the yes, and that no comment can answer the chosen one when the latest is answered, posting nothing.
11. **The epic is found by the slug in the brief's `spec` path**, while the roadmap matches a Task to its epic by its spec slug, the prefix of a local Task's id. **Fixed**: on the local tracker the slug is the id's part before `/`; on GitHub or GitLab, the `spec` path's.
12. **The question is found by its text**, which two questions of one ticket could share. **Fixed**: by its position in `questions.items`, its text checked.
