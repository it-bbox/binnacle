# 12: Each autopilot agent keeps its own daemon

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** found while autopilot ran tickets 07 to 10 on 2026-09-27: agents checking their work in a browser each started a temporary daemon, and two of them chose the same `BINNACLE_HOME` in the session's shared scratchpad and the same port, so ticket 08's agent registered its worktree in ticket 10's daemon. A daemon from a worktree no longer listed by `git worktree list` was also left running. Each agent's temporary daemon is its own, and it is gone when the agent reports.

- [ ] Autopilot's brief tells each agent to keep any temporary `BINNACLE_HOME` inside its own worktree, where `git worktree remove` takes it away, and to start any temporary daemon on a port no other daemon listens on.
- [ ] The brief tells the agent to stop every daemon it started before it reports, and to say in its report that it did.
- [ ] Autopilot's step 7, before `git worktree remove`, checks that no daemon runs from the worktree, and names any it finds in its report under *Waiting for the owner*, without stopping it.
- [ ] The owner's daemon stays untouched, as today.

## Comments

- **What changed.** One skill file, `.claude/skills/binnacle/skills/autopilot/SKILL.md`; no production code.
  - The brief's daemon sentence now has the agent keep any temporary `BINNACLE_HOME` inside its own worktree, in a directory Git ignores, and never in a scratchpad other sessions share. Where Git ignores none, the agent deletes the home once its daemon is stopped. It starts any temporary daemon with `BINNACLE_PORT=0`, and reads its address from `binn daemon status`. It stops every daemon it started before it reports. The report's list adds that it did.
  - Step 7 gains a check before `git worktree remove`. A `runtime.json` under the worktree whose `pid` is a running process is a daemon. On Binnacle itself, so is a process whose command line holds `<path>/apps/daemon`. The check stops none. A daemon it finds is named under *Waiting for the owner*, and step 10's list says so. `git worktree remove` then runs only when the check found none. The install, the restart and the dashboard's generation that follow run as before.
  - `apps/cli/plugin/`, the copy the npm package ships, picks the change up on the next install.
  - Rebased onto `main` after ticket 11 merged. Step 10's *Waiting for the owner* list conflicted on one line. The resolution keeps both additions.
- **Answered here, as questions that block nothing.**
  - *Which port.* `BINNACLE_PORT=0` lets the system give the daemon a free port, so no two agents can choose the same one, and the brief has no port to name. `binn daemon status` prints the address it took.
  - *Where in the worktree.* `git worktree remove` refuses a worktree with untracked files, but not one with ignored files. A home Git does not ignore would therefore stop step 7. The brief says "a directory Git ignores", with `git check-ignore` to tell. This repository ignores `.binnacle/cache/`. The brief names no path, because the skill ships to projects whose `.gitignore` this repository does not write. For such a project, the agent deletes its home itself.
  - *What "runs from the worktree" covers.* Two cases.
    - A daemon whose home is in the worktree leaves a `runtime.json` there.
    - A daemon running the worktree's own code, as on Binnacle itself, has `<path>/apps/daemon/src/bin.ts` in its command line. That is how the incident's daemon outlived its worktree, with its home in the scratchpad.
  - *What happens to the worktree when a daemon is found.* The ticket says to stop none, and does not say whether the worktree is removed. The skill leaves that worktree and its branches in place, as step 8 leaves a stopped ticket's. Removing it would delete the runtime file that `binn daemon stop` reads, and the daemon could then be stopped only by its pid. The merge, the push and the snapshot have already happened by then.
- **Test-first, as read here.** The change is procedure text. A test of its wording would test nothing, as with epic 4's ticket 12 and epic 2's tickets 07 to 09, and the change touches no code.
  - What it relies on are facts of the CLI and of Git. They were checked from this worktree instead, in a dry run of step 7's check that leaves nothing behind:

    ```sh
    W=$(git rev-parse --show-toplevel)
    git check-ignore -v .binnacle/cache/home        # .gitignore:15:.binnacle/cache/
    BINNACLE_HOME=$W/.binnacle/cache/home BINNACLE_PORT=0 node apps/cli/src/bin.ts daemon start
    find "$W" -name runtime.json -not -path '*/node_modules/*'   # the home's runtime.json
    BINNACLE_HOME=$W/.binnacle/cache/home node apps/cli/src/bin.ts daemon status   # running, on an ephemeral port
    ps -eo pid,args | grep -F "$W/apps/daemon" | grep -v grep   # node $W/apps/daemon/src/bin.ts
    git status --short                              # the home is not listed
    BINNACLE_HOME=$W/.binnacle/cache/home node apps/cli/src/bin.ts daemon stop
    ```

    Each check found the daemon, on an ephemeral port: 45247, then 41389 on the second run. After the stop, neither check found anything.
  - In a scratch repository, `git worktree remove` removed a worktree holding an ignored file, and refused one holding an untracked file.
- **Criterion 4 is met by what the change leaves out.** The skill has one exception, restarting the owner's daemon after a merge that changed its code, and it is unchanged. It still runs when the check finds a daemon. The new check stops nothing. The owner's daemon runs from the main checkout, so its command line does not hold a worktree's path under `.claude/worktrees/`.
- **Daemons this session started.** Two, one for each dry run, each on its own ephemeral port with its home under this worktree's `.binnacle/cache/`. Both were stopped. The owner's daemon was not touched.

### Review

`mattpocock-skills:code-review` ran against `main` after the rebase, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings, all judgement calls:

1. **Windows.** `ps -eo pid,args` does not exist there, and the README says Binnacle runs on Windows. **Fixed**: the check names `Get-CimInstance Win32_Process` for Windows.
2. **No ignored directory in another project.** `binn init` writes no `.gitignore`, so an agent may find nowhere Git ignores. **Fixed**: where Git ignores none, the agent deletes its home once its daemon is stopped. The reviewer suggested the worktree's Git directory instead. **Kept out**: it lies outside the worktree, where the ticket puts the home, and step 7's search would have to look there too.
3. **The process match caught more than daemons**, such as a dev server or a watcher, which have no home, and it would have kept their worktree. **Fixed**: the match is `<path>/apps/daemon`, and only when the project is Binnacle itself. That is the one case in which a daemon's command line holds the worktree's path.
4. **Without Binnacle** the check assumed `binn` on PATH. **Fixed**: a running daemon is a `runtime.json` whose `pid` is a running process. `binn daemon status` is how to tell, not the definition.
5. **Duplicated Code** between step 7's report line and step 10's list. **Kept**: the skill pairs its steps this way already, for the restart and for ready-for-human tickets.
6. **Readability**: the new bullet was one long sentence. **Fixed**: the check is split into its runtime-file and process sentences.

**Spec: every criterion covered, nothing missing.** Findings:

7. **Leaving the worktree in place was not asked for.** **Kept**, as *Answered here* says.
8. **"Otherwise:" was ambiguous.** It could read as skipping the next bullet too, which holds the owner's daemon restart, against criterion 4. **Fixed**: the removal's own bullet starts "Unless that check found a daemon", and the bullet after it is unchanged.
9. **The `ps` check caught more than daemons.** **Fixed**, with Standards 3.

Typecheck is clean, and the full suite passes: 386 of 386.
