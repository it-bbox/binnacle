# 13: Autopilot's push never waits on a prompt

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** a defect found in the autopilot run of epic 9 (2026-10-05). Step 7's `git push origin main` ran over SSH with no terminal and waited on a prompt for over two minutes, until the session killed it; the run could neither go on nor report the failure. The push must fail at once when it would need a prompt (for instance `GIT_SSH_COMMAND='ssh -o BatchMode=yes'` and `GIT_TERMINAL_PROMPT=0`), so that step 7 keeps going and reports a failed push as it already says.

- [ ] Autopilot's step 7 pushes in a way that cannot wait on a password, passphrase or host-key prompt, and reports a failed push under *Waiting for the owner*.
- [ ] A test in `apps/cli/test/pack.test.ts` holds the wording.
