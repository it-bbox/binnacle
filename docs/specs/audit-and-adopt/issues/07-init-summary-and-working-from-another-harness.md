# 07: binn init's Summary, and working from another harness

Status: READY
Triage: ready-for-agent
Blocked by: 02, 03
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** the owner's finding of 2026-09-27 that continuing in another harness is not discoverable, and the link between the two commands. `binn init`'s Summary suggests `binn audit`, and for a harness it detected other than Claude Code, prints the exact next step for it, including the prompt that makes an agent read the Binnacle skill and follow it. The audit's recommendations name `binn init` for each Binnacle file that is missing. The README, and `README.ru.md` in the same change, gain a section on working from another harness: Codex reads a project's `.codex/config.toml` only in a trusted project, the Codex desktop app ships its CLI outside `PATH`, and GLM is a model reached through a harness such as Claude Code or opencode. No skill format for another harness is added.

- [ ] Init's Summary suggests `binn audit`.
- [ ] With Codex or another non-Claude-Code harness detected, the Summary prints the next step for it, with the prompt that makes an agent follow the Binnacle skill.
- [ ] An audit gap for a missing Binnacle file recommends `binn init`.
- [ ] `README.md` has the section, and `README.ru.md` carries the same one.
- [ ] A test checks the Summary lines for a detected non-Claude-Code harness, and the README is read in review.
