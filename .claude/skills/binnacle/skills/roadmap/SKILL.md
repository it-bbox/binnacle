---
name: roadmap
description: Turn a vision or a half-built project into a roadmap of epics. For a new project it reads the vision or asks for it, for an existing one it reads the code, the history, the docs and binn audit's findings, and proposes each epic's status and a place for each stranded document. Writes and commits only after the human's yes, never pushes, and needs no daemon.
argument-hint: "[new | existing]"
disable-model-invocation: true
---

This skill turns what the project is for into a roadmap of epics, in Binnacle's format (ADR-0025), from a vision or from a project already under way. It needs no daemon and no `binnacle` MCP server: it reads files, Git and `binn audit --json`. It writes, moves and commits nothing until the human says yes in the chat.

Give the human each command you offer them alone in a fenced block, which copies in one click: a skill such as `/binnacle:product` in a plain fence, a shell command such as `binn audit` in a `bash` fence. The roadmap's `Next action:` paragraph keeps its command in backticks, as the file writes it.

1. **Where things are.** Read `.binnacle/project.yaml`: `knowledge.docs` is the directory of `roadmap.md` and `vision.md`, and `knowledge.specs` the specs directory, `<knowledge.docs>/specs` when it names none. Without a manifest or a `<knowledge.docs>/roadmap.md`, stop and say that `binn init` writes both, after its own plan and the human's yes: `/binnacle:init`, or `binn init` at a terminal.
2. **New or existing.** When `$ARGUMENTS` says `new` or `existing`, take that entry. Otherwise the project is existing when its history holds commits beyond those that added `binn init`'s files, or Git tracks source files (`git log --oneline`, `git ls-files`): code, not just docs, instruction files and Binnacle's manifest. It is new otherwise. Say which entry you took and why, in one line, and that the human can switch by saying so.
3. When the roadmap's table already lists epics, follow *Again*. Otherwise follow the entry's section, then *Writing*.

## New project

1. Read `<knowledge.docs>/vision.md`. Ask nothing it answers. When there is none, or it leaves out one of the three, ask for what is missing of what the project is, who it is for, and what it leaves out, one question at a time, waiting for each answer. Draft the vision from the answers in the human's own words, not rewritten into yours, show it whole with its path, and write it only on their yes.
2. Propose the epics in dependency order, the foundation first, each with a title and one line of scope: what it delivers, and what it leaves to a later epic. Each is `not started`, its Spec `—`. The human may change, drop, merge or add epics before saying yes; show the list again after each change.

## Existing project

1. Read where the project is: the README and the instruction files, `<knowledge.docs>/vision.md` when there is one, the docs, the specs with their tickets' `Status:` lines, `git log` and the code, through Serena and Graphify where the manifest's `capabilities` says they are installed, otherwise its source tree and package manifests. Run `binn audit --json` once and read its findings; when the shell cannot find `binn` (exit 127), go on without them and say so. Ask nothing these answer.
2. Propose the epics in dependency order, each with a title, its status, `done`, `in progress` or `not started`, what in the code, the history or the tickets shows it, and one line of scope. An epic an existing spec describes links it from its row, `[<slug>](specs/<slug>/spec.md)`, and takes its status from that spec's tickets: `done` only when every one is `DONE` or `CANCELLED`, never `not started` once it has one.
3. For each document the audit's `docs.stranded` finding lists, propose one destination, with its reason: a spec, an ADR, `CONTEXT.md`, the product inbox, the roadmap, or stale. A document that is one whole moves with `git mv`; one whose content belongs in an existing file is folded into it, and removing the original is an item of its own. A stale document stays where it is unless the human says to delete it.
4. When the audit's `docs.roadmap` finding says the roadmap is not in Binnacle's format, propose it rewritten into the format, keeping its content: its epics become the table's rows and their scope the `## Epics` lines, and every other section stays as written, below the current focus.

## Again

On a roadmap that already lists epics, read it, the vision and, on an existing project, the code and the history since, and propose only what to add or reorder among the epics `not started`, each with its reason and its line of scope. Never change a `done` epic, nor remove a row whose Spec cell links a spec. Renumber only the rows you reorder or add, and leave the current focus as it is unless the first epic not done changed. Then *Writing*.

## Writing

Show every change before any is made: the vision when it is new, the table's rows, the `## Epics` section, the current focus, each document's move or removal with its command, and the commit with its files and message, on the current branch. Then stop and wait. Nothing is written, moved or committed until the human says yes in the chat. They may edit, drop or add any item first; show the changed proposal again. If they cancel, change nothing more.

The roadmap stays in Binnacle's format (ADR-0025), which `binn audit` checks:

- the table headed `| # | Epic | Status | Spec |`, one row per epic in dependency order, numbered from 1, its Status one of `not started`, `spec`, `tickets`, `in progress` and `done`, its Spec `—` or a link to `specs/<slug>/spec.md`;
- a `## Epics` section right under the table, one line per epic: its number and title in bold, then its line of scope;
- `## Current focus`, a sentence or two on where the project stands, ending with the Next action paragraph: `Next action:`, what to do, naming the brief the grilling ends with, and exactly one command in backticks, `/grill-with-docs` with the first epic not done named.

For example:

```markdown
# Roadmap

Where the project stands: each epic's status and spec, and the current focus. Binnacle reads this file, so keep the table's header and the `## Current focus` heading as they are.

**Status vocabulary:** `not started` → `spec` → `tickets` → `in progress` → `done`. A Spec cell is `—` or a link to `specs/<slug>/spec.md`.

| # | Epic | Status | Spec |
| --- | --- | --- | --- |
| 1 | Accounts | done | [`accounts`](specs/accounts/spec.md) |
| 2 | Shared lists | not started | — |

## Epics

- **1. Accounts** — sign-up, sign-in and a profile; no teams.
- **2. Shared lists** — lists two accounts edit together; no comments yet.

## Current focus

Epic 1 is done; epic 2 is next.

Next action: grill epic 2, Shared lists, ending with its brief, `docs/specs/shared-lists/brief.md`. `/grill-with-docs epic 2: Shared lists`
```

On the human's yes, write the files with your own file tools and make the moves, then run `binn audit --json` once more: its `docs.roadmap` finding must be `ok`. When it is not, fix what it names and show the fix before committing. Then commit only the files you wrote, moved or removed (`git add -- <paths>`), on the current branch, following the project's instruction files for the message and authorship. Never push, merge or switch branches.

End with what was written and the commit, then `/binnacle:product`, which reads the new Next action, alone in a fenced block.
