# 05: The mod's toasts, once per machine

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/claude-code-mod/spec.md`
Roles: Developer, Reviewer

**What to build:** a toast when `main`'s CI starts failing or a question is answered, shown in one session of the machine, not in each. A context-pressure toast is shown only in the session whose context is full. This ticket covers the spec's *The toasts*.

A project's change is CI's state on the default branch's commit turning `failing`, or a question leaving the unanswered list. It toasts through `$.ui.toast` in the first session that sees it. `$.store`, kept across sessions, holds the last change shown per project, and a session that finds it already there stays quiet. Context pressure toasts when the snapshot's `context.pressure` item for this session (`own`) first appears, in that session alone. A session's first refresh records the state and toasts nothing.

- [x] The view function, given the previous state and the store:
  - a first refresh toasts nothing;
  - a CI turn to `failing` toasts once, and not again from a store that already holds it;
  - a question leaving the list toasts;
  - context pressure toasts for `own` and never for another session's item;
  - English and Russian.
- [x] The hooks test run by `claude plugin test`: two sessions sharing one store, one CI change, one toast.

## Comments

Decisions taken here, none of them the owner's:

- `view()` takes `previous`, what the session saw at its last refresh (absent at the first), and `store`, what `$.store` holds for the project. It returns `toasts`, `seen` for the next refresh, and `store`, the record to write, undefined when no project change toasted.
- CI's change is the `ci.failing` attention item, keyed by its `params.commit` and worded by `wordMessage`: a new commit failing toasts again, the same commit failing again after a pass does not. CI unread keeps what was seen, and CI first read after the session opened is no turn, since its failure may be older than the session.
- A question is its Task id and its text. The snapshot lists ten unanswered questions and counts the rest, so a question missing from the list counts as answered only when no remainder is left or a question after it is still listed: one past the last listed may only have been pushed out by a new one ahead of it (`ponytail:` in `view.ts`). A question whose Task closes leaves the list too and reads as answered. The toast names the Task: "A question on spec/02 was answered", «Получен ответ на вопрос по spec/02».
- The store's key is `shown <project path>`. It holds the last commit CI was failing on and the latest questions answered, up to 50, so that a session behind by two answers toasts neither again. Context pressure is the session's own and never stored. Two sessions refreshing in the same instant may both toast (`ponytail:` in `hooks.ts`, as the spec accepts).
- The context-pressure toast is the item's own message, worded by `wordMessage`. Every toast keeps Claude Code's default four seconds; the pointer over one holds it.
- A refresh carries a number, and one that finishes after a newer one draws nothing and toasts nothing. This retires ticket 02's `ponytail:` on refreshes finishing out of order.

For the next tickets:

- `view()` returns `{ status, band, startLines, pane, toasts, seen, store }`. A test snapshot needs `project.path` now: the hooks key the store by it, and the fixtures in `mod.test.ts` and `mod.live.ts` set it.
- The fake engine in `mod.test.ts` takes a store as its second argument, so two engines can share one; `state.toasts` lists what was shown.
- In `claude plugin test`, each `test` loads the mod afresh, as a session does, and the tests of a file run in order: `mod.live.ts`'s two sessions are two tests sharing a module-level map through `store.get` and `store.set` hooks.
- `pnpm test` still fails one test outside this ticket, as on `main`: `pack.test.ts`'s *the five reporting skills … list CONTEXT.md's Russian words* (*Mod — мод*).

For a human: whether `$.store` is shared between two live Claude Code processes is checked only in the exit demonstration (ticket 07). With two sessions of this project open and a forge, push a commit whose CI fails to `main`: within a minute one session shows the toast, the other none.

### Review

Reviewed in a sub-agent against `main`, on the standards and the spec. Every criterion holds and no finding was must-fix; `claude plugin validate` and `claude plugin test` pass on the built mod (5 tests).

- Fixed: the store's answered questions were only the newest, so a session behind by two answers toasted the first again. The store keeps the union now, at most 50 (`view.ts`), and a test pins the sequence.
- Fixed: CI unread at a session's first refresh made a failure older than the session a turn at the next refresh. CI not yet read is undefined now, and its first reading toasts nothing (`view.ts`).
- Fixed: a refresh finishing after a newer one wrote its older state back, so context pressure could toast twice. Refreshes are numbered, and a late one draws nothing (`hooks.ts`); a test holds the older answer back.
- Fixed: the module's header said the mod writes nothing; it writes `$.store`, and says so.
- Fixed: the store's record type is `Toasted`, no longer `Shown` beside the kept view `shown`.
- Fixed: the `ponytail:` on the capped list names every case it misses, and the test lists ten questions as the daemon does.
- Fixed: a local in the test shadowed the `answered` helper.
- Kept: a question whose Task closes reads as answered. Rare, and the spec words the toast as an answer.

