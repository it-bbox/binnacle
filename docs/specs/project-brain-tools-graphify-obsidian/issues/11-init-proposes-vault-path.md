# 11: `binn init` proposes the vault path

Status: DONE
Triage: ready-for-agent
Blocked by: 09
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the vault path set with the same yes as the rest of the setup. When the settings file names no vault, `binn init` reads Obsidian's own list of vaults on this machine. With exactly one vault, it proposes that path in the plan as a write to the settings file, outside the repository. Otherwise it says how to set the path and names the vaults it found. A human who wants another vault declines the plan and edits the settings file, as with the tracker (ADR-0034). A path already set is reported and left alone.

- [x] With a fake Obsidian configuration listing one vault, the plan proposes it, and after a yes the settings file holds it, owner-only.
- [x] With none or several, nothing is proposed, and the output says how to set it and names those found.
- [x] A path already set is reported and not changed.
- [x] A declined plan, and a stdin that is not a terminal, write no settings file.
- [x] Nothing in the repository is written by this step.
- [x] `docs/operations/05-installation-checklist.md` says init proposes the path.

## Comments

### For the next tickets

- The step is `vaultStep` in `apps/cli/src/init.ts`, step 11. The graph step is split around it: `graphIgnoreStep` (step 10, the `.gitignore` append) and `graphBuildStep` (step 12, the build), so the plan's order is the spec's.
- `settingsPath` is exported from `@binnacle/daemon`. Init writes `{ "obsidian": { "vaultPath": "<absolute path>" } }` there, the shape the daemon's `readVault` reads, owner-only, keeping any other key the file holds.
- Obsidian's list is `obsidian.json` in Obsidian's configuration directory (`OBSIDIAN_LISTS`); the tests fake the Linux one, under `XDG_CONFIG_HOME`.

### Questions answered in the smallest way the spec allows

- **Where Obsidian keeps its list**: `obsidian.json` in its configuration directory: `$XDG_CONFIG_HOME/obsidian` (or `~/.config/obsidian`) on Linux, and its Flatpak's and Snap's copies; `~/Library/Application Support/obsidian` on macOS; `%APPDATA%\obsidian` on Windows. Its `vaults` object holds a `path` per vault.
- **What counts as a vault**: an absolute path in that list whose directory is there. Obsidian keeps a vault whose folder was moved in its list; proposing it would only be `vault.unwritable`.
- **A settings file that already exists** with other keys and no vault: the plan shows the whole new file, the old keys kept, and rewrites it owner-only; the Summary says `updated`. A file that changed since the plan was shown is not rewritten. One that is not a JSON object, or whose `obsidian` is not one, is reported and left alone: init does not guess how to merge into it.
- **"A path already set"** is any `obsidian.vaultPath` that is not null, left alone even when it is not an absolute path; init then says the daemon cannot use it.
- **None or several**: the output names the vaults found and prints the shape to put in the settings file; nothing is planned, and the Summary says `skipped`.

### Checked by a human

The tests fake Obsidian's list. On a machine where Obsidian has opened exactly one vault, in a scratch repository:

```sh
export BINNACLE_HOME=$(mktemp -d)
binn init                                   # the plan has "Set the Obsidian vault in $BINNACLE_HOME/settings.json"; confirm it
cat "$BINNACLE_HOME/settings.json"          # {"obsidian": {"vaultPath": "<that vault>"}}
stat -c %a "$BINNACLE_HOME/settings.json"   # 600
git status --porcelain                      # nothing from this step
binn init                                   # says the path is already set, and leaves it
```

With a second vault opened in Obsidian, a fresh `BINNACLE_HOME` should get both named and nothing proposed.

### Review

`/code-review` against `main`, both axes, its sub-agents in the foreground.

**Standards: no documented standard broken; judgement calls and small corrections.**

- Fixed: a rewritten settings file was reported as `extended`, which elsewhere means a pure append (ADR-0026). It is `updated` now.
- Fixed: a comment in the build still pointed at "the append above", which moved to step 10.
- Fixed: the record check duplicated `isRecord` in `history.ts`; it is shared.
- Fixed: a path already set that the daemon cannot use is said to be unusable, though still left alone; tested.
- Fixed: a listed vault must be a directory, not only exist; on Windows `APPDATA` is read, as the checklist says.
- Kept: init's read of the settings file beside the daemon's `readVault`. They differ on purpose: the daemon asks whether it can project, init whether it can merge a path into the file. A shared reader would serve neither.

**Spec: every criterion met; one doc gap and one untested order.**

- Fixed: `docs/operations/03-external-tools.md` now names the settings file and init's proposal; its vault layout is ticket 10's, kept on the rebase onto it.
- Fixed: a test checks the vault item comes after the `.gitignore` append and before the first graph.
- Kept: Obsidian's Flatpak and Snap lists are read as well as its own; they are Obsidian's own list on those installs.
- Kept: a settings file that is not a JSON object is reported, not planned over; and one that changed since the plan was shown is not rewritten, as `planFile` does for the repository.
