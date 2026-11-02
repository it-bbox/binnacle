# 03: `binn daemon start` tells another daemon from its own

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/hygiene-after-0-7/spec.md`
Roles: Developer, Reviewer

**What to build:** `binn daemon start` never reports another daemon as the one it started (spec, *Another daemon on the port*; product inbox, *Left after epic 23's tickets*). Today it accepts a start once the runtime file's pid is alive and any Binnacle answers `/health` at its address, so a dev container's daemon on the same port passed for the host's. It now asks `daemon.status` with the home's token and accepts the start only when the pid that answers is the runtime file's. A refused token or another pid means the port is held by another daemon: worded in both languages with the address, exit 1 after the start's timeout, the log's tail as today. `/health` is unchanged.

- [ ] Through `binn daemon start` with a listener on the home's port that answers `/health` as Binnacle but is not this home's daemon: the start fails with the worded message and exit 1, and does not print the other daemon's version as its own.
- [ ] The same under the service manager, through the fake one, with the service's daemon unable to bind.
- [ ] A normal start, detached and through the service, reports as before.
- [ ] The new message is worded in English and Russian, and the CLI's text tables stay complete.

## Comments
