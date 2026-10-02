# 07: binn init's Summary, and working from another harness

Status: DONE
Triage: ready-for-agent
Blocked by: 02, 03
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** the owner's finding of 2026-09-27 that continuing in another harness is not discoverable, and the link between the two commands. `binn init`'s Summary suggests `binn audit`, and for a harness it detected other than Claude Code, prints the exact next step for it, including the prompt that makes an agent read the Binnacle skill and follow it. The audit's recommendations name `binn init` for each Binnacle file that is missing. The README, and `README.ru.md` in the same change, gain a section on working from another harness: Codex reads a project's `.codex/config.toml` only in a trusted project, the Codex desktop app ships its CLI outside `PATH`, and GLM is a model reached through a harness such as Claude Code or opencode. No skill format for another harness is added.

- [x] Init's Summary suggests `binn audit`.
- [x] With Codex or another non-Claude-Code harness detected, the Summary prints the next step for it, with the prompt that makes an agent follow the Binnacle skill.
- [x] An audit gap for a missing Binnacle file recommends `binn init`.
- [x] `README.md` has the section, and `README.ru.md` carries the same one.
- [x] A test checks the Summary lines for a detected non-Claude-Code harness, and the README is read in review.

## Comments

### Decisions

- **The Summary** ends with a line suggesting `binn audit`, then one block per detected harness other than Claude Code (Codex, opencode, VS Code), each a numbered list: a note where the harness has one (Codex: it reads `.codex/config.toml` only in a trusted project), how to start it, for Codex when `codex` is not on PATH the desktop app's CLI at `/usr/lib/chatgpt/resources/codex`, and the prompt "read the Binnacle product skill file at <path> and follow it". The block is headed "once its configuration names binnacle", so it is true whether or not the plan was confirmed. It is data on the `Harness` entry (`open`, `offPath`), so a new harness is still one entry.
- **The skill path** is the project's own `.claude/skills/binnacle/skills/product/SKILL.md` when it carries the plugin, otherwise `plugin/skills/product/SKILL.md` in the Binnacle package that init runs from, as an absolute path. No new skill format.
- **The audit's missing Binnacle file** is `binnacle.manifest` in the Git and tracker area: `ok` when `.binnacle/project.yaml` exists, otherwise a `gap` recommending `binn init`. The existing `tracker.token_works` recommendation already named init. Docs, layout and instructions gaps naming init belong to ticket 04.
- **README**: the section in both files, and the "Existing project" path rewritten from the never-built `binn adopt` and `/audit` to `binn audit`, `binn init`. `docs/03-mcp-and-skills.md` and `docs/operations/02-existing-project-adopt.md` drop the future `/audit` skill, the `audit.project` tool and `binn adopt` for the CLI command (the leftover ticket 03 named); the durable rules, read-only and no score, live in the spec and in that operations doc.
- **Left**: a `CONTEXT.md` entry for the Summary's next step, which is a message and not a term.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards:**

1. **The ticket and roadmap were not closed.** **Fixed**: `DONE` and the roadmap are this branch's last commit.
2. **`docs/operations/02-existing-project-adopt.md` still described `binn adopt`.** **Fixed**.
3. **The skill prompt and the Codex path are written in several files.** **Kept**: code, two READMEs and a design doc state one sentence each; no shared source for prose.
4. **`offPath` is Codex-only.** **Kept**: one optional field is the smallest way to keep the Codex hint with its entry.
5. **`nextSteps` filters an array of optional strings.** **Kept**: reads plainly with four items.
6. **A test slices the output before `Summary:`.** **Kept**: the trust note now legitimately appears in the Summary of a skip.
7. **`CONTEXT.md` glossary.** **Left**, see Decisions.

**Spec:**

1. **Only the manifest is a missing Binnacle file.** **Kept**: other files are the layout, instructions and the like, ticket 04's.
2. **The README overstated: "registers", "the only command that writes", `opencode.json` alone.** **Fixed**.
3. **The next steps print even when the plan was declined.** **Kept**: the heading says "once its configuration names binnacle".
4. **VS Code and opencode steps and the `docs/03` and README path edits go beyond the ticket's text.** **Kept**: the ticket says "another non-Claude-Code harness", and the stale paths contradicted the section.
5. **The README path is relative, the Summary's absolute.** **Kept**: the README names the two kinds.

Typecheck is clean, and the full suite passes: 403 of 403. The README section was read in review; no criterion needs a human script.
