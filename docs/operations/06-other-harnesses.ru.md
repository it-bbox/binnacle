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

Уровень 4 держится, пока приходят события harness. Без экспорта Claude Code, Codex и Gemini CLI читаются из их файлов на уровне 3, а вызов, увиденный обоими путями, считается один раз.

Gemini CLI и Antigravity построены по их исходникам, так как ни один не смог провести сессию на машине владельца, и помечены как не проверенные. Фактические уровни каждого проекта, с причиной, по которой harness не дотягивает до следующего, — на странице usage в dashboard. Подробности, на английском: [MCP and skills](../03-mcp-and-skills.md#harnesses-and-their-levels), *Harnesses and their levels*.

## Навыки Binnacle в другом harness

Один `binn init` настраивает все harness на машине:

- Его план устанавливает навыки Binnacle на уровне пользователя, через `npx skills`, в каждый harness, который находит CLI `skills` (skills.sh), например Codex, Antigravity, ZCode или pi.
- Затем он удаляет их из Claude Code, где есть плагин `binnacle`. `--skip-harness <id>`, с id harness в CLI `skills`, не пускает их и в другой harness.
- Summary называет harness, в которые установлены навыки, и говорит запустить там `binnacle-product`.

Для harness, установленного позже, запустите `binn init` ещё раз: он устанавливает навыки в каждый найденный harness, устарели они или актуальны, и говорит, какими они были. `binn audit` сообщает о навыках, чья версия отличается от версии установленного `binn`, и `binn init` затем ставит их заново.

Вне Claude Code каждый навык называется `binnacle-<action>`, тогда как в Claude Code это `/binnacle:<action>`:

| В Claude Code | В другом harness | Что делает |
| --- | --- | --- |
| `/binnacle:audit` | `binnacle-audit` | что в репозитории есть и чего не хватает для Binnacle, ничего не меняя |
| `/binnacle:init` | `binnacle-init` | настроить репозиторий: весь план, записанный только после вашего «да» |
| `/binnacle:daemon` | `binnacle-daemon` | запустить, остановить или проверить демон, включить или выключить его автозапуск |
| `/binnacle:register` | `binnacle-register` | зарегистрировать этот репозиторий в запущенном демоне |
| `/binnacle:status` | `binnacle-status` | как видны этот проект и этот checkout |
| `/binnacle:dashboard` | `binnacle-dashboard` | открыть dashboard |
| `/binnacle:roadmap` | `binnacle-roadmap` | превратить видение или уже идущий проект в roadmap эпиков |
| `/binnacle:product` | `binnacle-product` | начать Product-сессию: где стоит проект и что дальше |
| `/binnacle:daily` | `binnacle-daily` | что изменилось с прошлого daily и что требует вашего внимания |
| `/binnacle:task` | `binnacle-task` | brief одного тикета; с `run <ticket>` — выполнить тикет |
| `/binnacle:answer` | `binnacle-answer` | ответить на вопрос, который агент оставил в тикете |
| `/binnacle:checkpoint` | `binnacle-checkpoint` | сохранить решения Product-сессии в документы проекта |
| `/binnacle:autopilot` | `binnacle-autopilot` | довести один спланированный эпик, по агенту на тикет |
| `/binnacle:help` | `binnacle-help` | какой навык когда использовать |

## MCP-сервер `binnacle`

`binn init` также предлагает зарегистрировать MCP-сервер `binnacle`, в собственном файле проекта, в Claude Code, Codex, opencode и VS Code. В любом другом harness или пока сервер не зарегистрирован навыки вызывают те же инструменты через `binn call <tool> [json]` в shell.

`binnacle-autopilot` работает только там, где harness умеет запускать фонового агента в собственном worktree. В остальных он сразу отказывается и ничего не меняет, а тикеты эпика выполняются вручную, по сессии на каждый.

Что нужно каждому harness:

- **Codex** читает `.codex/config.toml` проекта только в доверенном проекте (trusted project). Доверьте проект в Codex, иначе запись `binnacle` не будет видна. Десктопное приложение Codex ставит свой CLI вне `PATH`; на Linux это `/usr/lib/chatgpt/resources/codex`.
- **opencode** читает `opencode.json` или `opencode.jsonc` в проекте. Запустите `opencode` в корне репозитория.
- **VS Code** читает `.vscode/mcp.json`. Откройте репозиторий, запустите указанный там сервер `binnacle` и общайтесь в режиме агента (agent mode).
- **GLM** — модель, а не harness. Подключайте её через harness, например ZCode, Claude Code или opencode; адаптера GLM искать не нужно.
