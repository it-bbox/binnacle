# 11: `binn init` proposes the vault path

Status: READY
Triage: ready-for-agent
Blocked by: 09
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the vault path set with the same yes as the rest of the setup. When the settings file names no vault, `binn init` reads Obsidian's own list of vaults on this machine. With exactly one vault, it proposes that path in the plan as a write to the settings file, outside the repository. Otherwise it says how to set the path and names the vaults it found. A human who wants another vault declines the plan and edits the settings file, as with the tracker (ADR-0034). A path already set is reported and left alone.

- [ ] With a fake Obsidian configuration listing one vault, the plan proposes it, and after a yes the settings file holds it, owner-only.
- [ ] With none or several, nothing is proposed, and the output says how to set it and names those found.
- [ ] A path already set is reported and not changed.
- [ ] A declined plan, and a stdin that is not a terminal, write no settings file.
- [ ] Nothing in the repository is written by this step.
- [ ] `docs/operations/05-installation-checklist.md` says init proposes the path.

## Comments
