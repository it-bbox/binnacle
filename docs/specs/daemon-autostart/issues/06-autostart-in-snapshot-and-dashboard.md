# 06: Autostart in the snapshot and on the dashboard

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** a broken autostart is noticed before the next reboot (spec, *The snapshot*, *The dashboard's Settings page*). `apps/daemon/src/snapshot.ts` gains `autostart`: `{ state, platform, home, command }`, read for the daemon's own home through the service module, `command` turning it on, off or repairing it. Broken is the attention item `daemon.autostart_broken`, naming what is missing and the command; off is no attention item. `apps/dashboard/app/pages/settings.vue` shows the state and the command with a copy button, in English and Russian (`apps/dashboard/app/i18n/en.ts`, `ru.ts`), and writes nothing.

- [ ] Through `project.snapshot`: `autostart` reads on, off and broken; `daemon.autostart_broken` appears only when broken, with the command.
- [ ] The Settings page shows the state and the command to copy, with nothing to switch; checked in a browser.
