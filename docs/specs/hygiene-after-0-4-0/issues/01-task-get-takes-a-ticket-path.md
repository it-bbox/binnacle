# 01: `/binnacle:task` takes a ticket's path

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`
Roles: Developer, Reviewer

**What to build:** a ticket's path works wherever a Task id does (spec, *A ticket's path as a Task id*; product inbox, *The ticket brief takes a ticket's path*). `task.get` reads a path ending in `<spec-slug>/issues/NN-<name>.md`, relative or absolute, with or without the specs directory before it, as the Task `<spec-slug>/NN`, so `/binnacle:task <ticket path>`, `task_get` through MCP and `binn call task_get` give that Task's brief. The existing forms, `<spec-slug>/<NN>`, `#<number>` and `<number>`, read as before.

- [x] Through `task.get`: a relative path, an absolute one and one without the specs directory give the Task `<spec-slug>/NN`.
- [x] A path to a ticket the tracker does not hold is `task.not_found`, naming the path.
- [x] `#3` and `3` on a remote tracker, and `<spec-slug>/6` on the local one, are unchanged.
- [x] `/binnacle:task`'s text says it takes a ticket's path as well as a Task id, and the copies match the plugin (`apps/cli/test/pack.test.ts`).

## Comments

- **For the next tickets:** `findTask` in `apps/daemon/src/task.ts` turns a path ending in `<spec-slug>/issues/NN-<name>.md`, with `/` or `\` separators, into `<spec-slug>/NN` before its existing reading, so every caller of `task.get` and `usage.get` takes a path. `/binnacle:task run`'s own conversion of a path stays, now redundant. `task_get`'s MCP description names the path too.
- **Decision:** criterion 3 is pinned by the existing tests, `#5` and `5` in `apps/daemon/test/github.test.ts` and `epic/3` in `apps/daemon/test/task.test.ts`: the same forms as `#3`, `3` and `<spec-slug>/6`, so no new test repeats them.

### Review

Reviewed against `main` in a sub-agent, on the project's standards and the ticket's spec. Every criterion holds; nothing blocks.

- `apps/daemon/src/task.ts`, `normalized`: the pattern's leading `(?:^|[/\\])` was redundant, since the leftmost match already starts at a segment. Fixed: dropped.
- `apps/daemon/src/task.ts`, `findTask`'s doc comment: one line ran past the block's width. Fixed: rewrapped.
- `apps/daemon/test/task.test.ts`: the Windows separator the pattern reads was untested. Fixed: a `\` path joins the loop.
- `/binnacle:answer` also passes its argument to `task_get`, so it takes a path now, while its text names only the Task id forms. Left: outside this ticket, which names `/binnacle:task`; a candidate for the product inbox.
