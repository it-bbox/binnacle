# 05: The mod's toasts, once per machine

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/claude-code-mod/spec.md`
Roles: Developer, Reviewer

**What to build:** a toast when `main`'s CI starts failing or a question is answered, shown in one session of the machine, not in each. A context-pressure toast is shown only in the session whose context is full. This ticket covers the spec's *The toasts*.

A project's change is CI's state on the default branch's commit turning `failing`, or a question leaving the unanswered list. It toasts through `$.ui.toast` in the first session that sees it. `$.store`, kept across sessions, holds the last change shown per project, and a session that finds it already there stays quiet. Context pressure toasts when the snapshot's `context.pressure` item for this session (`own`) first appears, in that session alone. A session's first refresh records the state and toasts nothing.

- [ ] The view function, given the previous state and the store:
  - a first refresh toasts nothing;
  - a CI turn to `failing` toasts once, and not again from a store that already holds it;
  - a question leaving the list toasts;
  - context pressure toasts for `own` and never for another session's item;
  - English and Russian.
- [ ] The hooks test run by `claude plugin test`: two sessions sharing one store, one CI change, one toast.
