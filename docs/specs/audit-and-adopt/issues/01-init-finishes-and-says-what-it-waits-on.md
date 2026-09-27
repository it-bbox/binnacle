# 01: binn init finishes, and says what it waits on

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** found by the owner running `binn init` in another project on 2026-09-27, in an IDE's terminal. After its Summary, init never exits while the terminal stays open: it ends its readline iterator (`answers.return?.()`) but never closes the interface, so stdin keeps the process alive. Before that, it runs `claude plugin list --json` without a word first, and waits up to 10 seconds on the tracker read (`TRACKER_TIMEOUT_MS`) with nothing on screen, which reads as a hang too. Epic 7 has no spec yet; this ticket needs none.

- [ ] init closes its readline interface, and exits after the Summary while stdin is an open terminal.
- [ ] Before each step that waits on something outside init — `claude plugin list`, `claude plugin marketplace add` and `install`, the tracker read — init says one line naming what it waits on.
- [ ] A test runs init with stdin held open and checks that it exits.

## Comments

- **Reproduced in a Product session, 2026-09-27.** A script that iterates `createInterface({ input: process.stdin })` and then calls only the iterator's `return()` stays alive under a pseudo-terminal whose input is still open, until `timeout` kills it; with `close()` on the interface it exits at once. The code is the `finally` block of `init` in `apps/cli/src/init.ts`.
- **Not part of this ticket.** The owner also saw the IDE report low memory during the run. It was not reproduced: init reads each session file as a stream, up to 100 lines, and the daemon held 117 MB afterwards with 36 GB free. It becomes a ticket if it recurs with `binn` named.
