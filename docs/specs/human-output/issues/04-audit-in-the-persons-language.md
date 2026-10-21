# 04: binn audit in the person's language, plan first

Status: READY
Triage: ready-for-agent
Blocked by: 03
Spec: `docs/specs/human-output/spec.md`

**What to build:** `binn audit`'s text leads with what to do, in the person's language (spec, *`binn audit`'s findings carry their values*). Its findings carry the values their reasons and recommendations are written from, and the text output words them from the CLI dictionary: one line of totals, then the migration plan, its steps naming their areas rather than codes, then the gaps and unknowns by area, each with its reason and recommendation, then the `ok` findings one line each. No finding code is in the text. `--json` keeps today's English reasons and recommendations, the codes and `plan` as they are. `/binnacle:audit` is ticket 09.

- [ ] Through the `binn` process: the totals, then the plan, then gaps and unknowns by area, then `ok`, in English and in Russian.
- [ ] No code in the text; `--json` byte-for-byte the same under either locale.
- [ ] The existing tests that the audit writes nothing, runs offline and never prints a secret's value pass in both languages.

## Comments

### Decisions

- **The wording lives in `apps/cli/src/audit-text.ts`**: one function per wording key, English and Russian, from the values a check carries. A check returns its code, area, status, `init` and `words` (its key and values), never a sentence; `--json` words each finding with the English functions, which reproduce the reasons and recommendations byte for byte, and the text with the person's language. `--json` gains no field: the values stay inside the CLI.
- **The text's order**: one line of totals, the root in it; the plan, its summary on the heading's line, `binn init`'s step naming the areas it closes, the secrets' step, then each area's step by the area's name; the gaps and unknowns under each area's name, each with its status word and a `Recommendation:` line; then `In order`, each `ok` as `<area>: <reason>`. A section with nothing in it is left out, but for the plan, which says there is nothing to do.
- **The areas' names** are worded too (`Git and tracker` / `Git и трекер`, `Capabilities` / `Инструменты`, …): an area id such as `matt-pocock-layout` is a code a person need not read. `--json`'s step titles keep `The <area> area`.
- **Values from elsewhere**: a roadmap's gaps and an unusable tracker token are coded diagnostics, worded by core's `wordMessage`; `roadmapGaps` now returns them coded, and `binn init` joins their English messages as before. The stale skills' list comes from `binnacleSkills()`'s new `differ`, `missing` and `version` fields. The no-export reasons of opencode, ZCode, Antigravity, pi and VS Code have Russian by harness code. Left English and marked « (англ.)» in Russian: a harness's own OpenTelemetry settings (`what`) and why a settings file cannot be read (`why`), which `export.ts` writes for `binn init` too.
- **`binn audit` outside a Git repository** prints the unavailable reason worded from its code and params, and the sentence after it, in the person's language; the exit code is unchanged.

### For the next tickets

- `binn init` (ticket 05) reads the same export states and no-export reasons: `NO_EXPORT_RU` in `audit-text.ts` and `REPORT_WORDS` can be moved to `text.ts` if init needs them, and `ExportState`'s `what` and `why` are the English left to word.
- The guides' *Audit* section, `docs/operations/02-existing-project-adopt.md` and its twin, now describe the text's order and language.
