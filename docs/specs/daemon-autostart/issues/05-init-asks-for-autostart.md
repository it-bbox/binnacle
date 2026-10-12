# 05: binn init asks for autostart

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** a new user is not left without autostart (spec, *`binn init`*). `apps/cli/src/init.ts` asks, after the import window and before the plan, "Start the daemon at login? [Y/n]" when autostart is off for the home it uses; yes turns it on at the end of the run, as an item of the one plan it shows (ADR-0034). Without a terminal, and under `--yes`, it installs nothing and its summary names `binn daemon autostart on`. With autostart on it asks nothing; a later run offers it again while it is off. The docs stop saying autostart is not part of v1: `README.md` and `README.ru.md`, `docs/01-architecture.md`, `docs/08-open-questions.md` and `docs/operations/05-installation-checklist.md` say that `binn init` sets it up and name `binn daemon autostart` (ADR-0043).

- [ ] Through init's plan and writes, as `init.test.ts` drives init, with a fake `systemctl`: the question's default is yes and its plan item turns autostart on; no turns nothing on and the summary names the command.
- [ ] Without a terminal and under `--yes`, nothing is installed and the summary says so; with autostart on, nothing is asked.
- [ ] The five documents above no longer say autostart is out of v1, and both READMEs say the same.
