# 01: binn init finishes, and says what it waits on

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** found by the owner running `binn init` in another project on 2026-09-27, in an IDE's terminal. After its Summary, init never exits while the terminal stays open: it ends its readline iterator (`answers.return?.()`) but never closes the interface, so stdin keeps the process alive. Before that, it runs `claude plugin list --json` without a word first, and waits up to 10 seconds on the tracker read (`TRACKER_TIMEOUT_MS`) with nothing on screen, which reads as a hang too. Epic 7 has no spec yet; this ticket needs none.

- [x] init closes its readline interface, and exits after the Summary while stdin is an open terminal.
- [x] Before each step that waits on something outside init — `claude plugin list`, `claude plugin marketplace add` and `install`, the tracker read — init says one line naming what it waits on.
- [x] A test runs init with stdin held open and checks that it exits.

## Comments

- **Reproduced in a Product session, 2026-09-27.** A script that iterates `createInterface({ input: process.stdin })` and then calls only the iterator's `return()` stays alive under a pseudo-terminal whose input is still open, until `timeout` kills it; with `close()` on the interface it exits at once. The code is the `finally` block of `init` in `apps/cli/src/init.ts`.
- **Not part of this ticket.** The owner also saw the IDE report low memory during the run. It was not reproduced: init reads each session file as a stream, up to 100 lines, and the daemon held 117 MB afterwards with 36 GB free. It becomes a ticket if it recurs with `binn` named.
- **Checked under a pseudo-terminal, 2026-09-28.** With `script` running `binn init` and input held open after ten noes, the old code was still running when `timeout` killed it (exit 124), and the new code exited on its own after its Summary (exit 0). The test holds a pipe open instead of a terminal; the old code hangs on a pipe just the same, so the test fails on it.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes.

**Standards: no hard violation.** Findings:

1. **The test's 10-second timer was never cleared**, and held the test file open that long after it passed. **Fixed**: it is unref'd.
2. **The test read no stderr**, so a failure would have lost its cause. **Fixed**: stderr goes into the assertion's message.
3. **Duplicated Code**: `claude plugin list --json` was spelled out beside `shown(args)`. **Fixed**: the listing is shown through `shown`.
4. **Wording**: with no repository, the tracker line read "Reading the github tracker from github". **Fixed**: it names only what it reads, `Reading <repository>...` or `Reading the <provider> tracker...`.
5. **The plugin test checks that each `Running` line is there, not its order.** **Kept**: a missing line fails it, and the order follows from the code.

**Spec: every criterion covered, nothing outside the ticket.** Two other waits have no line: the opening Git read, and `project.register`, which follows its own question. The ticket names neither. The reviewer confirmed the new test fails on the old code.

Typecheck is clean, and the full suite passes: 387 of 387.
