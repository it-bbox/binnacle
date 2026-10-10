# 10: Attention that matches the work

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer

**What to build:** two attention items corrected (spec, *The stale Next action* and *`review.missing`*). A Next action of `/binnacle:autopilot` or `binnacle-autopilot` naming an epic, by number or spec slug, whose spec has tickets and none left for an agent — every Task `DONE`, `CANCELLED` or `ready-for-human` — is `next_action.stale`, saying why. A `DONE` Task whose `Triage:` is `ready-for-human` is not `review.missing`. Both items leave `docs/product-inbox.md` with this spec.

- [ ] Tests as `next.test.ts` sets up a roadmap: stale by number and by slug; not stale while one Task is left for an agent, one with an unanswered question included; not stale for an epic with no tickets; the existing `DONE`-Task rule unchanged.
- [ ] Tests as `snapshot.test.ts`: a `DONE` `ready-for-human` ticket without a Review raises nothing; a `DONE` `ready-for-agent` one still does.
- [ ] On this repository, `project_snapshot` no longer raises `review.missing` for `skills-in-any-harness/08` and `telemetry-for-any-harness/15`.

## Comments

- **Where it lives.** The stale epic is read in `nextActionAttention` (`packages/core/src/roadmap.ts`), beside the existing rule for a finished Task; `review.missing` in `readState` (`apps/daemon/src/snapshot.ts`).
- **Decided here, where the spec does not say:**
  - **The command is autopilot when its first word is `/binnacle:autopilot` or `binnacle-autopilot`**, the latter with or without the `$` or `/` another harness writes before a skill's name; **its epic is the second word**, matched exactly against an epic's number or spec slug, as autopilot's `argument-hint` (`[epic number or spec slug]`) and this repository's roadmap write it. `/binnacle:autopilot` with no epic is not checked: which epic it runs depends on the roadmap at the time, and the spec asks only for a named one.
  - **The message says why**: the epic, that no ticket of its spec is left for an agent, and which of them are `ready-for-human`.
  - **The dashboard's warning for `next_action.stale`** said "names a Task already Done", which the new reason makes untrue; it now names finished work or an epic with no ticket left for an agent, in English and Russian.
- **The product inbox.** Both items, "A Next action nobody moves" and the demonstration flagged for a Review it cannot have, already left `docs/product-inbox.md` in the spec's own commit (682978c), so this ticket changes nothing there.
- **Criterion 3, verified.** A daemon on a temporary `BINNACLE_HOME` under this worktree's `.scratch/` (ignored by Git), started with `BINNACLE_PORT=0`, registered this worktree; `binn call project_snapshot` raised no `review.missing`, though `skills-in-any-harness/08` and `telemetry-for-any-harness/15` are `DONE` and record no Review, and no `next_action.stale` for `/binnacle:autopilot 11`, whose epic still has tickets for an agent. The daemon was stopped; the owner's was not touched.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** The documentation is in English, the dashboard's string changed in both languages, and nothing new was abstracted. Findings, all judgement calls:

1. **Duplicated Code**: the new `finished` in `nextActionAttention` repeats the one in `roadmapAttention`. **To fix**: one module-level `finished` for both.
2. **Primitive Obsession / Shotgun Surgery**: `'ready-for-human'` is compared in five places across `roadmap.ts` and `snapshot.ts`, two of them new. **Kept**: one string comparison each, against the canonical label `docs/agents/triage-labels.md` fixes verbatim; a shared predicate would move code this ticket does not otherwise touch.
3. **`epic!` three times**: the check on `own.length` loses the narrowing of `epic`. **To fix**: test `epic` itself, so that no `!` is needed.
4. **The test of an unanswered question does not show the question is read**: the Task is `ACTIVE`, so it is left for an agent whatever its comments say. **To fix**: the test asserts the snapshot counts the question unanswered, so that the fixture is known to hold one.
5. **`docs/specs/dashboard-design-and-languages/design-brief.md` still quotes the old warning**, "The Next action names a Task already DONE". **Kept**: a closed epic's brief is a record of what was designed then, not a description of the dashboard now.

**Spec: every criterion is implemented; the inbox items had already left with the spec.** Findings:

6. **Criteria unticked and `Status: READY`**. **Kept**: the process ticks them and sets `DONE` in the ticket's last commit, after the fixes.
7. **The unanswered-question case passes whatever the question**: the same as 4. **To fix** with 4.
8. **`$binnacle-autopilot` and `/binnacle-autopilot` are accepted beyond the spec's two forms, untested.** **To fix**: kept, since another harness writes its skill's name with such a prefix, and a test pins `$binnacle-autopilot`.
9. **Both reasons at once give two `next_action.stale` items**, which the dashboard's What's next lists keyed by code, so the key repeats. **To fix**: one item, its message giving both reasons.
10. **`02`, `#2` or `epic 2` is not read as an epic**, so such a Next action is never found stale. **Kept**: autopilot's argument is an epic number or spec slug, as its `argument-hint` and the roadmap write it; matching other spellings nobody writes is speculative, and the code says where to widen it if one appears.
