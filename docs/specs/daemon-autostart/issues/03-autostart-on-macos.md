# 03: Autostart on macOS

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** `binn daemon autostart on|off` works on macOS (spec, *The service definition*, *macOS*). The service module from ticket 01, `apps/daemon/src/service.ts`, renders a LaunchAgent property list named `binnacle` in the user's LaunchAgents directory, run at load and kept alive on an unsuccessful exit, with the same Node, daemon entry, `BINNACLE_HOME` and `PATH`; `on` loads it into the user's GUI domain, `off` removes it from there and deletes the file; start and stop go through `launchctl` as ticket 02 does for systemd where 02 has merged.

- [x] Through `binn` with the platform variable set to macOS and a fake `launchctl` on `PATH`: `on` writes the property list and loads it; `off` unloads and removes it; the state reads on, off and broken.
- [x] Repeating `on` or `off` is harmless; a refusal of `launchctl` is reported with its message.

## Comments

- The property list is `~/Library/LaunchAgents/binnacle.plist`, label `binnacle`, `RunAtLoad`, `KeepAlive` with `SuccessfulExit` false; its output goes to the home's `daemon.log`, since launchd keeps none.
- `on` and `start` load the service into `gui/<uid>`: `bootout` first when it is loaded, since launchd keeps the definition it loaded, then `bootstrap`. `off` and `stop` boot it out; `off` then removes the file. Booting out, not `launchctl kill`, is what stops it: the daemon exits 0 on SIGTERM, and a stop must not depend on how `KeepAlive` reads that.
- Decided, as a question that blocks nothing: without a GUI session of this user (`launchctl print gui/<uid>` refused, as over SSH), `on` says autostart is not available and writes nothing, as Linux does without a user manager.
- The manager's call sequences are now one table per platform in `daemon-commands.ts`, and the definition's path, rendering and reading one per platform in `service.ts`; Windows (ticket 04) adds an entry to each.
- Tested through `binn` with a fake `launchctl`, `apps/cli/test/fake-launchctl.ts`; the real `launchctl` is ticket 07's live test in CI.

### Review

Against `main`, on the standards and the spec.

1. **`on` said "already on" for a loaded service whose daemon had exited**, in `managerFor`'s `isOn` (`apps/cli/src/daemon-commands.ts`): `KeepAlive` does not restart an exit 0, and Linux checks `is-active`. **Fixed**: `isOn` reads `state = running` from `launchctl print`, which `runManager` now returns as `output`; tested.
2. **Without a GUI session, `on` wrote the property list and then failed**, against Linux's "changes nothing". **Fixed**: `unavailable` asks `launchctl print gui/<uid>`; tested.
3. **The platform switch recurred** in `definitionPath`, `renderDefinition` and `readInstalled` (`apps/daemon/src/service.ts`). **Fixed**: one `FORMATS` entry per platform, path, render and read.
4. **`{ ...current, path: current.path }` three times**, to narrow to `Service`. **Fixed**: a cast after the null check.
5. **Comma operators in `off`**. **Fixed**: plain bodies.
6. **`process.getuid?.() ?? 0`** named root's domain on a failure that cannot happen on macOS. **Fixed**: no fallback, as the test has it.
7. **No test of `start` rewriting a stale property list**. **Fixed**: added.
8. **Kept**: `start` with the daemon running rewrites the file but launchd keeps the loaded definition until the next stop and start, as ticket 02 keeps "already running" for systemd (its Review, 7).
9. **Kept**: `bootout` then `bootstrap` at once may race in launchd ("Bootstrap failed: 5"); the fake cannot show it, ticket 07's live test on a macOS runner will.
10. **Kept**: no `launchctl enable` before `bootstrap`; a service the user disabled by hand fails with launchctl's message, which `on` reports.
11. **Kept**: launchd creates `daemon.log` with the default umask; the home it sits in is owner-only.
12. **Kept**: `fake-launchctl.ts` repeats `flag`, `set_flag` and `halt` from `fake-systemctl.ts`; each fake stays one readable script.
13. **Kept**: a definition is Binnacle's when it holds the mark anywhere, not on its first line: a property list's first line is the XML declaration.
