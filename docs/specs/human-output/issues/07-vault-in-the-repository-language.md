# 07: The vault in the repository language

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/human-output/spec.md`

**What to build:** the vault's own words follow the repository (spec, *The vault's own words in the repository language*). The daemon reads `knowledge.language` from the manifest it already reads, and writes the snapshot's and the daily's notes, their headings and generated lines, in it, with the spec's Russian terms. Notes copied from the repository are unchanged, and the generated marker, `generated-by: binnacle`, stays as it is. The autostart service's environment does not change. `docs/03-mcp-and-skills.md` and `docs/operations/05-installation-checklist.md` with its twin say so where they describe the projection.

- [ ] Through the daemon's vault tests: a Russian repository's snapshot and daily notes in Russian, an English one's as today.
- [ ] The generated marker is the same in both, and a note the human wrote is never touched.
