# 11: Rework share, first-pass acceptance and context growth

Status: DONE
Triage: ready-for-agent
Blocked by: 09
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** `usage.get`'s derived metrics gain the rework share and first-pass review acceptance per completed Task and their mean, and each run its context growth — the context of its first, latest and largest call — all labelled as calculated (spec, *Derived metrics*). The dashboard's usage page shows them under its calculated heading, in both languages.

- [x] Daemon process tests: the rework share and first-pass acceptance of a repository with Tasks reviewed with and without fixes.
- [x] A run's first, latest and largest context, with nulls where a harness does not report a count.
- [x] The usage page shows the three, labelled as calculated.

## Comments

### Decisions

- **Tokens are counted once**, as `magnitude` counts them: input, cached input, cache creation and output, reasoning being a part of output. A Task's rework share is its rework tokens over its implementation and rework tokens; review runs are in neither.
- **`reworkShare`** lists each `DONE` Task with attributed runs, as `perCompletedTask` does, largest share first. A share is null when the Task's `reworkUnread` holds a reason (GitHub or GitLab without a token, without a request, or refused) or it has no implementation or rework tokens; the mean is over the shares there are. On the local tracker a Task with no Review has no rework, so its share is 0.
- **`firstPassAcceptance`** lists the `DONE` Tasks with attributed runs and a Review, by id, each `accepted` when no run of it is a rework run, and `share` is the part accepted, null when there is none. On the local tracker a Task has a Review when its ticket's first `### Review` commit is found. On GitHub or GitLab, where only requested changes are read, a Task has one when the reviews of its branch's pull or merge request were read; a request nobody reviewed counts too, marked as a `ponytail:` ceiling in `forgeReviewPoints`.
- **`contextGrowth`** gives each run's `first`, `latest` and `largest` call's context, `callContext`'s sum of input, cached input and cache creation (ticket 12's), as `{ tokens, partial }`: null when the call reports none of them, partial when it reports only some, as Codex and Gemini CLI never report cache creation. Runs come largest first, ten at most with a remainder, each with its id, Task, role, harness and start. It is project-wide only, under `derived`, as the spec's *Derived metrics* puts it.
- **Without a readable tracker** the three are unavailable with its reason, as `perCompletedTask` and `runsPerTask` are: runs need the Tasks for their roles.
- **The usage page** shows them in the *Derived metrics* card, under its calculated badge: the mean rework share and each Task's, as bars; the share accepted at the first pass and each reviewed Task as accepted or reworked; and each run's context as `first → latest, max largest`, a bar for its largest, marked partial where it is. Both dictionaries gain the strings.
- **Merged `main` into the branch** after ticket 12 landed there, and the context of a call is now its `callContext`, so the two tickets compute it once.
- **Checked by hand on 2026-10-07.** A daemon on a temporary home under `.scratch/`, an ephemeral port and a temporary Claude Code root, with a demo repository: three `DONE` Tasks, the first reviewed and fixed after its Review commit, the second reviewed with no fix, the third with no Review, and a session on `main`. The usage page showed, in Russian and in English, a mean rework share of 12 % with 35 %, 0 % and 0 %; first-pass acceptance of 50 %, the first reworked and the second accepted; and five runs' context growth, largest first. The console showed no errors. To repeat it: build such a repository with `### Review` commits on the Task branches, write Claude Code sessions under `$CLAUDE_CONFIG_DIR/projects`, then `BINNACLE_HOME=<home> BINNACLE_PORT=0 CLAUDE_CONFIG_DIR=<root> binn daemon start`, `binn project register <repository>`, `binn dashboard`, and open *Usage*; `binn daemon stop` afterwards.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard finding.** Judgement calls:

1. **The id comparison was written three times.** **Fixed**: one `byId`.
2. **A Task's tokens by role repeated `byRole`.** **Fixed**: the rework share takes them from `byRole`.
3. **The dashboard typed a run's role as a string**, so the page cast it. **Fixed**: `Role`.
4. **`ROLE_LABELS` is a second mapping from role to label.** **Kept**: the other pages list the roles by hand, one row each.
5. **`startedAt` stays in `contextGrowth` though the page no longer shows it.** **Kept**: with the harness it tells an MCP client which run it is.
6. **The rework share and first-pass sections of the page are alike.** **Kept**: they follow the card's other sections.
7. **Russian forms with one text in both.** **Kept**: the dictionary's style.

**Spec: no requirement missing.** Findings:

1. **On GitHub or GitLab a request nobody reviewed counts as reviewed**, which raises first-pass acceptance. **Kept**, marked with a `ponytail:` comment: Binnacle reads only requested changes there, and reading approvals is left until the number needs it.
2. **A Task with no Review has a share of 0 on the local tracker, and none on a forge without a request.** **Kept**: on a forge without a request the rework is not read, as `reworkUnread` says; on the local tracker a Task without a Review has no rework.
3. **The context is marked partial**, beyond the spec. **Kept**: a partial total is marked everywhere (`docs/04-telemetry-dashboard.md`).
4. **Context growth is under `derived`, not on each run.** **Kept**: the spec's *Derived metrics* and the ticket put it there.
5. **The ticket was not yet `DONE`.** **Fixed** by this commit.
