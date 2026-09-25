# 12: The exit demonstration

Status: READY
Triage: ready-for-agent
Blocked by: 05, 06, 07, 09, 10, 11
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** epic 3's exit criterion, demonstrated for real: a remote issue is represented as a Binnacle Task and a compact task brief in a fresh session, and `binn init` sets up a fresh repository end to end. Decided in the spec, under *Further Notes*.

- [ ] A scratch project whose manifest points at the GitHub test repository from ticket 07 is registered. A fresh Claude Code session in it runs `/binnacle:product` and `/binnacle:task #<n>`, and the Task and brief match the issue.
- [ ] `binn init` runs on a fresh clone of a repository with a GitHub remote, every step confirmed; a fresh session there has Binnacle's tools and the `binnacle` skills.
- [ ] Every defect found is filed as a ticket in this spec, not fixed in passing.
- [ ] The roadmap marks epic 3 `done` and moves the current focus to epic 4, or, if defects were filed, moves it to them and keeps epic 3 `in progress`.

## Comments

- **Not done by an agent.** Every criterion here is performed by the owner in real, fresh Claude Code sessions, so none is ticked and `Status:` stays `READY`. The implementation session on `feat/exit-demonstration` did a dry run of each tool sequence, found no defect, and wrote the hand-check script below. Once the owner has run it, the last commit ticks the criteria, sets `Status: DONE`, and, with no defect filed, marks epic 3 `done` in the roadmap and moves the current focus to epic 4.
- **The dry run, on 2026-09-25.** It used this branch's CLI, run as `node apps/cli/src/bin.ts`, with a temporary `BINNACLE_HOME` and `BINNACLE_PORT=0`. The owner's daemon and `~/.binnacle` were not touched. The read-only tokens from `~/.binnacle/credentials.json` were passed only in the environment of the temporary daemon and of `binn init`. MCP tools were called over `binn mcp`'s stdio, as a harness calls them.
  - **The `/binnacle:product` sequence.** The scratch project was a clone of `it-bbox/binnacle-tracker-fixture` with a hand-written manifest declaring `provider: github` and that repository. It was registered, then `project_detect` and `project_snapshot` ran.
    - In flight: #3 to #7.
    - Ready to start: #2, #14, #15 and #16.
    - Counts: `BACKLOG` 1, `MERGED` 1, `DONE` 3, `CANCELLED` 1, unknown 1.
    - Attention: `task.unknown_state` for #9, `tracker.state_mismatch` for #10 and #13, `task.dangling_dependency` for #15, and `roadmap.missing`, because the fixture has no roadmap.
  - **The `/binnacle:task` sequence.** `project_detect`, then `task_get`.
    - `#14`: `READY`, no triage, no spec, dependency `#11` "Finished task" `DONE` and met, body "Fixture issue 14 for Binnacle's live tracker tests. Do not edit.", branch `feat/14-unblocked-by-a-closed-issue`. It matches the issue as GitHub's API serves it: its title, and the body after the `Status: READY` and `Blocked by: #11` lines.
    - `#2`: triage `ready-for-agent`, spec `docs/specs/demo/spec.md`, no dependencies, branch `feat/2-ready-task`.
    - `#16`: its spec is the commit-pinned permalink.
    - `#9`: state `null` and triage `needs-triage`.
    - `#17`, the pull request, and `#99`: `task.not_found`.
    - `14` without `#` answers as `#14`.
  - **On GitLab.** The same sequence ran against `miker059/binnacle-tracker-fixture`. It gave the same Tasks. Each `ticket` is `https://gitlab.com/miker059/binnacle-tracker-fixture/-/work_items/<n>`, and #16's spec is a `/-/blob/<sha>/` permalink. Signed out, the `work_items` address redirects to the sign-in page, because the project is private.
  - **The local tracker.** On a clone of this repository, `task_get` for `tracker-and-matt-pocock-integration/06` gave `DONE`, dependency `02` `DONE` and met, the spec path, the body without `## Comments`, and branch `feat/task-brief`. `…/99` gave `task.not_found`.
  - **`binn init` on a fresh clone of the GitHub fixture.** A fake `claude` that records its arguments and lists no plugins was first on PATH, and every question was answered yes. The summary was:
    - created `.binnacle/project.yaml`, which declares `provider: github`, `repository: it-bbox/binnacle-tracker-fixture`, and `knowledge.docs` and `knowledge.specs`;
    - ran `project.register`;
    - created `.mcp.json`;
    - created `.codex/config.toml`, offered because `~/.codex` exists on this machine;
    - ran `claude plugin marketplace add <this checkout>/apps/cli --scope user`, then `claude plugin install binnacle@binnacle --scope user`, in that order, after `claude plugin list --json`;
    - skipped the ticket-header section, because the fixture has no Matt Pocock layout;
    - failed the tracker check with `tracker.not_found`, because the temporary home held no token, `(404); no token was used`, with the token advice.

    With the token in `binn init`'s environment, the check reports 16 issues read, and says that the daemon reads the variable only from its own environment. A second run skipped the manifest and both harness files. It offered registration again, which re-registers harmlessly. `project_detect` and `task_get` answered in the clone.
  - **`binn init` on a fresh clone of the GitLab fixture.** It proposed `provider: gitlab` with `miker059/binnacle-tracker-fixture`, and the check read 16 issues.
  - **`binn init` on a clone of this repository**, every question answered no:
    - the manifest and `.mcp.json` are skipped;
    - the plugin is skipped, because the project provides its own at `.claude/skills/binnacle`;
    - Codex is offered `.codex/config.toml`;
    - the ticket-header section is offered as an append to `docs/agents/issue-tracker.md`, as ticket 11 said;
    - the instructions are one set: `CLAUDE.md`, which imports `AGENTS.md`.
  - **The plugin package.** `claude plugin validate apps/cli` passes, with the two warnings ticket 10 recorded. The owner's linked package, `apps/cli` in the main checkout, holds a current copy of the plugin, including `task`.
