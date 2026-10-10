# 11: Autopilot acts on questions, roles and CI, and proposes the course

Status: DONE
Triage: ready-for-agent
Blocked by: 03, 04, 07
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** `/binnacle:autopilot` and `/binnacle:checkpoint` change as the spec's *Autopilot* and *`/binnacle:checkpoint`* decisions say, in the plugin and the `skills` CLI's copy alike: the agent records a genuine product question as `### Question` in a commit of its own that changes only the ticket; a ticket of the epic whose branch exists unmerged with every question answered is resumed on its branch by a new agent, its earlier worktree removed when clean and no daemon runs from it; the review covers each role of `Roles:` beyond the Developer and the Reviewer under its own `####` heading, and verification checks them; the report gives `main`'s CI after the last push and puts a failing or running one under *Waiting for the owner*; the report ends with a proposed Next action paragraph, written and committed once the owner says yes after the run; the checkpoint offers a stale or missing Next action paragraph as a candidate. `docs/workflow/02-development-workflow.md` says how a session records a question and how the owner answers it.

- [x] Autopilot's brief and steps 6, 8, 9, 10 and 11 say each of the above; nothing else in it changes.
- [x] The resume reads the snapshot's `questions: { asked, unanswered }` and the branch, and never starts a ticket with an unanswered question.
- [x] The checkpoint skill offers the Next action paragraph with its proposed text, written only after the human's yes.
- [x] The development workflow describes recording a question and `/binnacle:answer`; ADR-0040 is named where the workflow cites ADRs.
- [x] The check over the skill texts still passes; `pack.test.ts` covers the copy.
- [ ] A resumed ticket merging: left to the exit demonstration (12).

## Comments

