# 05: binn init in the person's language, next command first

Status: DONE
Triage: ready-for-agent
Blocked by: 01, 03, 06
Spec: `docs/specs/human-output/spec.md`

**What to build:** `binn init` speaks the person's language (spec, *`binn`'s own text*, *`binn init`'s Summary*, *The plan's id ignores the person's language*). Its dialogue, questions, notes, plan headings, warnings and Summary are worded from the CLI dictionary. The Summary opens with the command to run next, then what was written, skipped, printed or declined; the questions still come before the plan they shape. The plan's headings in `--plan --json` and in its id's hash stay English, so a plan shown in a Russian chat is applied from an English shell; its `notes` stay English for the chat to word. The templates' language is the repository's (ticket 06), never the person's.

- [x] Through the `binn` process: the interactive form in Russian under `ru_RU.UTF-8` and in English otherwise, with no code in its text.
- [x] The Summary opens with the next command in both languages.
- [x] `--plan --json` byte-for-byte the same under either locale, and `--apply` with that id writes under either.

## Comments

### Decisions

- **The wording is `apps/cli/src/init-text.ts`**, `INIT_TEXT[language]`, one entry per sentence, the English byte for byte as before but where a code was printed. A session speaks the person's language, or English for `--plan --json`; a plan item's `heading` is a function of the words, called with English for `--plan --json` and the id's hash and with the person's words when the interactive form shows it.
- **`--plan --json`'s notes keep the manifest's `code: message` line** as before, for the chat to word; the interactive form and `--apply` print the sentence alone. `autostartUnavailable` and `say` take a language, and `detected` the words it says why with, so that no note follows the locale.
- **The Summary's next command**, alone and indented after a line saying where to run it: `binn init` when the plan was declined or not confirmed; `binn project register` once a manifest with problems is fixed, or once autostart started the daemon; `binn daemon start` then `binn project register` when the daemon is not running; otherwise `/binnacle:product` in a new Claude Code session, `binnacle-product` in the first other harness detected, or `binn audit` with no harness, which then is not suggested twice. Run from outside the repository's root, `binn init` and `binn project register` name it.
- **Codes left the text**: the manifest's problem, the tracker check's failure, in its step and in the Summary, and the refused `--apply`, which exits 3 with its sentence. `/binnacle:init` now reads the refusal by its exit code, 3, alone. The registration's plan body is `binn project register <root>`, and its Summary line `ran binn project register`.
- **Uncoded text stays as the system or a harness wrote it**: a service manager's error (`systemctl was not found on PATH`), a `skills` add's reason, Graphify's stderr, a harness's own OpenTelemetry settings and why they cannot be read, marked « (англ.)» in Russian where they stand alone. The `npx skills remove … <each skill the add installed>` placeholder stays in the command it belongs to.
- **The guides**: `docs/operations/01-new-project.md` and its twin say init speaks the locale, `--plan --json` stays English, and the Summary opens with the next command; `docs/03-mcp-and-skills.md` likewise.

### For the next tickets

- `apps/cli/test/init.test.ts` holds `assertNoCode`, `RUSSIAN` and a check that a Russian run prints no common English word outside the plan's bodies and the commands: a step that gains a sentence must give it Russian words, or that test fails.
- `audit-text.ts` now exports `counted`, `NO_EXPORT_RU`, `setsRu` and `staleRu`, which init's Russian reuses.

### Review

A Reviewer sub-agent ran against `main`, on both axes. Typecheck is clean; every criterion holds; no new dependency, nothing outside the ticket. Every English heading depends only on the words it is given, so the plan's id does not follow the locale.

**Standards:**

1. **`detected()` held Russian of its own** in `apps/cli/src/export.ts`, outside the dictionary. **Fixed**: it takes the words it says why with, `toolOnPath` and `exists` from `init-text.ts`.
2. **« (англ.)» written by hand** in `init-text.ts` rather than taken from `TEXT.ru.english`. **Kept**: `audit-text.ts` does the same.
3. **`text = T` repeated** in the three service managers' `unavailable`. **Kept**: one default each, no logic.

**Spec:**

1. **The Summary's next command named no path**, so `binn init /other/repo` run from elsewhere gave `binn project register` for the wrong directory. **Fixed**: `binn init` and `binn project register` name the repository when run from outside its root; the subdirectory test pins it.
2. **Russian wording**: «в демоне, который запустил автозапуск» became «в демоне, запущенном автозапуском»; «`…` включит его позже» became «включить его можно позже командой `…`»; «для расхода токенов» became «чтобы считать расход»; «Годного» became «Пригодного»; «уже идёт в Binnacle» became «уже экспортирует в Binnacle»; a failed command reads «— ошибка» in both places. **Fixed** in `apps/cli/src/init-text.ts`.
3. **The Russian twin of the new-project guide said "Summary"** where `binn` prints «Итог». **Fixed**: «итог».
4. **The `register`, `harness` and `audit` next steps and a Russian refused `--apply` were untested.** **Fixed**: tests for each in `apps/cli/test/init.test.ts`. Writing them showed that a refused `--apply` prints its dialogue before refusing, so `/binnacle:init` reads the refusal by its exit code alone, not by an empty stdout.
5. **With no README and no `--language`, the proposal follows the locale**, so `--plan --json` differs between locales. **Kept**: the spec proposes the person's language there, and `/binnacle:init` passes `--language`.

Typecheck is clean, and the full suite passes: 888 of 888, under `ru_RU.UTF-8` and under `C`.
