# 03: binn in the person's language

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/human-output/spec.md`

**What to build:** `binn` speaks the system locale's language (spec, *The person's language*, *`binn`'s own text*). One function reads `LC_ALL`, then `LANG`, once per run: Russian when the value starts with `ru`, English otherwise, `C` and unset included. The usage and `binn call --help`'s prose, `binn daemon` (start, status, stop, autostart), `binn project` (register, list, status, unregister) and `binn dashboard` are worded from a CLI dictionary in that language, with the Russian terms of the spec. Errors and warnings print their sentence without their code, from core's wording and `params` (ticket 02), the daemon's English marked when there is none; the exit codes do not change. `binn mcp`, `binn call`'s output and every `--json` are untouched. `binn init` and `binn audit` are tickets 05 and 04.

- [ ] Through the `binn` process: Russian under `ru_RU.UTF-8`, English under `C`, unset and `en_US.UTF-8`, and `LC_ALL` over `LANG`.
- [ ] No error or attention code in the text of these commands; the exit codes as before.
- [ ] `binn call` and every `--json` byte-for-byte the same under either locale.
- [ ] The existing tests that read English text set the locale they read.
