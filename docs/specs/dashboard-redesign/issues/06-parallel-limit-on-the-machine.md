# 06: The Parallel limit on the machine

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/dashboard-redesign/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** the Parallel limit (`CONTEXT.md`) lives in the machine's settings and the Settings page edits it (spec, *The Parallel limit on the machine*, *One write, through the daemon*; ADR-0041). The settings file holds a positive integer or `auto`, 2 when unset; a project manifest's `automation.max_parallel_development_tasks` still wins for its project. The snapshot's `tasks.parallel` gives the limit with its mode, `number` or `auto`, and its source, `manifest`, `machine` or `default`; with `auto` its limit is the ceiling, 4. Two operations over the daemon's authenticated API read and set it; the set keeps every other key of the file and refuses a bad value with a reason. Autopilot reads the limit from the snapshot: with `auto` it starts every ready Task whose pairs with every Task in flight are at low conflict risk, up to 4, and one at a time when the risk is not assessed; without Binnacle, the manifest's value or two.

- [x] Through the daemon's HTTP API: the limit read from a temporary home's settings with its source; a manifest's value winning; `auto` with its ceiling; the set writing the limit, keeping `obsidian.vaultPath`, and refusing zero, a negative, a fraction, a value over the bound and any other string.
- [x] The set needs the daemon's token, as every operation does, and no MCP tool writes the limit.
- [x] The snapshot's `tasks.parallel` carries the mode and the source; `docs/03-mcp-and-skills.md` says so.
- [x] The Settings page edits the limit, a number or *auto*, says when a manifest overrides it, and shows the daemon's reason for a refused value; it writes nothing else.
- [x] Autopilot's skill reads the limit from the snapshot by the rule above.
- [x] `docs/04-telemetry-dashboard.md`'s Settings section says the page writes the Parallel limit and nothing else.
- [x] Checked in a browser: setting a number, *auto*, and a refused value, in English and Russian.

## Comments

The limit is `parallelLimit` in the Binnacle home's `settings.json`, read on every snapshot by `apps/daemon/src/settings.ts`; `parallel.get` and `parallel.set` are the two operations, in `operations.ts`, with no MCP tool. The snapshot's `tasks.parallel` gains `mode` and `source`; a value in the file Binnacle cannot use falls back to 2 with the attention item `parallel_limit.invalid`, and a set against a file that is not a JSON object is refused with `settings.unreadable`, so nothing it holds is lost. Ticket 07 adds the informer to `parallel.get`'s answer.

Answered without the owner, as the spec allows:

- The bound is 16: the spec says "up to a bound" and names none; the manifest has none, and *auto* stops at 4.
- Under *auto* with no graph, `free` counts from one, so the Suggested step offers no second Task where autopilot would run one at a time.
- This repository's own manifest no longer sets `max_parallel_development_tasks: 2`, which equalled the default and would have won over the machine's value, against the epic's exit criterion that the limit set on the page is the one the snapshot gives.
- A refused value's reason is shown in English with its code, as every daemon error on the page is.

Checked in a browser against a temporary daemon with this worktree registered: a number (3, then 5), *auto*, and 0 and 17 refused with the daemon's reason, in Russian and English, light and dark; the override note while the manifest still set 2, gone once it did not; the snapshot then giving 5 from `machine`; `settings.json` keeping `obsidian.vaultPath`, owner-only.

### Review

`mattpocock-skills:code-review` ran against `main` on both axes, with a Security review beside them, its sub-agents in the foreground.

**Standards.** To fix:

1. **`docs/04-telemetry-dashboard.md` still said the dashboard's only action is copying a command** **Fixed** in d9c1dff: the read-only section names the Settings page's one write (ADR-0041).
2. **ADR-0020 still said Binnacle writes only its registry and store** **Fixed** in d9c1dff: its status line names ADR-0041's one key of the settings file.
3. **The Russian note said "Tasks"** where the dictionary says "Task" **Fixed** in d9c1dff.
4. **`PARALLEL_LIMIT` named a default** **Fixed** in d9c1dff: `DEFAULT_PARALLEL_LIMIT`.

Kept:

5. `readSettings` beside `vault.ts`'s `readVault`: the vault reports its own reasons; one reader would change the vault's attention for nothing this ticket needs.
6. The temporary-file write repeated from `registry.ts` and `vault.ts`: three lines, each with its own file.
7. 4 and 16 written in the dictionaries, the skill and the docs: prose, as every limit in them is.
8. `parallelNow`'s literal types beside the page's `ParallelLimit`: the dictionaries import nothing from the page, as the i18n test runs them alone.

**Spec.** To fix:

9. **Under *auto* without a graph the Suggested step offered a parallel Task** (`snapshot.ts`, `withStartAndParallel`): CONTEXT.md runs *auto* one at a time when the risk cannot be assessed. **Fixed** in d9c1dff: `free` counts from one then, pinned in `parallel-limit.test.ts`.
10. **The manifest row read "not written: 4 is used" under *auto*** (`settings.vue`) **Fixed** in d9c1dff: it reads "auto, up to 4" through `limitValue`.
11. **The ticket said READY** **Fixed** in this commit and the next.

Kept:

12. The `parallel_limit.invalid` attention and the `settings.unreadable` refusal: beyond the spec's "refuses with a reason", kept as they prevent a silent fallback and a lost settings file.

#### Security

The set needs the token (pinned with none and a wrong one), Host and Origin are checked before it, no MCP tool reaches it, the value is checked at the boundary, a refused string is never quoted back, and the page renders daemon text without `v-html`. To fix:

13. **A leftover or linked `settings.json.tmp` could set the file's mode or target** (`settings.ts`, `setParallelLimit`) **Fixed** in d9c1dff: it is removed first and created with `wx`.

Kept:

14. A `binn init` writing the vault at the same instant can lose one of the two changes: the daemon's write is one synchronous step; a `ponytail:` comment names the lock file as the upgrade.
15. A linked `settings.json` becomes a plain file on a set: the home is the owner's, mode 0700, and the file is documented as a plain one.
16. Any process of the same user can read the token and call the set, or edit the file: the token's owner-only file is the boundary ADR-0031 keeps, unchanged.
