# 10: Every other skill in the person's language, writing in the repository's

Status: READY
Triage: ready-for-agent
Blocked by: 01, 09
Spec: `docs/specs/human-output/spec.md`

**What to build:** the skills that write into a repository write in its language, and every skill speaks the person's (spec, *The skills read the repository language from the manifest*). `/binnacle:roadmap`, `/binnacle:checkpoint`, `/binnacle:autopilot` and `/binnacle:task run` read `knowledge.language` from the manifest before they write a roadmap, a promoted decision, a ticket's status or a Review, English when it is absent, and keep every marker English. `/binnacle:answer` writes the owner's words as given, and it, `register`, `daemon`, `dashboard`, `help` and `init` report in the person's language, briefly, with no code in their text.

- [x] Each writing skill names where it reads the repository language and that markers stay English.
- [x] No skill asks the model to show a code to a person.
- [ ] Checked in review, and in the exit demonstration.

## Comments

### Decisions

- **Every skill carries ticket 09's *Words* paragraph, word for word**, after its fenced-block rule (`/binnacle:help` after its first paragraph): the person's language, every code worded and never shown, and `CONTEXT.md`'s *Russian words*. A test in `apps/cli/test/pack.test.ts` takes the paragraph from `/binnacle:product` and fails when any skill lacks it or changes it.
- **One sentence decides the repository language** in each writing skill: read `knowledge.language` from `.binnacle/project.yaml`, `ru` as Russian, `en`, any other value or none as English, as the manifest reads it. Each skill then names what it writes in it and the markers it keeps English: `/binnacle:roadmap` the table's header, statuses, the Spec cell's `—`, `## Current focus` and `Next action:`; `/binnacle:checkpoint` those, the ticket header's fields with their values, the triage labels and a spec's `## Risks`; `/binnacle:autopilot` its `## Risks` and the roadmap's markers; `/binnacle:task run` `## Comments`, `### Review`, `#### <role>`, `### Question`, `### Answer`, "(recommended)" and `Status:`.
- **"(recommended)" stays English**: no code parses it, but `/binnacle:answer` reads it to order the options, so it is treated as a marker.
- **The roadmap's `## Epics` heading follows the repository language** (`## Эпики`): nothing parses it.
- **A vision is written in the repository language**, in the owner's own words translated faithfully when they answered in another: it is a repository document, and the rule that it is the owner's words, not the model's, still holds.
- **`binn`'s stderr is still quoted as printed** by `/binnacle:register`, `/binnacle:daemon`, `/binnacle:dashboard` and `/binnacle:init`: `binn` words its errors without a code since ticket 03, in the shell's locale. Their reports of success are said in the person's language, briefly; `/binnacle:init` still shows its plan whole, its file contents as printed, since the human's yes confirms it.

### For the next tickets

- Ticket 11's exit demonstration covers this ticket's last criterion: the script below.

### Review

A Reviewer sub-agent ran against `main`, on the project's standards and the ticket's spec. Typecheck and `pack.test.ts` pass; the commit carries no attribution; the markers each skill lists match `roadmap.ts`, `layout.ts`, `local-tracker.ts` and `tracker.ts`.

1. **`/binnacle:init` showed the plan's `notes` and headings as printed**, and `--plan --json` keeps a manifest problem's code in its notes for the chat. **Fixed**: the headings and notes in the person's language, a code worded and never shown, the bodies as printed; the test checks the old wording is gone.
2. **`/binnacle:checkpoint`'s marker list left out fields Binnacle parses.** **Fixed**: `Triage:`, `Spec:`, `Roles:`, the Spec cell's `—` and a spec's `## Risks` added.
3. **`/binnacle:checkpoint` showed each draft with its target's id**, such as `new_work`. **Fixed**: its kind, worded.
4. **`docs/03-mcp-and-skills.md` said `/checkpoint`, `/autopilot` and `/roadmap` report as briefly**, which none of them says, and autopilot's report is long by design. **Fixed**: the sentence names the six skills the ticket names.
5. **The *Words* paragraph is copied into `/binnacle:help` and `/binnacle:dashboard`**, where codes seldom come up. **Kept**: ticket 09 chose the copy, since a harness reads each skill alone, and the test pins it.
6. **The test checks the marker sentence, not each skill's marker list.** **Kept**: the spec leaves the skills to review and the exit demonstration.
7. **`binn`'s stderr is quoted in the shell's language**, which can differ from the chat's. **Kept**: it carries no code, and quoting it keeps the diagnosis exact.
8. **`/binnacle:checkpoint` step 7 names the codes in brackets beside their wording.** **Kept**: they tell the model which is which; the step says to word each one.
9. **`/binnacle:task run`'s language paragraph follows step 5**, though steps 3 and 4 write the ticket. **Kept**: it opens with "Before writing into the ticket".

### For the owner: the exit demonstration

The last criterion stays unticked until you check it, in a Russian chat:

1. On this repository, documented in English, run `/binnacle:checkpoint` and `/binnacle:roadmap`: they talk to you in Russian, and every draft they would write is English.
2. On a fixture `binn init` wrote with `--language ru`, run `/binnacle:roadmap new`: the vision and the roadmap's prose are Russian, while `| # | Epic | Status | Spec |`, the statuses, `## Current focus` and `Next action:` stay English, and `binn audit` finds no gap in the roadmap.
3. Run `/binnacle:daemon status`, `/binnacle:register` and `/binnacle:help`: each answers in Russian, briefly, and no code such as `daemon.unreachable` appears.
