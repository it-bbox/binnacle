# 06: Stale skills are reported and reinstalled

Status: READY
Triage: ready-for-agent
Blocked by: 04
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** installed Binnacle skills are read from `~/.agents/skills/binnacle-*`, where the `skills` CLI keeps canonical copies (spec, *Freshness*). A set where any skill's `metadata` version differs from the package copy's, or where some skills are missing while others are present, is stale. `binn audit` reports it as one finding, with a code in the group its other tool and harness findings use; a current set or none at all is not reported. `binn init`'s skills step plans the add for a stale set and nothing for a current one, and says which.

- [ ] Audit tests in a temporary home: stale version, partly missing set, current set, no set.
- [ ] Init tests with the fake `npx`: a current set plans no Binnacle add and says it is current; a stale one plans it.
