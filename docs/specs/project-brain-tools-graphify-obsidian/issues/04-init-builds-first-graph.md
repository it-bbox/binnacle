# 04: `binn init` ignores the graph and builds the first one

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** a project that leaves `binn init` with a graph. In the one plan, after the installs: an append to `.gitignore` for Graphify's output directory, unless Git already ignores it, then the first graph build with Graphify's code-only extraction, which needs no API key and calls no model (ADR-0012). The build runs only when Graphify is installed or was just installed by the plan, and the capability is not `false`. A failed build is reported in the Summary with Graphify's reason, and the daemon builds it later (ticket 05).

- [x] Without the output directory ignored, the plan appends it to `.gitignore`, under ADR-0026's append rule.
- [x] With it already ignored, `.gitignore` is not touched.
- [x] After a yes, the fake `graphify` is called with the code-only extraction in the repository root, after the installs.
- [x] A failing fake is reported in the Summary with its reason, and the rest of the plan has run.
- [x] Graphify declared `false`, or left out for a missing `uv`, means no `.gitignore` line and no build.
- [x] `docs/operations/03-external-tools.md` says init builds the first graph, code-only.

## Comments

### For the next tickets

- The step is `graphStep` in `apps/cli/src/init.ts`, step 10, called after `serversStep`. It plans the `.gitignore` append through `planFile`, then the build: the last two items of the plan. Ticket 11's vault setting goes between them, in the order the spec gives the plan: plan it after the `planFile` call and before the build's `session.plan.push`, or split the step.
- Init and the daemon share `GRAPH_DIRECTORY`, `GRAPH_FILE`, `GRAPH_EXTRACT` and `GRAPH_RUN_TIMEOUT_MS`, all exported from `@binnacle/daemon`. Init asks Git whether `graphify-out/graph.json` is ignored, as the daemon does, through the adapters' `isIgnored`.
- Init records no `graph.built` event, so the daemon still builds once at its first poll after registration (ticket 05's decision).

### Questions answered in the smallest way the spec allows

- **"Installed or was just installed by the plan"** is Graphify's state `found` or `install` in the tool table. When the build's turn comes, `graphify` must be on PATH. If it is not, because its install failed or `uv` put it in a directory that is not on PATH, the build is `skipped` with that reason, not `failed` with `ENOENT`.
- **Graphify's reason** is the last line it wrote to stderr, as the daemon reads it, or else its exit code. Its whole stderr is shown after the run, and its stdout as it comes.
- **Not ignored at build time**: if Git still does not ignore `graphify-out/` when the build's turn comes (the append failed because `.gitignore` changed after the plan was shown), the build is skipped, since Graphify would leave untracked files (ADR-0036).
- **A Git that cannot say** whether the directory is ignored gets the append; a duplicate line in `.gitignore` does no harm.
- **The `.gitignore` line** is `graphify-out/`, with no comment.
- The build has the daemon's ten-minute ceiling for one run.

### Checked by a human

Only the fakes are checked. On a machine with `uv`, in a scratch repository with some source code and no `graphify-out/` in `.gitignore`:

```sh
BINNACLE_HOME=$(mktemp -d) binn init     # confirm the plan; its last two items are the .gitignore append and the build
tail -1 .gitignore                        # graphify-out/
ls graphify-out/graph.json                # the first graph
git status --porcelain                    # no graphify-out/ in it
```

Then, with `capabilities.graphify: false` in the manifest, a second `binn init` should propose neither item.

### Review

`/code-review` against `main`, both axes, its sub-agents in the foreground, after rebasing onto `main` (ticket 09 merged meanwhile).

**Standards: no documented standard broken; four judgement calls.**

- Fixed: the ignore check spelled out `graphify-out/graph.json` again; it reads the daemon's `GRAPH_FILE`, now exported.
- Fixed: the build had no time limit, so a hung Graphify would hang init. It now has the daemon's `GRAPH_RUN_TIMEOUT_MS`.
- Fixed: `ignored`, a check that runs twice, is now `isGraphIgnored`.
- Kept: the failure reason (stderr's last line, else the exit code) is written in both init and the daemon. It is two lines in each, one synchronous and one streaming; sharing it would need a helper both bend to fit.

**Spec: every criterion met; one partial path.**

- Fixed: when the plan's Graphify install failed, the build still ran and failed with `spawnSync graphify ENOENT`. It is now skipped, the Summary says `graphify` is not on PATH, and a test covers it.
- Kept: the check at build time that Git ignores the directory. The ticket does not ask for it, but ADR-0036 gives the reason, and the docs describe it.
- Kept: the README, `README.ru.md` and the installation checklist describe the step, beyond the `03-external-tools.md` the ticket names.
