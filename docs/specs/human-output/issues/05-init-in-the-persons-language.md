# 05: binn init in the person's language, next command first

Status: READY
Triage: ready-for-agent
Blocked by: 01, 03, 06
Spec: `docs/specs/human-output/spec.md`

**What to build:** `binn init` speaks the person's language (spec, *`binn`'s own text*, *`binn init`'s Summary*, *The plan's id ignores the person's language*). Its dialogue, questions, notes, plan headings, warnings and Summary are worded from the CLI dictionary. The Summary opens with the command to run next, then what was written, skipped, printed or declined; the questions still come before the plan they shape. The plan's headings in `--plan --json` and in its id's hash stay English, so a plan shown in a Russian chat is applied from an English shell; its `notes` stay English for the chat to word. The templates' language is the repository's (ticket 06), never the person's.

- [ ] Through the `binn` process: the interactive form in Russian under `ru_RU.UTF-8` and in English otherwise, with no code in its text.
- [ ] The Summary opens with the next command in both languages.
- [ ] `--plan --json` byte-for-byte the same under either locale, and `--apply` with that id writes under either.

## Comments

### Decisions

- **The wording is `apps/cli/src/init-text.ts`**, `INIT_TEXT[language]`, one entry per sentence, the English byte for byte as before but where a code was printed. A session speaks the person's language, or English for `--plan --json`; a plan item's `heading` is a function of the words, called with English for `--plan --json` and the id's hash and with the person's words when the interactive form shows it.
- **`--plan --json`'s notes keep the manifest's `code: message` line** as before, for the chat to word; the interactive form and `--apply` print the sentence alone. `autostartUnavailable` and `say` take a language, and `detected` too, so that no note follows the locale.
- **The Summary's next command**, alone and indented after a line saying where to run it: `binn init` when the plan was declined or not confirmed; `binn project register` once a manifest with problems is fixed, or once autostart started the daemon; `binn daemon start` then `binn project register` when the daemon is not running; otherwise `/binnacle:product` in a new Claude Code session, `binnacle-product` in the first other harness detected, or `binn audit` with no harness, which then is not suggested twice.
- **Codes left the text**: the manifest's problem, the tracker check's failure, in its step and in the Summary, and the refused `--apply`, which exits 3 with its sentence. `/binnacle:init` now reads the refusal as exit 3 with nothing on stdout. The registration's plan body is `binn project register <root>`, and its Summary line `ran binn project register`.
- **Uncoded text stays as the system or a harness wrote it**: a service manager's error (`systemctl was not found on PATH`), a `skills` add's reason, Graphify's stderr, a harness's own OpenTelemetry settings and why they cannot be read, marked « (англ.)» in Russian where they stand alone. The `npx skills remove … <each skill the add installed>` placeholder stays in the command it belongs to.
- **The guides**: `docs/operations/01-new-project.md` and its twin say init speaks the locale, `--plan --json` stays English, and the Summary opens with the next command; `docs/03-mcp-and-skills.md` likewise.

### For the next tickets

- `apps/cli/test/init.test.ts` holds `assertNoCode`, `RUSSIAN` and a check that a Russian run prints no common English word outside the plan's bodies and the commands: a step that gains a sentence must give it Russian words, or that test fails.
- `audit-text.ts` now exports `counted`, `NO_EXPORT_RU`, `setsRu` and `staleRu`, which init's Russian reuses.
