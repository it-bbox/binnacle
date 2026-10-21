# 01: The repository language in the manifest and in binn init

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/human-output/spec.md`

**What to build:** a project states its documentation language, and `binn init` proposes it (spec, *The repository's language*; ADR-0045). The manifest gains `knowledge.language`, `en` or `ru`: null when unwritten and read as English where it is used; any other value a warning, not a problem, read as English. `binn init` proposes it from the root `README.md`, Russian when Cyrillic letters outnumber Latin ones outside code blocks and inline code, English otherwise, and from the person's language (`LC_ALL`, then `LANG`) when there is no README. The interactive form asks once with the proposal as its default, as it asks the window; `--language <en|ru>` answers it in every form; `--plan --json` reports the proposal, where it came from and whether the manifest declares one. A new manifest gets the line in the plan; an existing one with none gets it printed, never written, and only when the answer is not English. `/binnacle:init` shows the proposal in the chat, asks, and passes `--language` to `--plan` and `--apply`. `project.yaml.example` documents the field, and `docs/operations/01-new-project.md`, `02-existing-project-adopt.md` and their twins say how the language is proposed and where it is stated.

- [x] Through the daemon's manifest tests: `en`, `ru` and absent validate; an unknown value is a warning and the manifest stays usable.
- [x] Through the `binn` process: an English README proposes `en`, a Russian one `ru`, a README that is mostly code by its prose, no README by the locale.
- [x] `--language` answers in the interactive form, `--plan` and `--apply`; `--plan --json` carries the proposal and its source.
- [x] A new manifest in the plan holds `knowledge.language`; an existing one without it gets the line printed and its file unchanged; an English answer prints nothing.
- [x] `/binnacle:init` asks the language in the chat and passes the answer (checked in review).

## Comments

### Decisions

- **An unknown `knowledge.language`** is a warning on `knowledge.language`, and the validated manifest carries `null` for it, which reads as English where it is used, as an unwritten one does. `binn init` treats such a manifest as one that states a language (English), so it neither asks nor prints a line to add a key the file already has.
- **The question's place.** After the window and before autostart: `Documentation language [<proposal>]: `. Enter and the end of input take the proposal; anything but `en` or `ru` is asked again.
- **A new manifest states the language whatever it is**, English included, as the last line of its `knowledge` section; the section is always there, since `docs` is always declared.
- **`--plan --json`** carries `language: { value, proposal, source, declared }`: the language the plan uses, init's proposal, `readme` or `locale`, and whether the manifest states one. `--plan` and `--apply` without `--language` take the proposal, as they take the default window.
- **The README count** strips fenced blocks (``` and ~~~, an unclosed one to the end of the file) and inline code, then counts `\p{Script=Cyrillic}` against `\p{Script=Latin}`; a tie is English. Indented code blocks are counted as prose.

### For the next tickets

- `apps/cli/src/language.ts` holds `personLanguage()` (`LC_ALL`, then `LANG`, `ru…` is Russian), the one function the spec asks for: ticket 03 should take it rather than write another.
- `@binnacle/core` exports `Language` and `LANGUAGES`; `ProjectManifest['knowledge'].language` is the field tickets 06, 07 and 10 read, `?? 'en'` at the point of use.
- Every interactive `binn init` in `apps/cli/test/init.test.ts` now answers one more line, the language, after the window's: a test that adds a question must shift its inputs the same way.
- `parseLanguage()` beside it reads `en` or `ru` in any case, for `--language` and the typed answer alike.

### Review

A Reviewer sub-agent ran against `main`, on both axes. Every criterion holds, `/binnacle:init`'s language question among them (criterion 5, checked here); no new dependency, nothing outside the ticket.

**Standards:**

1. **`--language` and the typed answer were parsed apart**, so `--language RU` was a usage error while `RU` at the prompt was taken. **Fixed**: `parseLanguage()` in `apps/cli/src/language.ts` serves both, as `importWindow()` serves the window.
2. **A double blank line** when the step said nothing, an English answer for an existing manifest given by a flag. **Fixed**: each branch of `languageStep` that speaks ends with its own blank line.
3. **`language ?? 'en'` existed only for the type.** **Fixed**: `languageStep` returns the language in every branch.
4. **`init()`'s JSDoc and the "only the interactive form asks" comment** left the language out. **Fixed**.
5. **The printed addition starts with `knowledge:`**, which a manifest that has the section must not paste whole. **Kept**: the window's printed `telemetry:` block has the same shape, and the sentence says to put the line in the knowledge section.

**Spec:**

1. **A closing fence with an info string, such as `` ```js ``, ended a fenced block.** **Fixed**: a closing fence carries only backticks or tildes and blanks.
2. **No test for a manifest naming an unknown language.** **Fixed**: the declared-language test covers `language: fr`: warned, not asked, nothing printed, and `declared: true` with `value: en` in `--plan --json`.
3. **The new-project guide's "Name another window…" sentence left out the language.** **Fixed** in both twins.
4. **The skill asks autostart before the language, the terminal the other way round.** **Kept**: the order changes no answer, and the existing pack test pins autostart as the first question the skill asks.

Typecheck is clean, and the full suite passes: 862 of 862.
