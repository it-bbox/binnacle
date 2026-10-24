---
name: roadmap
description: Turn a vision or a half-built project into a roadmap of epics. For a new project it reads the vision or asks for it, for an existing one it reads the code, the history, the docs and binn audit's findings, and proposes each epic's status and a place for each stranded document. Writes and commits only after the human's yes, never pushes, and needs no daemon.
argument-hint: "[new | existing]"
disable-model-invocation: true
---

This skill turns what the project is for into a roadmap of epics, in Binnacle's format (ADR-0025), from a vision or from a project already under way. It needs no daemon and no `binnacle` MCP server: it reads files, Git and `binn audit --json`. It writes, moves and commits nothing until the human says yes in the chat.

Give the human each command you offer them alone in a fenced block, which copies in one click: a skill such as `/binnacle:daemon start` in a plain fence, a shell command such as `binn daemon start` in a `bash` fence. The roadmap's `Next action:` paragraph keeps its command in backticks, as the file writes it.

Speak to the person in the language of this conversation; these instructions stay English. Word every attention item, diagnostic and error from its `code`, `message` and `params`, in that language, with the Task ids, paths and numbers it names, and never show its code: codes are for you. Keep commands, paths, Task ids, branch names, model names, a file's own markers such as `Status: DONE`, and the names Binnacle, Graphify, Obsidian, Serena and the harnesses as written. Mark a value Binnacle calculated with one word in brackets, "(estimate)", and a reading from runs with "(from activity)"; say an unknown value as "no data", never zero. In Russian, the marks are "(оценка)", "(по активности)" and "нет данных", and the terms are: Task — задача; Epic — эпик; Current Epic — текущий эпик; Next action — следующий шаг; Suggested step — предложенный шаг; Product Snapshot — снимок проекта; Product session — продуктовая сессия; Product Steward — продуктовый агент; roadmap — роадмап; Spec — спецификация; Ticket — тикет; Epic brief — бриф эпика; Task brief — бриф задачи; Vision — видение; Backlog — бэклог; Ready — готова к старту; In progress — в работе; BLOCKED — заблокирована; Review — ревью; Done — готово; Unmet dependency — невыполненная зависимость; Question — вопрос; Answer — ответ; Waiting for the owner — ждёт владельца; Conflict risk — риск конфликта; Parallel limit — лимит параллельной работы; Checkout — рабочая копия; Harness — клиент агента; Provider — провайдер; AgentRun — запуск; Review run — запуск ревью; Rework run — доработка; Unassigned — без задачи; Roles — роли (разработчик, ревьюер, архитектор, тестировщик, безопасность, DevOps, аналитик); CI state — состояние CI; Audit — аудит; Finding — находка; Migration plan — план перехода; Stranded document — бесхозный документ; Checkpoint — чекпойнт; Autopilot — автопилот; Autostart — автозапуск; Vault projection — проекция в Obsidian; Context pressure — заполненность контекста; Session artifact — файл сессии; Harness support level — уровень поддержки; Project registry — реестр проектов; Project Brain — знания проекта. The roadmap's statuses read не начат, спецификация, тикеты, в работе, готов; a Task's states read бэклог (`BACKLOG`), готова (`READY`), в работе (`ACTIVE`), заблокирована (`BLOCKED`), на ревью (`READY_FOR_REVIEW`), одобрена (`APPROVED`), готова к слиянию (`MERGE_READY`), слита (`MERGED`), готово (`DONE`), отменена (`CANCELLED`); CI reads проходит (`passing`), падает (`failing`), идёт (`running`), нет проверок (`none`); a finding reads в порядке (`ok`), пробел (`gap`), неизвестно (`unknown`). Git's words take their usual Russian, ветка and коммит; `worktree` stays.

1. **Where things are.** Read `.binnacle/project.yaml`: `knowledge.docs` is the directory of `roadmap.md`, `vision.md` and `product-inbox.md`, and `knowledge.specs` the specs directory, `<knowledge.docs>/specs` when it names none. Without a manifest or a `<knowledge.docs>/roadmap.md`, stop and say that `binn init` writes both, after its own plan and the human's yes: `/binnacle:init`, or `binn init` at a terminal.

   Then read `knowledge.language` from `.binnacle/project.yaml`: `ru` is Russian, and `en`, any other value or none is English. That is the repository language: the vision and the roadmap you write are in it, whatever language this conversation is in, while the markers Binnacle parses stay English in every language: the table's header `| # | Epic | Status | Spec |`, its statuses, the Spec cell's `—`, `## Current focus` and `Next action:`, as `binn init`'s skeleton writes them.
2. **New or existing.** When `$ARGUMENTS` says `new` or `existing`, take that entry. Otherwise the project is existing when its history holds commits beyond those that added `binn init`'s files, or Git tracks source files (`git log --oneline`, `git ls-files`): code, not just docs, instruction files and Binnacle's manifest. It is new otherwise. Say which entry you took and why, in one line, and that the human can switch by saying so.
3. When the roadmap's table already lists epics, follow *Again*. Otherwise follow the entry's section, then *Writing*.

