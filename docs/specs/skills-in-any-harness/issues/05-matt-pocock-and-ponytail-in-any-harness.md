# 05: Matt Pocock Skills and Ponytail reach the same harnesses

Status: READY
Triage: ready-for-agent
Blocked by: 04
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** the skills step installs Matt Pocock Skills and Ponytail into the harnesses Binnacle's skills go to, from their repositories, through the same `npx skills add -g -y` and then `npx skills remove -g -a claude-code`, since Claude Code keeps both as plugins (spec, *Matt Pocock Skills and Ponytail*). A set the manifest declares false is left out of every harness, as it is left out of Claude Code. The Summary's line that pointed other harnesses at where each set is had goes away.

- [ ] Tests with the fake `npx`: each set's add and removal, in order, beside Binnacle's; a set declared false is not planned.
- [ ] Without a harness detected, without `npx`, and on a failed call, both sets behave as Binnacle's do.
