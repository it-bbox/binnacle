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
  - The brief's daemon sentence now has the agent keep any temporary `BINNACLE_HOME` inside its own worktree, in a directory Git ignores, and never in a scratchpad other sessions share. It starts any temporary daemon with `BINNACLE_PORT=0`, and reads its address from `binn daemon status`. It stops every daemon it started before it reports. The report's list adds that it did.
  - Step 7 gains a check before `git worktree remove`: no `runtime.json` under the worktree names a running daemon, and no process's command line holds the worktree's path. It stops none. A daemon it finds is named under *Waiting for the owner*, and step 10's list says so.
  - `apps/cli/plugin/`, the copy the npm package ships, picks the change up on the next install.
- **Answered here, as questions that block nothing.**
  - *Which port.* `BINNACLE_PORT=0` lets the system give the daemon a free port, so no two agents can choose the same one, and it needs no port the brief would have to name. `binn daemon status` prints the address it took.
  - *Where in the worktree.* `git worktree remove` refuses a worktree with untracked files, but not one with ignored files, so a home Git does not ignore would stop step 7. The brief says "a directory Git ignores", with `git check-ignore` to tell. This repository ignores `.binnacle/cache/`. The brief names no path, because the skill ships to projects whose `.gitignore` this repository does not write.
  - *What "runs from the worktree" covers.* Two cases. A daemon whose home is in the worktree leaves a `runtime.json` there, which `binn daemon status` reads. A daemon running the worktree's own code, as on Binnacle itself, names the worktree's path in its command line. That second case is how the incident's daemon outlived its worktree.
  - *What happens to the worktree when a daemon is found.* The ticket says to stop none, and does not say whether the worktree is removed. The skill leaves that worktree and its branches in place, as step 8 leaves a stopped ticket's: removing it would delete the runtime file that `binn daemon stop` reads, and the daemon could then be stopped only by its pid. The merge, the push and the snapshot have already happened by then.
- **Test-first, as read here.** The change is procedure text. As for epic 4's ticket 12 and epic 2's tickets 07 to 09, a test of its wording would test nothing, and it touches no code.
  - What it relies on are facts of the CLI and of Git. They were checked from this worktree instead, in a dry run of step 7's check, which leaves nothing behind:

    ```sh
    W=$(git rev-parse --show-toplevel)
    git check-ignore -v .binnacle/cache/home        # .gitignore:15:.binnacle/cache/
    BINNACLE_HOME=$W/.binnacle/cache/home BINNACLE_PORT=0 node apps/cli/src/bin.ts daemon start
    find "$W" -name runtime.json -not -path '*/node_modules/*'   # the home's runtime.json
    BINNACLE_HOME=$W/.binnacle/cache/home node apps/cli/src/bin.ts daemon status   # running, on an ephemeral port
    ps -eo pid,args | grep -F "$W" | grep -v grep   # node $W/apps/daemon/src/bin.ts
    git status --short                              # the home is not listed
    BINNACLE_HOME=$W/.binnacle/cache/home node apps/cli/src/bin.ts daemon stop
    ```

    Each check found the daemon, on port 45247. After the stop, neither found anything.
  - In a scratch repository, `git worktree remove` removed a worktree holding an ignored file, and refused one holding an untracked file.
- **Criterion 4 is met by what the change leaves out.** The skill's one exception, restarting the owner's daemon after a merge that changed its code, is unchanged. The new check stops nothing, and the owner's daemon runs from the main checkout, whose command line does not hold a worktree's path under `.claude/worktrees/`.
