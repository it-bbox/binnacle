# 13: Autopilot's push never waits on a prompt

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** a defect found in the autopilot run of epic 9 (2026-10-05). Step 7's `git push origin main` ran over SSH with no terminal and waited on a prompt for over two minutes, until the session killed it; the run could neither go on nor report the failure. The push must fail at once when it would need a prompt (for instance `GIT_SSH_COMMAND='ssh -o BatchMode=yes'` and `GIT_TERMINAL_PROMPT=0`), so that step 7 keeps going and reports a failed push as it already says.

- [x] Autopilot's step 7 pushes in a way that cannot wait on a password, passphrase or host-key prompt, and reports a failed push under *Waiting for the owner*.
- [x] A test in `apps/cli/test/pack.test.ts` holds the wording.

## Comments

- **The pull too.** Step 2's `git pull --ff-only` reaches the same remote over the same SSH, with the same lack of a terminal, so it runs with the same two variables. A failed pull already stops the run there and says why.
- **Checked by hand,** read-only, against this repository's `origin` (`git@github.com:...`): `git ls-remote` with the two variables answered at once through the owner's SSH agent; with no key, no agent and no known host it failed in about a second with `Host key verification failed`, instead of waiting.

### Review

Code review against `main`, both axes, done in the session itself: the diff is one skill and one test.

- **Kept.** `GIT_SSH_COMMAND` overrides a `core.sshCommand` the owner may have set, for instance to pick a key. Such a push then fails and is reported, rather than hanging; the ticket names these two variables, and nothing in this repository sets `core.sshCommand`.
- **Left.** A credential helper with a window of its own, such as Git Credential Manager over HTTPS, is not a terminal prompt, and `GIT_TERMINAL_PROMPT=0` does not stop it. The remote here is SSH; a defect, if one shows up, becomes a ticket.
- **Kept.** The test matches the skill's sentences word for word, as the file's other skill tests do.
- **Kept.** No README or `docs/` page names autopilot's push command, so nothing else changes.
