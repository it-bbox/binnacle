# 13: The quick starts state the port limitation truthfully

Status: DONE
Triage: ready-for-agent
Blocked by: 10
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** bring the two quick starts into line with the README's verified `BINNACLE_PORT` statement.

- [x] `docs/quick-start.md` and `docs/quick-start.ru.md` both say that `binn daemon start` takes a non-default `BINNACLE_PORT` with autostart off.
- [x] The explanation agrees with the README and the landing and does not promise environment propagation through an installed service.
- [x] Both languages change together, relative links resolve, and the guide/site checks pass.

## Notes

The independent review found the unconditional promise on line 12 of both quick starts. Ticket 03 already records the daemon defect. This ticket changes copy only; it does not fix autostart, touch the owner's service or cut a release.

## Comments

### Decision

Use the README's verified autostart-off qualification in both quick starts. The service environment defect remains outside this copy-only ticket; no daemon, autostart setting or dependency was changed.

### Review

Independent review against `main` covered the project standards and this ticket's specification. No findings requiring fixes. Kept the paired copy change: both languages match the README and landing, and neither promises environment propagation through an installed service. Kept the regression check: all six pages must mention `BINNACLE_PORT` with their language's autostart-off condition; every matching line is checked. No runtime changes or new dependencies.

### Verification

- Test-first: the new check failed on the English quick start's unconditional port claim before the copy change, then passed for all six pages.
- `pnpm typecheck`: passed.
- `LANGUAGE=C pnpm test`: 1007 tests, 1006 passed, 0 failed, 1 skipped (the machine has no non-loopback IPv4 address). This includes the user-guide checks and the site build, routes and relative-link checks.
- `git diff --check main...HEAD`: passed.
- No daemon was started and no service was touched.
