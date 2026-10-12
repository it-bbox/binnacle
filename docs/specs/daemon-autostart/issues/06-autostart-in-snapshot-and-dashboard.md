# 06: Autostart in the snapshot and on the dashboard

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** a broken autostart is noticed before the next reboot (spec, *The snapshot*, *The dashboard's Settings page*). `apps/daemon/src/snapshot.ts` gains `autostart`: `{ state, platform, home, command }`, read for the daemon's own home through the service module, `command` turning it on, off or repairing it. Broken is the attention item `daemon.autostart_broken`, naming what is missing and the command; off is no attention item. `apps/dashboard/app/pages/settings.vue` shows the state and the command with a copy button, in English and Russian (`apps/dashboard/app/i18n/en.ts`, `ru.ts`), and writes nothing.

- [x] Through `project.snapshot`: `autostart` reads on, off and broken; `daemon.autostart_broken` appears only when broken, with the command.
- [x] The Settings page shows the state and the command to copy, with nothing to switch; checked in a browser.

## Comments

- The snapshot reads autostart with `readAutostart`, from the definition alone, never through the service manager; `autostartCommand` in `apps/daemon/src/service.ts` gives `binn daemon autostart off` when on and `binn daemon autostart on` otherwise, which also repairs a broken one.
- Decided, as a question that blocks nothing: a definition that cannot be read, or an operating system autostart does not support, makes `autostart` `available: false` with the reason, as the snapshot's other sections do; it is no attention item.
- Decided, as a question that blocks nothing: the Settings page reads `autostart` from the selected project's snapshot and shows it in the Daemon card, with its home and platform; `command` carries no `BINNACLE_HOME=`, since the page names the home beside it.
- Checked in a browser against a temporary daemon, with a temporary `HOME`, `BINNACLE_HOME` and systemd configuration and a fake `systemctl` that was never called: off, broken (with `daemon.autostart_broken` on the Attention page) and on, in English and Russian.

### Review

Against `main`, on the standards and the spec.

1. **The off text said nothing starts the daemon at login**, in `autostartMeanings.off` (`apps/dashboard/app/i18n/en.ts`, `ru.ts`), though off is also a service installed for another home. **Fixed**: every state's text speaks of this home's daemon.
2. **`as Record<…>` casts on the state dictionaries**, unlike `ciStates` and `runOutcomes`. **Fixed**: plain literals, renamed `autostartStates` and `autostartMeanings`.
3. **`autostartSection` pushed into the caller's attention**, unlike `vaultAttention` and `limit.attention`, in `apps/daemon/src/snapshot.ts`. **Fixed**: it returns its section and its attention, spread with the others.
4. **Kept**: on macOS and Windows the snapshot reads off and offers `binn daemon autostart on`, which says not available yet; tickets 03 and 04 deliver them in this epic, and the snapshot asks no manager whether one answers, by design (ticket 01).
5. **Kept**: the CLI keeps its own `AUTOSTART_ON` and broken line, which also names the definition's path; one literal each, not worth a shared formatter.
6. **Kept**: `available: false` beyond the spec's shape, the snapshot's convention for a section that cannot be read.
7. **Kept**: the reason reads "cannot be read" where the CLI says "is unknown"; each follows its own surface's wording.
