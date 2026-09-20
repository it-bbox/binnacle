# 05: Projections rebuild on schema change

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/core-and-persistence/spec.md`

**What to build:** a user upgrades Binnacle without reading a changelog, and nothing is asked of them and nothing of theirs is lost. The projections are dropped and re-derived; the registry and the history survive. This is the ADR-0015 rule executed while the only thing at stake is a project row — deliberately before there is telemetry to lose.

- [ ] Starting a daemon whose stored schema version differs from the running one drops and re-derives the projections.
- [ ] The registry file and the event history survive untouched.
- [ ] Every previously registered project is listed after a rebuild, with manifest facts re-read from each repository.
- [ ] The rebuild is recorded as an event, so "rebuilt" is distinguishable from "lost".
- [ ] A rebuild needs no command from the user and no migration step.
- [ ] A repository that has disappeared from disk since registration is reported with a reason rather than dropping the registration.