## New project

1. Read `<knowledge.docs>/vision.md`. Ask nothing it answers. When there is none, or it leaves out one of the three, ask for what is missing of what the project is, who it is for, and what it leaves out, one question at a time, waiting for each answer. Draft the vision from the answers in the human's own words, not rewritten into yours, in the repository language: when they answered in another, translate their words into it faithfully, adding nothing; show it whole with its path, and write it only on their yes; *Writing* commits it with the roadmap.
2. Propose the epics in dependency order, the foundation first, each with a title and one line of scope: what it delivers, and what it leaves to a later epic. Each is `not started`, its Spec `—`. The human may change, drop, merge or add epics before saying yes; show the list again after each change.

## Existing project

1. Read where the project is: the README and the instruction files, `<knowledge.docs>/vision.md` when there is one, the docs, the specs with their tickets' `Status:` lines, `git log` and the code, through Serena and Graphify where the manifest's `capabilities` says they are installed, otherwise its source tree and package manifests. Run `binn audit --json` once and read its findings; when the shell cannot find `binn` (exit 127), go on without them and say so. Ask nothing these answer.
2. Propose the epics in dependency order, each with a title, its status, `done`, `in progress` or `not started`, what in the code, the history or the tickets shows it, and one line of scope. An epic an existing spec describes links it from its row, `[<slug>](specs/<slug>/spec.md)`, and takes its status from that spec's tickets: `done` exactly when it has some and every one is `DONE` or `CANCELLED`, `in progress` when some are still open, and `not started` only while it has none. An epic with no spec keeps the Spec `—`.
3. For each document the audit's `docs.stranded` finding lists, propose one destination, with its reason: a spec, an ADR, `CONTEXT.md`, the product inbox (`<knowledge.docs>/product-inbox.md`), the roadmap, or stale. A backlog of undecided ideas goes to the product inbox, moved there or folded into it, not kept in place. A document that is one whole moves with `git mv`; one whose content belongs in an existing file is folded into it, and removing the original is an item of its own. A stale document stays where it is unless the human says to delete it.
4. When the audit's `docs.roadmap` finding says the roadmap is not in Binnacle's format, propose it rewritten into the format, keeping its content: its epics become the table's rows and their scope the `## Epics` lines, and every other section stays as written, below the current focus.

## Again

On a roadmap that already lists epics, read it, the vision, the product inbox (`<knowledge.docs>/product-inbox.md`) when there is one, and, on an existing project, the code and the history since, and propose only what to add or reorder among the epics `not started`, each with its reason and its line of scope. Never change a `done` epic, nor remove a row whose Spec cell links a spec. Renumber only the rows you reorder or add, and leave the current focus as it is unless the first epic not done changed.

Each `## ` heading of the inbox, with the text under it, is an entry. An entry marked `**Planned as epic N` or `**Planned into epic N` under its heading is planned already: never propose it again. One marked `**Planned on YYYY-MM-DD:**` with the parts it planned into epics is planned for those parts; weigh only the parts it names in none. Propose every other entry once: as a new epic, with its line of scope; as part of an existing `not started` epic, by its number; or as left out, by its heading; each with its reason. Leave no entry out silently. On the human's yes, beside the roadmap's change, write right under the heading of each entry taken `**Planned as epic N on YYYY-MM-DD.**` for a new epic or `**Planned into epic N on YYYY-MM-DD.**` for part of one, N its number in the new table and the date today's, and keep the entry in the inbox, where its epic's grilling reads it; an entry left out stays as it is. Only *Again* reads the inbox's entries.

Then *Writing*.

## Writing

Before showing the roadmap, check your draft against the format below, line by line. Show every change before any is made: the table's rows, the `## Epics` section, the current focus, each inbox entry's mark, each document's move or removal with its command, and the commit with its files and message, on the current branch. Then stop and wait. Nothing is written, moved or committed until the human says yes in the chat. They may edit, drop or add any item first; show the changed proposal again. If they cancel, change nothing more.

The roadmap stays in Binnacle's format (ADR-0025), which `binn audit` checks:

- the table headed `| # | Epic | Status | Spec |`, one row per epic in dependency order, numbered from 1, its Status one of `not started`, `spec`, `tickets`, `in progress` and `done`, its Spec `—` or a link to `specs/<slug>/spec.md`;
- a `## Epics` section right under the table, its heading in the repository language (`## Эпики` in Russian), one line per epic: its number and title in bold, then its line of scope;
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

On the human's yes, write the files with your own file tools and make the moves, then run `binn audit --json` once more: its `docs.roadmap` finding must be `ok`. When it is not, fix what it names, show the fix and commit only on a new yes; when the shell cannot find `binn`, say that the check did not run. Then commit only the files you wrote, moved or removed (`git add -- <paths>`), the vision among them when you wrote it, on the current branch, following the project's instruction files for the message and authorship. Never push, merge or switch branches.

End with what was written and the commit, then `/binnacle:product`, which reads the new Next action, alone in a fenced block.