- **Where it lives.** The skill texts `.claude/skills/binnacle/skills/autopilot/SKILL.md` and `checkpoint/SKILL.md`; the package's build copies them as `binnacle-autopilot` and `binnacle-checkpoint`, so no code changed. `pack.test.ts` pins each rule by its step, through a `step(skill, n)` helper, and the copy. `docs/workflow/02-development-workflow.md` gains how a session records a question and how the owner answers it, under *Questions and answers*, and names ADR-0040 beside ADR-0022 in *Per ticket*; `docs/03-mcp-and-skills.md`'s `/autopilot` and `/checkpoint` items say the same.
- **Decided here, where the spec does not say:**
  - **The introduction's "You write no file and make no commit of your own" now reads "During the run"**, outside the steps the first criterion names: step 11's Next action is written after the run, on the owner's yes, which the old sentence forbade.
  - **A question the spec, its ADRs or the ticket answers after all is withdrawn, not answered**: step 7, unchanged, still sends such an answer to the agent, and ADR-0040 says an agent never writes an `### Answer`, so the brief has the agent revert its Question's commit and record the answer as a decision.
  - **The branch exists unmerged** when `git rev-parse --verify --quiet refs/heads/<branch>` prints a commit and `git merge-base --is-ancestor <branch> main` fails, which works without Binnacle too; a ticket with such a branch is never started afresh.
  - **Only a ticket stopped on a question is resumed**: at least one asked, every one answered (the Review's finding 14). One with an unmerged branch and no question was left to the owner by step 9, and waits for them.
  - **"No agent running"** is this run's agents, and the snapshot's `activity.running` for an earlier session's.
  - **The resume paragraph** follows the brief's first and overrides its "branch from the local `main`": check out, rebase onto `main`, read the Answers, go on, `DONE` last.
  - **The roles' concerns** are named in the brief, one phrase each from the baseline's on-demand roles, since the skill ships to projects that have no `docs/workflow/`.
- **The last criterion is the exit demonstration's** (12), with the owner: what an agent does with the skill cannot be checked by a test. On this repository, with the daemon running and an epic at `tickets` or `in progress`:

  ```text
  1. /binnacle:autopilot <epic>; an agent stops on a genuine question.
     Check: git log -1 --stat feat/<slug> changes the ticket alone, and adds ### Question;
            /binnacle:product lists it under Waiting for the owner, with its branch.
  2. /binnacle:answer <task>; answer it. Check: git log -1 --stat feat/<slug> changes the ticket alone.
  3. /binnacle:autopilot <epic> again, in a fresh session.
     Check: the earlier worktree is gone (git worktree list), the branch kept,
            the new agent's brief carries the resume paragraph, and step 8 merges the branch
            with DONE last; the report gives main's CI and ends with a proposed Next action.
  4. Say yes to the Next action. Check: git log -1 --stat main changes the roadmap alone, not pushed.
  ```

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground; the Spec sub-agent also took the Architect's look the `Roles:` line asks for.

**Standards: no hard violation.** Findings, all judgement calls:

1. **Step 6 contradicts itself**: its second paragraph still starts an agent for every ticket in `readyToStart` "that has no agent yet and was not stopped", which a ticket the first paragraph left waiting, on an unanswered question or a worktree with changes, matches. **Fixed**, with finding 9, and `pack.test.ts` pins it.
2. **Two places propose the Next action**: the report's last item, and the checkpoint the report's *Next* sends the owner to. **Kept**: the spec asks for both, both wait for the owner's yes, and once the report's paragraph is committed the checkpoint's attention no longer holds `next_action.stale`.
3. **Mysterious Name**: the test "autopilot leaves the Next action to the owner, in the brief and in its report" no longer says what it checks, since autopilot now writes the paragraph on the owner's yes. **Fixed**: it is named for what it checks, the agents leaving the paragraph and the run reporting a stale one.
4. **Duplicated Code**: the new copy test repeats what the copy test's body comparison proves for every skill. **Kept**: the criterion asks `pack.test.ts` to cover the copy, and naming what must reach it is how ticket 06 covered `binnacle-answer`.
5. **Duplicated Code**: the new `step(skill, n)` helper does what the slice of step 1 in epic 14's test does by hand. **Fixed**: that test uses the helper, which moves up beside `skillText`.
6. **The resume knows a question only as a ticket file** when read without Binnacle. **Kept**: with Binnacle the snapshot's `questions` covers GitHub and GitLab; without it autopilot already reads the position from the tickets' lines, as step 2 says.
7. **Shotgun Surgery**: one change of behaviour restated in the skill, `docs/03-mcp-and-skills.md`, the workflow and the tests. **Kept**: as ticket 06's Review kept it, each is a surface a reader opens on its own.
8. **Proposing a Next action may read as a planning step**, which autopilot must not run. **Kept**: the planning steps are `/grill-with-docs`, `/to-spec` and `/to-tickets`, as step 5 names them; the proposal is a paragraph the owner accepts or not.

**Spec: every criterion but the hand one holds.** Findings:

9. **A ticket read from the `Status:` lines, past `readyToStart`'s remainder, is not checked for a branch**, so it could be started afresh on an existing `feat/<slug>`. **Fixed**, and `pack.test.ts` pins it: the first paragraph also reads the tickets past the remainder, and the second paragraph starts no ticket whose branch exists unmerged; the first paragraph decides it.
10. **The introduction's sentence changed** outside steps 6, 8, 9, 10 and 11. **Kept**: decided under *Comments*; without it step 11's commit contradicts it.
11. **The Question withdrawn with `git revert`** is not asked for. **Kept**: decided under *Comments*; it reconciles the unchanged step 7 with ADR-0040.
12. **The harness's branch for the earlier worktree is deleted** on a resume, where the spec says only "keeping the branch". **Kept**: step 8 does the same after a merge, and `git branch -d` refuses a branch with work not merged.
13. **The checkpoint also drafts the Next action "when this session's decisions moved the course"**, where the spec says "a stale or missing Next action paragraph". **Fixed**: the clause goes; a moved course is already a `position` item.
14. **A ticket with no question is resumed too**, `asked` zero counting as all answered: a ticket step 9 stopped on failing checks and left to the owner would be resumed silently, and its clean worktree removed, perhaps a hand session's that `activity.running` does not see. **Fixed**, and `pack.test.ts` pins it: a ticket is resumed only when `asked` is above zero and `unanswered` is zero; one with a branch and no question waits for the owner.
15. **"Merged" is read as an ancestor of `main`**, which a squash or rebase merge would miss. **Kept**: autopilot merges with `--ff-only`, and Binnacle reads a merged branch the same way (ADR-0040).

#### Architect

16. **Binnacle still writes nothing** (ADR-0013, ADR-0020): only the skills and the agents write, on their branches or on the owner's yes. Nothing to fix.
17. **ADR-0022's approval is kept** to one epic, and Binnacle's suggested roles drive nothing; the one overreach, resuming a ticket stopped for another reason than a question, is finding 14.
18. **The Next action stays the owner's** (ADR-0037): proposed in the report, committed only on the yes once the run has ended, never pushed. Proposing it twice is finding 2. A worktree session cannot commit to `main` here, but step 3 already refuses to run in one.
19. **`main` is named rather than the default branch** in the new checks. **Kept**: autopilot names `main` throughout, from step 3's pull to step 8's merge; the new text follows it.

**In all**: six findings fixed, 1 and 9 by one change, ten kept with their reasons, and three, the Architect's 16 to 18, that find nothing to fix beyond findings 2 and 14. The full suite, 678 tests, and the typecheck pass after the fixes.
