# 07: The exit demonstration of epic 22, and 0.6.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06
Spec: `docs/specs/claude-code-mod/spec.md`

**What to build:** epic 22's exit criterion, demonstrated by the owner, then the 0.6.0 release (spec, the exit criterion, *The release*).

- [ ] `binn init` asks whether to install the mod, declines on Enter, and installs it on a yes.
- [ ] In the terminal and in the desktop app, the status line shows the Task and role on a ticket's branch and the role on `main`, with tokens, context and the usage limits, beside the owner's own `statusLine`.
- [ ] The band shows a question recorded on a ticket's branch and is gone once the question is answered.
- [ ] `binnacle-pane` opens and closes the pane, in a terminal narrower than 144 columns and in the desktop app, and its buttons put their commands in the prompt box without sending them.
- [ ] With two sessions open, a failing CI on `main` toasts in one of them.
- [ ] A session on `main` starts with the session-start lines, and a session on a ticket's branch without them.
- [ ] With the daemon stopped, the mod shows nothing and says nothing.
- [ ] `claude plugin validate` on the built mod is clean.
- [ ] The CLI package's version is 0.6.0; 0.6.0 is published by `CONTRIBUTING.md`'s *Releasing* and installed from the registry into a clean container, where `binn daemon status` gives 0.6.0.
