# 03: binn in the person's language

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/human-output/spec.md`

**What to build:** `binn` speaks the system locale's language (spec, *The person's language*, *`binn`'s own text*). One function reads `LC_ALL`, then `LANG`, once per run: Russian when the value starts with `ru`, English otherwise, `C` and unset included. The usage and `binn call --help`'s prose, `binn daemon` (start, status, stop, autostart), `binn project` (register, list, status, unregister) and `binn dashboard` are worded from a CLI dictionary in that language, with the Russian terms of the spec. Errors and warnings print their sentence without their code, from core's wording and `params` (ticket 02), the daemon's English marked when there is none; the exit codes do not change. `binn mcp`, `binn call`'s output and every `--json` are untouched. `binn init` and `binn audit` are tickets 05 and 04.

- [x] Through the `binn` process: Russian under `ru_RU.UTF-8`, English under `C`, unset and `en_US.UTF-8`, and `LC_ALL` over `LANG`.
- [x] No error or attention code in the text of these commands; the exit codes as before.
- [x] `binn call` and every `--json` byte-for-byte the same under either locale.
- [x] The existing tests that read English text set the locale they read.

## Comments

### Decisions

- **The dictionary is `apps/cli/src/text.ts`**: `T`, the person's language's text, chosen once per run from `LANGUAGE`, which `apps/cli/src/language.ts` reads once with `personLanguage()` and `proposeLanguage()` now uses too. `say()` words a coded message by core's `wordMessage`; `marked()` marks the daemon's English, or a library's uncoded error, with « (англ.)» in Russian and nothing in English.
- **The CLI's own codes** are worded by the dictionary, not by core: `daemon.unreachable` (`DaemonUnreachableError` now keeps its `address`) and `auth.missing` from `requireToken()`, now a `TokenMissingError` keeping the home. `binn mcp` and `binn call` receive the same code and English message as before, so their output does not change.
- **Codes left the usage too**: `--apply`'s line no longer names `init.plan_changed`, and `binn call --help` says "an error envelope" for exit 4 and that its JSON is English whatever the locale; the usage gains an `LC_ALL, LANG` line under *Environment*.
- **A report's labels** are padded to the language's longest label, so English keeps its columns and Russian its own; a registration's `since` is «добавлен», a daemon's «запущен».
- **Uncoded text stays as written**: the registry's `unavailable` reason (marked English), a service manager's or the system's error text, and `binn call`'s refusals, which are its output.
- **The guides**: `docs/operations/05-installation-checklist.md` and its twin say, under *Environment variables*, how `binn` picks its language.

### For the next tickets

- `binn init` (ticket 05) calls `register()` and `autostart()`, which now print in the person's language inside init's English: its dialogue takes `T`, `say` and `row` from `text.ts`. The tests that drive `binn init` and `binn audit` run with `LC_ALL=C` in their base environment; a test of Russian output sets its own locale over it, as `locale.test.ts` does.
- `apps/cli/test/locale.test.ts` checks no code reaches a person's text against `WORDED_CODES` and `daemon.unreachable`; tickets 04 and 05 can run their commands through the same `assertNoCode`.

### Review

A Reviewer sub-agent ran against `main`, on both axes. Typecheck is clean; every criterion holds after the fixes below; no new dependency, nothing outside the ticket, and `binn mcp`'s and `binn call`'s envelopes are byte-for-byte as on `main`.

**Standards:** nothing to fix.

**Spec:**

1. **`apps/cli/test/tarball.live.ts` read `binn daemon status`'s English without setting a locale**, so it failed under a Russian one. **Fixed**: its environment sets `LC_ALL=C`, as the other tests do.
2. **No test ran `binn daemon autostart` under a Russian locale.** **Fixed**: `apps/cli/test/autostart.test.ts` drives the state, `on` with its token warning, `on` again and `off` under `ru_RU.UTF-8`, with no code in the text.
3. **`binn call --help` gained an English sentence not recorded.** **Fixed**: recorded under *Decisions*; it stays, since a person reading the help in Russian should know the JSON is not.
4. **Russian wording**: «не ответил на …» became «не ответил по адресу …»; «демон, которого запускает менеджер служб» became «демон, запущенный менеджером служб»; the token warning points at the Russian twin's «Учётные данные tracker»; «Включите его» and «Почините его», ambiguous after another sentence, now name автозапуск, and the other home's service reads «Служба вместо этого запускает демон для …». **Fixed** in `apps/cli/src/text.ts`.

Typecheck is clean, and the full suite passes: 875 of 875, under `ru_RU.UTF-8` and under `C`.
