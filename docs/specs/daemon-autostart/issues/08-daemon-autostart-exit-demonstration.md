# 08: The exit demonstration of epic 15

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 09
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** epic 15's exit criterion, demonstrated by the owner on Linux (spec, the exit criterion).

- [ ] `binn init` answered yes, then a reboot: the daemon answers with nobody starting it; the hand-written `binnacle.service` was replaced.
- [ ] `binn daemon stop` then `binn daemon start` leaves one daemon, supervised by the service.
- [ ] A unit pointing at a Node that is gone shows as broken in `binn daemon status`, the snapshot and the dashboard; the next `binn daemon start` repairs it.
- [ ] `binn daemon autostart off` leaves no unit and no daemon.
- [ ] CI's live test is green on macOS and Windows.
