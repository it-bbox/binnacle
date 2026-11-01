# 13: The quick starts state the port limitation truthfully

Status: READY
Triage: ready-for-agent
Blocked by: 10
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** bring the two quick starts into line with the README's verified `BINNACLE_PORT` statement.

- [ ] `docs/quick-start.md` and `docs/quick-start.ru.md` both say that `binn daemon start` takes a non-default `BINNACLE_PORT` with autostart off.
- [ ] The explanation agrees with the README and the landing and does not promise environment propagation through an installed service.
- [ ] Both languages change together, relative links resolve, and the guide/site checks pass.

## Notes

The independent review found the unconditional promise on line 12 of both quick starts. Ticket 03 already records the daemon defect. This ticket changes copy only; it does not fix autostart, touch the owner's service or cut a release.
