# Работа из другого harness

_English version: [06-other-harnesses.md](06-other-harnesses.md). Этот файл — русский дубликат; обновляется вместе с `06-other-harnesses.md`._

## Поддержка любого coding agent

Агенты сильно отличаются тем, что отдают наружу, поэтому поддержка градуированная, а не бинарная:

| Уровень | Что требуется | Что получает пользователь |
| --- | --- | --- |
| 1 — Context | агент умеет вызвать MCP server | память проекта: snapshots, задачи, checkpoints, вопросы и ответы |
| 2 — Attribution | пишет session artifact с рабочим каталогом и id сессии | привязка сессии к проекту, тайминги, история |
| 3 — Usage | в этом artifact есть счётчики токенов | аналитика расходов, стоимость, метрики переделок |
| 4 — Live | отдаёт наблюдаемый поток | что выполняется прямо сейчас |

**Уровня 1 достаточно, чтобы агент считался поддержанным, и адаптер для него не нужен.** Агент, вышедший завтра, получает память проекта в тот день, когда научится MCP. См. [ADR-0014](../adr/ADR-0014-harness-support-levels.md).

## Harness и их уровни

Harness, которые Binnacle читает сегодня, наивысший уровень, которого достигает каждый, и как:

| Harness | Уровень | Как он достигается |
| --- | --- | --- |
| Claude Code (CLI и desktop) | 4 — Live | его файлы сессий в `~/.claude/projects` и экспорт OpenTelemetry, который `binn init` включает в его настройках |
| Codex (CLI и desktop) | 4 — Live | его rollouts в `~/.codex/sessions` и экспорт OpenTelemetry, который `binn init` включает в `~/.codex/config.toml` |
| Gemini CLI | 4 — Live, не проверен | его файлы сессий в `~/.gemini/tmp` и экспорт OpenTelemetry, который `binn init` включает в `~/.gemini/settings.json` |
| opencode | 3 — Usage | его база данных в `~/.local/share/opencode`; экспорт OpenTelemetry у него не задокументирован |
| ZCode | 3 — Usage | его база данных в `~/.zcode/cli/db`; экспорт OpenTelemetry у него не задокументирован |
| pi | 3 — Usage | его файлы сессий в `~/.pi/agent/sessions`; встроенного экспорта OpenTelemetry у него нет |
| Antigravity | 2 — Attribution, не проверен | его состояние окна, где названо рабочее пространство каждого разговора; сами разговоры зашифрованы, поэтому ни модели, ни токенов |
| любой другой | 1 — Context | MCP или `binn call` в его shell |

Уровень 4 держится, пока приходят события harness; без экспорта Claude Code, Codex и Gemini CLI читаются из их файлов на уровне 3, а вызов, увиденный обоими путями, считается один раз. Gemini CLI и Antigravity построены по их исходникам, так как ни один не смог провести сессию на машине владельца, и помечены как не проверенные. Фактические уровни каждого проекта, с причиной, по которой harness не дотягивает до следующего, — на странице usage в dashboard. Подробности, на английском: [MCP and skills](../03-mcp-and-skills.md#harnesses-and-their-levels), *Harnesses and their levels*.

## Навыки Binnacle в другом harness

Один `binn init` настраивает все harness на машине. Его план устанавливает навыки Binnacle на уровне пользователя в каждый harness, который находит CLI `skills` (skills.sh), например Codex, Antigravity, ZCode или Pi, через `npx skills`, и не оставляет их в Claude Code, где есть plugin `binnacle`; `--skip-harness <id>` не пускает их и в другой harness. Вне Claude Code каждый навык называется `binnacle-<action>`: `binnacle-product`, `binnacle-daily`, `binnacle-task`, `binnacle-status`, `binnacle-checkpoint`, `binnacle-audit`, `binnacle-init`, `binnacle-daemon`, `binnacle-register`, `binnacle-dashboard`, `binnacle-autopilot`, `binnacle-answer`, `binnacle-roadmap` и `binnacle-help`, тогда как в Claude Code это `/binnacle:product` и остальные. Summary называет harness, в которые установлены навыки, и говорит запустить там `binnacle-product`. Для harness, установленного позже, запустите `binn init` ещё раз: он устанавливает навыки в каждый найденный harness, устарели они или актуальны, и говорит, какими они были. `binn audit` сообщает о навыках, чья версия отличается от версии установленного `binn`, и `binn init` затем ставит их заново.

`binn init` также предлагает зарегистрировать MCP-сервер `binnacle` в Claude Code, Codex, opencode и VS Code. В любом другом harness или пока сервер не зарегистрирован навыки вызывают те же инструменты через `binn call <tool> [json]` в shell. `binnacle-autopilot` работает только там, где harness умеет запускать фонового агента в собственном worktree; в остальных он сразу отказывается, ничего не меняет, и тикеты эпика выполняются вручную.

- **Codex** читает `.codex/config.toml` проекта только в доверенном проекте (trusted project). Доверьте проект в Codex, иначе запись `binnacle` не будет видна. Десктопное приложение Codex ставит свой CLI вне `PATH`; на Linux это `/usr/lib/chatgpt/resources/codex`.
- **opencode** читает `opencode.json` или `opencode.jsonc` в проекте. Запустите `opencode` в корне репозитория.
- **GLM** — модель, а не harness. Подключайте её через harness, например ZCode, Claude Code или opencode; адаптера GLM искать не нужно.
