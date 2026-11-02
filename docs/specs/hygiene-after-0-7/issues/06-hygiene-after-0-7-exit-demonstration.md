# 06: The exit demonstration of epic 25, and 0.8.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05
Spec: `docs/specs/hygiene-after-0-7/spec.md`

**What to build:** epic 25's exit criterion, demonstrated by the owner, then the 0.8.0 release (spec, the exit criterion, *The release*).

- [ ] With autostart on, `BINNACLE_PORT=7800 binn daemon start` starts the daemon on 7800; after a logout and login it is on 7800 still; with the variable removed, `binn daemon start` brings it back to 7717.
- [ ] A `READY` Task whose branch is merged with `git merge` is not in progress on the board, in `/binnacle:daily` or on its Task page, as in `/binnacle:product`.
- [ ] With a dev container's daemon publishing `127.0.0.1:7717` and the host's daemon stopped, `binn daemon start` on the host says another daemon holds the port and exits 1; the container removed, it starts.
- [ ] `/binnacle:init` in a chat, on a project whose Claude Code does not list the mod, asks whether to install it, and installs it only on yes.
- [ ] A new Claude Code session on a ticket's branch shows the Task and role on the mod's status line within seconds of its first turn.
- [ ] The CLI package's version is 0.8.0; 0.8.0 published by `CONTRIBUTING.md`'s *Releasing* and installed from the registry into a clean container, where `binn daemon status` gives 0.8.0.

## Comments
