# 05: /binnacle:status

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** the baseline's `/status`, as `/binnacle:status`, over the existing `project_status` tool. It gives the project, the manifest's tracker, this session's checkout (registered, or a linked worktree, said plainly), its branch, commit and dirty state, and the diagnostics. On `daemon.unreachable` or `project.not_registered` it names `/binnacle:daemon start` or `/binnacle:register`. It stays short: the roadmap, Tasks and usage are `/binnacle:product`'s. No new tool and no new daemon operation.

- [x] The skill exists in the `binnacle` plugin with `disable-model-invocation: true`, and calls `project_status` and nothing else.
- [x] A test in `apps/cli/test/pack.test.ts` holds its wording: the linked-worktree line, the diagnostics, and the two fixes.
- [x] The plugin's description and `docs/03-mcp-and-skills.md` name `/binnacle:status`.

## Comments

- **No `argument-hint`.** The spec gives each new skill one, but `/binnacle:status` takes no argument: `project_status` has no input and reads this session's checkout. A hint would advertise an argument that does nothing, so the skill has none.
- **The two fixes are held with the other daemon-dependent skills.** `status` joins the list in the `pack.test.ts` test that checks `/binnacle:daemon start` and `/binnacle:register` beside the `binn` command, rather than repeating those assertions in its own test.
- **`/status` no longer promises run status.** `docs/03-mcp-and-skills.md` listed it as "project/session/run status". `project_status` has no runs, and the runs belong to the snapshot, so the entry now says what the skill gives and leaves the rest to `/product`, as story 39 asks.

### Review

Code review against `main`, both axes.

- **Fixed.** A null `git.commit`, in a repository with no commits yet, had no wording. That is the exit demonstration's fresh repository. Both axes raised it. The skill now says "no commits yet", and `pack.test.ts` holds that wording.
- **Fixed.** `project.id` and `project.name` are null when the manifest cannot be read, and the skill still asked for both. Both axes raised it. It now names them only when they are set.
- **Fixed.** `checkout.registered` is true for anything that is not a detected linked worktree, including a nested repository and a checkout where Git cannot tell. The skill called that "the registered checkout"; it now says "not a linked worktree of the project".
- **Fixed.** The fallback line said `git status` and the manifest "give the same facts". They do not give the worktree fact or the diagnostics, so it now says they give the Git and tracker facts.
- **Fixed.** The test's comment promised a check that nothing made. It now says where the two fixes are held.
- **Kept.** Adding a skill touches `plugin.json`, the marketplace listing, `docs/03` and `pack.test.ts`. Each one lists the skills for a different reader.
- **Kept.** "run" is dropped from `/status` in `docs/03`, as noted above.
- **Left.** `plugin.json` names each action, but the marketplace listing groups them. This predates the ticket, and ticket 04's review left it too.
