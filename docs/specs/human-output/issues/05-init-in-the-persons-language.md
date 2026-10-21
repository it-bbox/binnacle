# 05: binn init in the person's language, next command first

Status: READY
Triage: ready-for-agent
Blocked by: 01, 03, 06
Spec: `docs/specs/human-output/spec.md`

**What to build:** `binn init` speaks the person's language (spec, *`binn`'s own text*, *`binn init`'s Summary*, *The plan's id ignores the person's language*). Its dialogue, questions, notes, plan headings, warnings and Summary are worded from the CLI dictionary. The Summary opens with the command to run next, then what was written, skipped, printed or declined; the questions still come before the plan they shape. The plan's headings in `--plan --json` and in its id's hash stay English, so a plan shown in a Russian chat is applied from an English shell; its `notes` stay English for the chat to word. The templates' language is the repository's (ticket 06), never the person's.

- [ ] Through the `binn` process: the interactive form in Russian under `ru_RU.UTF-8` and in English otherwise, with no code in its text.
- [ ] The Summary opens with the next command in both languages.
- [ ] `--plan --json` byte-for-byte the same under either locale, and `--apply` with that id writes under either.
