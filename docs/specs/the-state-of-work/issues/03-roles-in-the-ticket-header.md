# 03: Roles in the ticket header, with Binnacle's suggestions

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer

**What to build:** a ticket header's `Roles:` line is read on every tracker; a ticket without it needs a Developer and a Reviewer; beside the line Binnacle suggests an Architect or Security, each with its reason, labelled as its calculation (spec, *Roles* and *Suggested roles*). `task_get`, the snapshot's Tasks in flight and ready to start, `/binnacle:task` and the Task page show them. The convention reaches `/to-tickets` through `docs/agents/issue-tracker.md` and the issue-tracker section `binn init` offers.

- [x] The header parser reads `Roles:` on the local and the remote tracker; roles are matched case-insensitively against the baseline's vocabulary and written in its form; another word is `task.unknown_role` and left out.
- [x] A Task's roles are `{ required, source: 'ticket' | 'default', suggested }`, `default` being Developer and Reviewer.
- [x] Architect is suggested at 8 or more touched modules of the graph, naming how many; Security when a touched path or the ticket's text holds one of the spec's words, naming what matched; a role the line names is not suggested; without a graph, only Security from the text. Daemon tests over a graph fixture cover each.
- [x] `task_get` and the snapshot's Task items carry the roles; `/binnacle:task` and `/binnacle:product` present them, suggestions marked as Binnacle's calculation.
- [x] The Task page shows the required roles and the suggestions, labelled as calculated; strings in English and Russian; checked in a browser.
- [x] The issue-tracker section `binn init` offers to add describes `Roles:` and the Question and Answer headings, as `docs/agents/issue-tracker.md` does; `init.test.ts` covers it.

## Comments

- **Where it lives.** The vocabulary and the header's `Roles:` line are read in `packages/core/src/tracker.ts` (`ROLES`, `headerRoles`), which both tracker adapters call, so `task.unknown_role` is a tracker diagnostic and reaches the snapshot's attention. The suggestions are `taskRoles` in `packages/core/src/impact.ts`, beside the conflict risk and from the same touched modules: the snapshot reads them from its `impact`, and `task.get` from an `impact` over the one Task, against the same graph. The issue-tracker section `binn init` offers is `ticketHeaderSection` in `apps/cli/src/init.ts`.
- **Decided here, where the spec does not say:**
  - **A `Roles:` line that names no role of the vocabulary**, empty or only unknown words, needs the default roles, `source: 'default'`, with a `task.unknown_role` for each word: a Task that needs nobody is not a reading of the ticket.
  - **A role named twice counts once**, in the order written.
  - **Security's words also match in the plural** (`tokens`, `secrets`, `permissions`), the way tickets write them, and `.env` matches as a path segment or a word followed by a dot, so `.env.local` and `.env.example` match too.
  - **A suggestion's reason is the daemon's English**, shown on the Task page with `lang="en"`, as a diagnostic's message is; the labels around it are in both languages.
- **Test-first, as read here.** `apps/daemon/test/roles.test.ts` drives the snapshot and `task.get` against a repository with a nine-module `graph.json` and a fake `graphify`, as `impact.test.ts` does; `github.test.ts` covers the line on a remote tracker, whose parser GitLab shares; `init.test.ts` the section on the local and the remote tracker.
- **Verified in a browser.** The generated dashboard ran against a daemon on a temporary `BINNACLE_HOME` under this worktree's `.scratch/`, with `BINNACLE_PORT=0`, and a scratch repository there with two tickets: one without `Roles:` whose text names an OAuth token in the credentials file, one with `Roles: Developer, reviewer, QA`. The first read "Developer, Reviewer (the default: the ticket has no Roles: line)", then "Binnacle suggests Security", badged calculated, with its reason naming `token`, `credential` and `oauth` in the ticket's text; the second read "Developer, Reviewer, QA" with no suggestion. The same in Russian: «Роли», «по умолчанию: в тикете нет строки Roles:», «Binnacle предлагает», «расчёт». The daemon was stopped, and the owner's daemon was not touched.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violation in the code.** Findings, the code's all judgement calls:

1. **The ticket is still `READY`, its criteria unticked.** **Kept**: the order of commits the workflow sets, which the commits after this one complete.
2. **Speculative Generality**: `DEFAULT_ROLES` and `ARCHITECT_MODULES` are exported from `impact.ts` and used nowhere else, and `DEFAULT_ROLES` has no JSDoc. **Fixed**: neither is exported, and both are documented.
3. **Divergent Change**: `impact.ts` now holds the conflict risk and the suggested roles. **Kept**: the spec computes the suggestions "beside the conflict risk, from the same touched modules (`impact`)".
4. **Duplicated Code**: `task.get` repeats the snapshot's graph-then-impact reading, with the inline `provider !== 'local'`. **Kept**: two calls, written as the snapshot writes them so that both suggest the same; `isRemoteTracker` reads a manifest-less project the other way, and a shared helper would be a third name for two lines.
5. **`byId.get(task.id)!` in the snapshot**, getting back the Task its section items left out. **Kept**: the impact is read from the sections' Tasks, so the roles can only be computed after them.
6. **A suggestion's reason stays English on the Russian page**, where the conflict risk's reasons are rewritten in Russian. **Kept**: the reason is daemon text, shown with `lang="en"` as diagnostics are; rewriting it would need the suggestions in structured parts the spec does not ask for, and the redesign of epic 16 restyles the page.
7. **The page spells the roles' type by hand.** **Kept**: the page's `Brief` is local throughout.
8. **`ROLES.join(', ').replace(...)`** to write "…, DevOps and Analyst". **Kept**: one line, and `Intl.ListFormat` adds the serial comma the repository's docs do not write.

**Spec: every criterion holds.** Findings:

9. **Whether the Task page was checked in a browser does not show.** **Fixed**: recorded under *Comments*, in the Review's own commit.
10. **GitLab has no test of its own for `Roles:`.** **Kept**: GitHub and GitLab issues become Tasks through the one `toTask` in `remote-tracker.ts`, which `github.test.ts` covers.
11. **`task.unknown_role` reaches the snapshot's attention, not the brief's `diagnostics`.** **Kept**: the spec asks for a diagnostic, and the tracker's diagnostics are the snapshot's; the brief's are its own Task's branch.
12. **The Security words match in the plural**, which the spec and `docs/03-mcp-and-skills.md` do not say. **Fixed**: kept in the code, as decided under *Comments*, and written into `docs/03-mcp-and-skills.md`, with `.env.local`.
13. **A line of only unknown words gives the default roles**, which the spec does not say, and no test pins it. **Fixed**: `roles.test.ts` pins it, with its `task.unknown_role`; the decision is under *Comments*.
14. **`.env` also matches `.env.local` and `.env.example`.** **Kept**: they are environment files, which is what the word is there for; decided under *Comments*.