- **Defects found: none.** Three observations, not filed:
  1. Three of about thirty remote reads failed as `tracker.unreachable`, "The operation was aborted due to timeout", at the adapter's 10-second limit. Two of them were the first read after the daemon started. Every other read took 0.4 to 1.2 seconds, and three more restarts did not reproduce it. It looks like the network, not the code, and a ticket needs a defect it can reproduce. If a read times out once in the demonstration, repeat the command. If it happens again, file it as ticket 13, with the times and whether each was the first read after `binn daemon start`.
  2. On an already registered project, `binn init` still offers registration, and a yes re-registers it. That is harmless (story 64), so nothing was filed.
  3. The plugin is installed at user scope, so after the demonstration a session in this repository sees `binnacle@binnacle` next to `binnacle@skills-dir`. That is the double listing the spec's *Further Notes* warn about. The script below undoes the install before it returns to this repository.

### Hand-check script

It takes about fifteen minutes. The expected output is what the dry run gave. Where it differs, file a ticket in this spec, numbered 13 onward, with `Status: READY`. Run every shell step in one terminal, because steps 4 and 6 read the clones' paths from `$GH` and `$GL`. Open the `claude` sessions in other terminals.

**0. Before starting.** Nothing needs merging first: `main` already holds all the code, and this branch adds only this comment. It is merged with the commit that sets `DONE`. Run the current `main`, with the tokens `binn` already reads from `~/.binnacle/credentials.json`:

```sh
cd ~/Projects/dev-control-starter && git switch main && pnpm install   # pnpm install refreshes apps/cli/plugin
binn daemon stop; binn daemon start
claude plugin list --json | grep '"binnacle@binnacle"' || echo 'no installed binnacle plugin: good'   # binnacle@skills-dir is this repository's own
```

