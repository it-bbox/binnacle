---
name: audit
description: Audit a repository for Binnacle, the current one by default, by running `binn audit --json`, and open with its totals, its migration plan, then its gaps and unknowns by area, giving the rest when asked. Needs no daemon, and changes nothing.
argument-hint: "[path]"
disable-model-invocation: true
---

This skill needs no daemon and no `binnacle` MCP server: it runs the CLI command `binn audit` (`docs/specs/audit-and-adopt/spec.md`) and reads its JSON.

Give the human each command you offer them alone in a fenced block, which copies in one click: a skill such as `/binnacle:daemon start` in a plain fence, a shell command such as `binn daemon start` in a `bash` fence.

Speak to the person in the language of this conversation; these instructions stay English. Word every attention item, diagnostic and error from its `code`, `message` and `params`, in that language, with the Task ids, paths and numbers it names, and never show its code: codes are for you. Keep commands, paths, Task ids, branch names, model names, a file's own markers such as `Status: DONE`, and the names Binnacle, Graphify, Obsidian, Serena and the harnesses as written. Mark a value Binnacle calculated with one word in brackets, "(estimate)", and a reading from runs with "(from activity)"; say an unknown value as "no data", never zero. In Russian, the marks are "(оценка)", "(по активности)" and "нет данных", and the terms are: Task — задача; Epic — эпик; Current Epic — текущий эпик; Next action — следующий шаг; Suggested step — предложенный шаг; Product Snapshot — снимок проекта; Product session — продуктовая сессия; Product Steward — продуктовый агент; roadmap — роадмап; Spec — спецификация; Ticket — тикет; Epic brief — бриф эпика; Task brief — бриф задачи; Vision — видение; Backlog — бэклог; Ready — готова к старту; In progress — в работе; BLOCKED — заблокирована; Review — ревью; Done — готово; Unmet dependency — невыполненная зависимость; Question — вопрос; Answer — ответ; Waiting for the owner — ждёт владельца; Conflict risk — риск конфликта; Parallel limit — лимит параллельной работы; Checkout — рабочая копия; Harness — клиент агента; Provider — провайдер; AgentRun — запуск; Review run — запуск ревью; Rework run — доработка; Unassigned — без задачи; Roles — роли (разработчик, ревьюер, архитектор, тестировщик, безопасность, DevOps, аналитик); CI state — состояние CI; Audit — аудит; Finding — находка; Migration plan — план перехода; Stranded document — бесхозный документ; Checkpoint — чекпойнт; Autopilot — автопилот; Autostart — автозапуск; Vault projection — проекция в Obsidian; Context pressure — заполненность контекста; Session artifact — файл сессии; Harness support level — уровень поддержки; Project registry — реестр проектов; Project Brain — знания проекта. The roadmap's statuses read не начат, спецификация, тикеты, в работе, готов; a Task's states read бэклог (`BACKLOG`), готова (`READY`), в работе (`ACTIVE`), заблокирована (`BLOCKED`), на ревью (`READY_FOR_REVIEW`), одобрена (`APPROVED`), готова к слиянию (`MERGE_READY`), слита (`MERGED`), готово (`DONE`), отменена (`CANCELLED`); CI reads проходит, падает, идёт, нет проверок; a finding reads в порядке, пробел, неизвестно. Git's words take their usual Russian, ветка and коммит; `worktree` stays.

1. Run `binn audit --json` in the current directory, or, if the human passed a path (`$ARGUMENTS`), `binn audit <path> --json`. Quote the path for the shell. Run it once.
   - If the shell cannot find `binn` (`command not found`, exit 127), stop. Say that `binn` is not on this harness's PATH, and point to the README's setup section (*Install*).
   - Any other non-zero exit means the audit could not run, for example a missing path or one that is not a Git repository. Stop, give the exit code and say what it printed on stderr as the reason, in words. Gaps never cause a non-zero exit.
2. The output is `{ "root", "findings", "plan" }`; each finding has `code`, `area`, `status` (`ok`, `gap` or `unknown`), `init` (whether `binn init` closes it), `reason` and, for a gap or an unknown, `recommendation`. `plan` is `{ "steps", "summary" }`; each step has `number`, `title`, `findings` (the codes it takes) and `todo`. The reasons, recommendations and steps are English: word them in the person's language, and name a finding by what it checks, never by its code.
3. **Open with three to six lines**, in this order, and leave out a line with nothing in it:
   - **The totals**, in one line: the audited `root`, then how many findings are ok, gaps and unknown.
   - **The plan**: each step in order, one short line each, its number, its title and its areas, the `area` of the findings it takes, never their codes; with no step, the `summary`'s nothing to do, in words. When the steps do not fit, give the first ones and how many more. Where the first step is `binn init`, give `binn init` alone in a `bash` fence, and say that running it is the person's: it writes into the repository after showing its plan and asking once. Every other step is the person's too; the plan is advice.
   - **The gaps and unknowns by area**, in one line: each area that has any, with how many gaps and unknowns.

   Then one line on what else you can show: each step's to-do, each gap and unknown with its reason and recommendation, and the ok findings.
4. **When the person asks for more**, give it from the same output, without running the audit again:
   - **The plan**: each step with its `todo`, worded.
   - **Gaps**, grouped by `area` in the order the output gives: each with what it checks, its reason and its recommendation.
   - **Unknown**, grouped the same way: each with what it checks, its reason, which says why Binnacle cannot tell, and its recommendation.
   - **Ok**: one line each, only when the person asks for them.

   Do not add findings of your own, and do not reword a reason into a different claim. There is no overall score.

Carry out no recommendation and change nothing: no files, no commits, no `binn init`, no other command than the one in step 1. Offer to explain a finding, and wait for the human.
