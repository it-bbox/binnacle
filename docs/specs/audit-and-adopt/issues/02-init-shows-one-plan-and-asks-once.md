# 02: binn init shows one plan and asks once

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** `binn init` works out every write it would make first, shows them together as one plan, and asks once for the whole plan (ADR-0034, which supersedes ADR-0026 in part). Enter accepts the plan when stdin is a terminal; `n` declines it and nothing is written; with stdin not a terminal nothing is written. The questions that are not about a write, the history import window and the choice of tracker, are asked before the plan, because the plan depends on them. Init still never overwrites a file, never commits, and extends a file only by a section the human has seen.

- [x] Init shows every file, and every addition to an existing file, in one plan before it writes anything, and asks once.
- [x] Enter at a terminal accepts the plan, and exactly the planned files are written.
- [x] `n` declines it, and nothing is written.
- [x] With stdin not a terminal, the plan is shown and nothing is written.
- [x] The import window and the tracker choice are asked before the plan, and the plan reflects them.
- [x] A write outside the repository, such as a user-scope harness configuration, is in the plan and covered by the same confirmation.
- [x] The existing init tests are updated to the new prompts instead of kept beside them, and a test checks the no-terminal case.
- [x] `docs/03-mcp-and-skills.md`, `docs/operations/05-installation-checklist.md` and any other doc that describes the per-write prompts are corrected in the same change.

## Comments

### Decisions

- **Terminal check.** `process.stdin.isTTY`. Tests give the child a stand-in through `apps/cli/test/terminal-shim.ts`, preloaded with `node --import`, which claims `isTTY` on the piped stdin; a real pseudo-terminal would need a native module.
- **Answers to the one question.** Enter, `y` or `yes` accepts; any other answer, and the end of input, declines. The prompt is `Write this plan? [Y/n]`.
- **No terminal.** The plan is shown and nothing is written. The import window is still asked, because it reads lines or the end of input like before, and the plan reflects it.
- **The window lands in the manifest the plan shows**, not as a second addition afterwards.
- **Outside the repository.** Project registration and the plugin install are items of the same plan, after the files, so the manifest exists when registration runs. `claude plugin list` and the tracker read are reads, not writes, and stay as they were (the tracker read runs after the plan, against the manifest as it then is).
- **A JSON file that exists** is still never rewritten: its entry is printed while the plan is being built, and the Summary says `printed`.
- **One write that fails** is reported as `failed` and the rest of the plan still runs. An append is refused if the file changed after it was read for the plan.
- **The tracker choice.** Init has had no tracker question: the tracker is proposed from the remote (or `local`) and appears in the manifest the plan shows, so the plan reflects it, and declining the plan leaves it to be edited by hand. Adding a prompt would be one more question in a change meant to ask fewer, so none was added. If the owner wants a question, such as keeping the proposal or choosing `local`, it is a small follow-up; the criterion is ticked on this reading.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes.

**Standards: no hard violation.** Findings:

1. **`window` shadowed the global and held a YAML fragment.** **Fixed**: it is `windowSection`.
2. **One failing `apply()` would end init with no Summary and skip the rest of the plan.** **Fixed**: each item is run in a try/catch and recorded as `failed`.
3. **ADR-0026 and the older specs and tickets of epic 3 still describe per-write prompts.** **Kept**: ADR-0026 already says it is superseded in part by ADR-0034, and specs and tickets are the record of what was decided then. `docs/operations/02-existing-project-adopt.md` said "after confirmation" and **was fixed**.
4. **`planFile` prints a JSON entry while building the plan.** **Kept**: nothing is written there, and the entry is what the human must add by hand.
5. **`PlanItem.declined` sits beside `apply()`.** **Kept**: it is the Summary's wording for the item, and the file is small.

**Spec:**

1. **The tracker choice is not asked.** **Kept**, see Decisions: it was never a question in init, and it is shown in the plan.
2. **An append did not check that the file was unchanged since it was read.** **Fixed**.
3. **Plan application was unguarded.** **Fixed**, as above.
4. **Registration is planned for a manifest the plan creates, and works only because the manifest item comes first.** **Kept**: it is first by construction, and a failed registration is reported.
5. **A broken manifest makes the ticket-header section take the tracker the remote proposes.** **Left**: an edge case, and the human sees the section in the plan.

Typecheck is clean, and the full suite passes: 389 of 389.