**1. `binn init` on a fresh clone of a repository with a GitHub remote** (criterion 2, and ticket 10's real commands):

```sh
GH=$(mktemp -d) && cd "$GH" && git clone git@github.com:it-bbox/binnacle-tracker-fixture.git && cd binnacle-tracker-fixture
binn init
```

- Answer `y` to the manifest, registration, `.mcp.json` and the plugin. Answer the Codex question as you like; the criteria do not need it.
- The summary lists:
  - `created .binnacle/project.yaml`, with `id: binnacle-tracker-fixture`;
  - `ran project.register`;
  - `created .mcp.json`;
  - both `claude plugin` commands `ran`, with the marketplace at `…/dev-control-starter/apps/cli`;
  - `skipped ticket-header section`;
  - `checked tracker: readable`.

  If `binn init` fails, file that defect. Criterion 1 does not depend on it: write the manifest from the dry run by hand, with `provider: github` and `repository: it-bbox/binnacle-tracker-fixture`, then run `binn project register` and install the plugin with the two commands above. Then check:

```sh
claude plugin list --json | grep '"binnacle@binnacle"'       # listed
claude plugin marketplace list                               # binnacle, at …/dev-control-starter/apps/cli
binn project list                                            # includes this clone
git status --short                                           # only untracked files: nothing committed
```

**2. A fresh session in that clone** (criteria 1 and 2, and ticket 06's remote check):

- Run `claude` in `$GH/binnacle-tracker-fixture` and approve the project's `binnacle` MCP server when asked.
- `/mcp` shows `binnacle` connected, with seven tools. Typing `/binnacle:` offers `product`, `daily`, `task`, `checkpoint` and `autopilot`.
- `/binnacle:product` presents the dry run's snapshot above:
  - the registered checkout on `main`, dirty with the files `binn init` wrote;
  - #3 to #7 in flight, and #2, #14, #15 and #16 ready to start;
  - five attention items, one of them `roadmap.missing`;
  - pending decisions, CI and usage not available.
- `/binnacle:task #14` presents the `#14` brief above, and ends "The branch for this Task is `feat/14-unblocked-by-a-closed-issue`." Compare it with https://github.com/it-bbox/binnacle-tracker-fixture/issues/14.
- `/binnacle:task #2` gives spec `docs/specs/demo/spec.md`, triage `ready-for-agent` and branch `feat/2-ready-task`.
- `/binnacle:task #99` gives `task.not_found`, with the id forms.
- Without a slash command, ask the session to brief you on issue 14. It may call `task_get`, but it does not start `/binnacle:task`, whose frontmatter says `disable-model-invocation: true`.
- Close the session. `git status --short` is as step 1 left it, and `git branch` lists only `main`.

**3. GitLab's issue addresses** (ticket 07):

```sh
GL=$(mktemp -d) && cd "$GL" && git clone git@gitlab.com:miker059/binnacle-tracker-fixture.git && cd binnacle-tracker-fixture
binn init    # y to the manifest, registration and .mcp.json; the plugin is skipped as already listed
```

- The tracker check reads 16 issues.
- In a fresh `claude` session there, `/binnacle:task #16` shows the ticket as `https://gitlab.com/miker059/binnacle-tracker-fixture/-/work_items/16`, and the spec as a `/-/blob/<sha>/docs/specs/demo/spec.md` permalink.
- Signed in to GitLab, open both addresses: they show issue 16 and the demo spec.

**4. Undo the plugin** (ticket 10), before any session in this repository:

```sh
claude plugin uninstall binnacle@binnacle
claude plugin marketplace remove binnacle
claude plugin list --json | grep '"binnacle@' || echo 'removed'
binn project unregister "$GH/binnacle-tracker-fixture"; binn project unregister "$GL/binnacle-tracker-fixture"
```

**5. This repository** (ticket 06's local checks, and ticket 11's note):

- In a fresh `claude` session in `~/Projects/dev-control-starter`, run `/binnacle:task tracker-and-matt-pocock-integration/06`. It gives:
  - `DONE`;
  - dependency `02` `DONE` and met;
  - the spec path;
  - the body without `## Comments`;
  - "The branch for this Task is `feat/task-brief`."

  `/binnacle:task tracker-and-matt-pocock-integration/99` gives `task.not_found`. `git status` and `git branch` are unchanged.
- Run `binn init` on a throwaway clone:

  ```sh
  REPO=$(mktemp -d) && git clone -q ~/Projects/dev-control-starter "$REPO/binnacle" && binn init "$REPO/binnacle"   # answer n to everything
  ```

  It offers the `## Ticket header` section to `docs/agents/issue-tracker.md`, because that file describes the header under `## Conventions` and `## Projects using a remote tracker`, and has no heading named `Ticket header`. Decline it. Giving the file that heading instead is a Product change to `main`.

**6. Optional: ticket 11's token advice.** Run `BINNACLE_HOME=$(mktemp -d) binn init "$GH/binnacle-tracker-fixture"` from a shell without `BINNACLE_GITHUB_TOKEN`, and answer `n` to everything. The tracker check fails with `tracker.not_found` and prints a menu path on GitHub. Follow that path: it should reach the page for a fine-grained token with Issues set to read-only.

### Review

`/code-review` ran against `main` on both axes. The diff is this comment only.

**Standards: no hard violations, and seven findings.**

1. Step 0 said to merge this branch before the demonstration. `Status:` would then have reached `main` as `READY` after the merge, which `docs/workflow/02-development-workflow.md` rules out. **Fixed**: nothing needs merging first, and the branch is merged with the `DONE` commit.
2. There was no `### Review` section. **Fixed**: this one.
3. Step 0's check matched `binnacle@skills-dir`, the listing every session in this repository has. **Fixed**: it matches `binnacle@binnacle`.
4. The clones' paths live in shell variables across steps, and a new terminal loses them. **Fixed**: the script says to run every shell step in one terminal.
5. Mysterious Name: the variables were `D`, `G` and `T`. **Fixed**: they are now `GH`, `GL` and `REPO`.
6. Duplicated Code: the script repeats expected outputs from the dry-run record. **Kept**: the script is the checklist the owner reads while running it, and the record is the evidence behind it.
7. Divergent Change: the comment mixes the status, the record and the observations. **Kept**: each one is its own labelled bullet, as in tickets 07 and 10.

**Spec: the notes to ticket 12 from tickets 06, 07, 10 and 11 are all covered, and the order is sound. Five findings.**

1. Ticket 11's optional hand check of the token advice was missing. **Fixed**: step 6.
2. Criterion 1 depended on `binn init` working in step 1. **Fixed**: step 1 gives the manual route.
3. The same merge-before-`DONE` point as Standards 1. **Fixed** there.
4. The reviewer said observation 1, the timeouts, should be filed as a defect. **Kept** as an observation. Nothing reproduced it, so a ticket would describe no defect. The observation now says when to file it: a second timeout during the demonstration.
5. Two summary lines in step 1 are shortened. **Left**: they are for comparing by eye.
