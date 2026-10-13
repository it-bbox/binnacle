# 06: Autostart from the chat

Status: READY
Triage: ready-for-agent
Blocked by: 05
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** `/binnacle:init` asks the owner whether the daemon should start at login, as a terminal's `binn init` does (spec, *Autostart from the chat*). `binn init --plan --json` reports whether autostart could be asked: off and available for this home. A flag for the answer, as `--window` carries the window, is accepted by `--plan` and `--apply`; with a yes the plan has the autostart item as its last, with a no the Summary names `binn daemon autostart on`. The skill asks in the chat only when the plan says it could be asked, and passes the answer to both calls. Without the flag the chat forms behave as today.

- [ ] Through the `binn` process: `--plan --json` says whether autostart could be asked; with autostart on, or not available, it says no.
- [ ] `--plan` with the yes flag shows the autostart item last; `--apply` with the same flag runs it, through a stand-in service manager.
- [ ] With the no flag, or none, nothing is installed and the Summary names `binn daemon autostart on`.
- [ ] The `/binnacle:init` skill asks only when the plan says so, and passes the same answer to `--plan` and `--apply`.
