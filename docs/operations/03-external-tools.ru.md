# Внешние инструменты

_English version: [03-external-tools.md](03-external-tools.md). Этот файл — русский дубликат; обновляется вместе с `03-external-tools.md`._

Binnacle интегрирует эти инструменты, но не встраивает ни один из них и работает без любого из них ([Безопасность и устойчивость](04-security-resilience.ru.md#плавная-деградация)). `binn init` устанавливает и регистрирует их в своём одном плане с одним подтверждением (ADR-0034). Эта страница говорит, что он запускает и как сделать то же самое вручную.

## Инструменты коротко

| Инструмент | Для чего | Как его настраивает `binn init` |
| --- | --- | --- |
| Matt Pocock Skills | Грилинг плана, написание спеки, нарезка её на тикеты | CLI плагинов Claude Code; CLI `skills` для других harness |
| Ponytail | Политика кодирования против переусложнения | CLI плагинов Claude Code; CLI `skills` для других harness |
| Serena | Навигация и правка кода на уровне символов, через MCP | `uv tool install`, затем его MCP-сервер в каждом harness |
| Graphify | Граф архитектуры, для межмодульного влияния и путей | `uv tool install`, его MCP-сервер для этого проекта, первый граф |
| Context7 | Актуальная документация внешних библиотек, фреймворков и API | его MCP-сервер в каждом harness; ставить нечего |
| ast-grep | Синтаксический структурный поиск и codemods | `npm i -g` |
| Obsidian | Представление знаний проекта для человека | не ставится никогда; init задаёт хранилище, если Obsidian перечисляет ровно одно |

## Что устанавливает `binn init`

Инструменты, которые являются исполняемыми файлами, ставятся вне репозитория и только через менеджер пакетов (ADR-0035):

| Инструмент | Как обнаруживается | Что нужно заранее | Команда установки |
| --- | --- | --- | --- |
| Serena | `serena` в `PATH` | `uv` | `uv tool install -p 3.13 serena-agent` |
| Graphify | `graphify` в `PATH` | `uv` | `uv tool install graphifyy` |
| ast-grep | `ast-grep` в `PATH` (никогда не `sg`) | `npm` | `npm i @ast-grep/cli -g --allow-scripts=@ast-grep/cli` |

- Инструмент, который уже есть в `PATH`, отмечается как найденный и не трогается.
- Инструмент, который манифест объявляет `false` в `capabilities`, не предлагается.
- Недостающая предпосылка называется вместе с командой, которая её ставит, а зависящие от неё инструменты не входят в план. Init никогда не ставит `uv` и никогда не запускает скрипт-установщик.
- Каждая установка попадает в Summary; неудачная не останавливает остальные.
- Манифест, который создаёт init, объявляет `true` в `capabilities` для каждого инструмента, который он установил или нашёл.

Таблица — это `apps/cli/src/tools.ts`, её читает и `binn audit`.

### Плагины навыков, которые он устанавливает

Matt Pocock Skills и Ponytail поставляются как плагины Claude Code. Init ставит их через CLI плагинов Claude Code, на уровне пользователя, так же как плагин `binnacle`:

| Набор навыков | Capability | Как обнаруживается | Команды установки |
| --- | --- | --- | --- |
| Matt Pocock Skills | `matt_pocock_skills` | `claude plugin list --json` показывает `mattpocock-skills@…` | `claude plugin install mattpocock-skills@claude-plugins-official --scope user`, из официального marketplace Claude Code |
| Ponytail | `ponytail` | `claude plugin list --json` показывает `ponytail@…` | `claude plugin marketplace add DietrichGebert/ponytail --scope user`, затем `claude plugin install ponytail@ponytail --scope user` |

- Claude Code спрашивают о его плагинах один раз — и об этих, и о плагине `binnacle`.
- Плагин, который он уже показывает, из любого marketplace, отмечается как найденный и не трогается.
- Набор навыков, объявленный `false` в `capabilities`, не предлагается ни одному harness.
- Если Claude Code не найден или `claude` нет в `PATH`, никакой плагин не ставится, и Summary говорит почему.
- Манифест, который создаёт init, объявляет `true` для набора, который он установил или нашёл.

Ещё init пишет соглашения, которые читают Matt Pocock Skills, каждое только там, где его нет, так что `/setup-matt-pocock-skills` запускать не нужно (ADR-0042):

- `docs/agents/issue-tracker.md` для найденного tracker, с заголовком тикета;
- `docs/agents/triage-labels.md` и `docs/agents/domain.md`;
- блок *Agent skills*, который на них ссылается, в `AGENTS.md` или в `CLAUDE.md`, если есть только он.

### Во все остальные harness

Все остальные harness получают оба набора так же, как до них доходят собственные навыки Binnacle (ADR-0039), если `binn` нашёл хотя бы один. Для каждого набора план выполняет:

1. `npx skills add <repository> -g -y --json`, из `mattpocock/skills` или `DietrichGebert/ponytail`;
2. `npx skills remove -g -a claude-code [<skipped harness ids>] -s <each skill the add installed> -y`, так как у Claude Code остаётся плагин.

Навыки для удаления план показывает заполнителем: это те, что перечисляет JSON команды add. Без `npx` в `PATH` обе команды печатаются вместо выполнения.

Результат add читается по тому, что он установил, а не только по коду выхода:

- CLI `skills` выходит с ненулевым кодом, когда не удался один harness, например PromptScript, у которого нет глобальной установки, хотя в остальные он навыки ставит. Тогда init спрашивает `npx skills list -g --json`, удаляет из Claude Code навыки набора, которые тот показывает, а Summary называет причину, которую дал add.
- Add, который ничего не установил, записывается как неудачный, его удаление пропускается, и Summary это говорит.

### MCP-серверы, которые он регистрирует

После установок init регистрирует MCP-сервер каждого инструмента в каждом найденном harness, через собственный CLI harness, вне репозитория:

| Сервер | Запускается командой | Уровень |
| --- | --- | --- |
| Serena | `serena start-mcp-server`, с контекстом Serena для harness (`claude-code`, `codex`, `vscode`) и `--project-from-cwd` для CLI-harness | пользователь |
| Context7 | `npx -y @upstash/context7-mcp` (нужен `npm`) | пользователь |
| Graphify | `uv run --no-project --with 'graphifyy[mcp]' python -m graphify.serve <project>/graphify-out/graph.json` | только этот проект |

| Harness | Регистрируется через | Сервер Graphify |
| --- | --- | --- |
| Claude Code | `claude mcp add --scope user <name> -- <command>` | `claude mcp add --scope local …`, хранится в `~/.claude.json` для этого проекта |
| Codex | `codex mcp add <name> -- <command>`, в `~/.codex/config.toml` | печатается: Codex не хранит серверов отдельного проекта вне репозитория |
| VS Code | `code --add-mcp '{"name":…,"command":…,"args":[…]}'`, в профиль пользователя | печатается, по той же причине |
| opencode | печатается: его `opencode mcp add` — интерактивный мастер | печатается |

- Сервер, уже зарегистрированный в harness, отмечается и не трогается. Init читает файлы репозитория и пользовательские файлы Claude Code, Codex и профиля по умолчанию VS Code.
- Одно исключение: Serena в пользовательском файле Codex (`~/.codex/config.toml`) с контекстом Claude Code (`--context=claude-code`). План регистрирует её заново с `--context=codex`, и `codex mcp add` записывает это поверх старой записи, по «да» владельца.
- Та же запись в `.codex/config.toml` репозитория принадлежит владельцу: она не трогается, а Summary называет её контекст.
- Harness, чьего CLI нет в `PATH`, получает запись напечатанной, и Summary это говорит.
- Инструмент, объявленный `false` или оставленный вне плана из-за недостающей предпосылки, не регистрируется. Не регистрируется и сервер Graphify без `uv`, даже если `graphify` найден.

Init не пишет MCP-записи этих инструментов в репозиторий. Сервер Graphify запускается в собственном окружении с extra `mcp`, поэтому его установка остаётся просто `graphifyy`.

### Первый граф, который он строит

Последним в плане init строит первый граф проекта, чтобы проект выходил из `binn init` уже с ним:

1. `graphify-out/` дописывается в `.gitignore`, или `.gitignore` создаётся с ним (ADR-0026). Если Git уже игнорирует `graphify-out/graph.json`, `.gitignore` не трогается.
2. В корне репозитория запускается `graphify extract . --code-only --allow-dedup-shrink`: только код, локальные синтаксические деревья, без API-ключа и без модели (ADR-0012). `--allow-dedup-shrink` разрешает записать граф, который дедупликация сделала меньше; граф — пересобираемая проекция (ADR-0036).
3. После успешного извлечения `graphify cluster-only . --no-label` пишет отчёт Graphify, `graphify-out/GRAPH_REPORT.md`. `--no-label` не даёт ему вызывать модель, чтобы назвать сообщества.

Позже демон запускает те же две команды (*Graphify*, ниже). Шаги входят в план, только если Graphify есть в `PATH` или ставится тем же планом, а `capabilities.graphify` не `false`.

- Сборка и отчёт пропускаются, и Summary говорит почему, если к этому моменту Git всё ещё не игнорирует `graphify-out/` или `graphify` нет в `PATH` после его установки.
- Каждый шаг останавливается по истечении десятиминутного предела демона на один шаг.
- Неудачная сборка или отчёт попадает в Summary с последней строкой stderr от Graphify, а остальной план выполнен. Неудачный отчёт сохраняет граф, записанный извлечением.
- Когда проект зарегистрирован и `graphify` запускается, демон строит граф при одном из следующих опросов.

## Каждый инструмент

### Matt Pocock Skills

Поток проектирования: `/grill-with-docs` → `/to-spec` → `/to-tickets`. Binnacle обнаруживает и настраивает эти навыки, но не зашивает их внутреннее устройство. Единственное исключение — файлы соглашений, которые пишет `binn init`: в той форме, в какой их пишет `/setup-matt-pocock-skills`, чтобы навыки читали их как свои (ADR-0042).

### Ponytail

Политика кодирования, которая держит изменения маленькими: никаких абстракций впрок, самое простое из того, что работает. Считайте его политикой, а не оптимизатором токенов. Рекомендуемый уровень — `full`.

### Serena

Поиск и правка на уровне символов через language server, по MCP. Binnacle проверяет, что Serena есть, но никогда не проксирует её операции.

### Graphify

Upstream-пакет называется `graphifyy`, его команда — `graphify`. Его граф отвечает на вопросы о межмодульной архитектуре и влиянии, а его отчёт становится заметкой `90-Graphify` в хранилище. Graphify остаётся опциональным и заменяемым.

`graphify` 0.9.76, актуальный на момент написания, принимает `--allow-dedup-shrink`. Версия, которая не знает этого флага, пропускает его, как пропускает любой незнакомый аргумент. Его MCP-серверу нужен extra `mcp`, который регистрация init получает через `uv run --with 'graphifyy[mcp]'`.

Демон держит граф актуальным (ADR-0036). Раз в минуту он читает коммит ветки по умолчанию каждого зарегистрированного проекта, `origin/HEAD` или `main`. Когда ветка ушла дальше последнего запуска, он запускает извлечение, а затем отчёт, как это делает `binn init`, в фоне, в зарегистрированном checkout. Запуск идёт, только пока:

- этот checkout на ветке по умолчанию;
- `capabilities.graphify` не `false`;
- `graphify` есть в `PATH` демона;
- Git игнорирует `graphify-out/`.

На проект идёт один запуск за раз и не больше одного в очереди, так что серия merge стоит двух запусков. Каждый исход записывается как событие, которое читают раздел `graph` в snapshot и его пункты внимания (`docs/03-mcp-and-skills.md`). Неудачный запуск, в том числе неудачный отчёт, сохраняет последний хороший граф и повторяется при следующем движении ветки, а не каждую минуту.

Не пускайте в граф сгенерированные и сторонние каталоги, например:

```text
.scratch/
node_modules/
.nuxt/
.output/
dist/
coverage/
```

### Context7

Актуальная документация внешних библиотек, фреймворков и API для конкретных версий; никогда — для собственной логики проекта. У пользователя он уже может быть настроен: init сначала читает файлы harness и регистрирует его только в том harness, где его нет. API-ключ, если он у вас есть, добавляется в эту запись вручную.

### ast-grep

Структурный синтаксический поиск и codemods, для больших механических изменений, где текстовый поиск небезопасен. Навигацию Serena по символам он не заменяет.

### Obsidian

Представление проекта для человека: ссылки, заметки и отчёт Graphify. Он опционален и никогда не является каноническим хранилищем. `binn init` не ставит ни Obsidian, ни хранилище.

Хранилище — это `obsidian.vaultPath` в файле настроек этой машины, `~/.binnacle/settings.json`, вне любого репозитория. `binn init` предлагает его, когда собственный список Obsidian на этой машине содержит ровно одно хранилище, а иначе говорит, как его задать. Затем демон проецирует каждый проект в хранилище:

```text
Vault/
└── Projects/
    └── <Project>/
        ├── Product/       roadmap, last snapshot, last daily
        ├── Specs/
        ├── Decisions/
        ├── Research/
        └── 90-Graphify/   Graphify's report
```

Настройки и проекция целиком: [Чек-лист установки](05-installation-checklist.ru.md#опционально-obsidian), *Опционально: Obsidian*.

### OpenTelemetry

Binnacle пользуется собственным экспортом OpenTelemetry каждого harness, где он есть, и записывает только то, что harness сообщает. Его настраивает `binn init`: [Чек-лист установки](05-installation-checklist.ru.md#экспорт-телеметрии), *Экспорт телеметрии*.

## Harness и provider

Harness — это клиент для работы с кодом; provider — бэкенд, который отдаёт ему модель. Binnacle различает harness, provider, модель и профиль запуска, поэтому один harness может работать с разными provider ([CONTEXT.md](../../CONTEXT.md)).

## Вручную, без `binn init`

Собственные команды upstream, актуальные на момент написания; установщики меняются, так что сверяйтесь с документацией каждого проекта:

| Инструмент | Harness | Команды |
| --- | --- | --- |
| Matt Pocock Skills | Claude Code | `claude plugin install mattpocock-skills@claude-plugins-official` |
| Matt Pocock Skills | другие harness | `npx skills@latest add mattpocock/skills` |
| Ponytail | Claude Code | `/plugin marketplace add DietrichGebert/ponytail`, затем `/plugin install ponytail@ponytail` |
| Ponytail | Codex | `codex plugin marketplace add DietrichGebert/ponytail`, затем `codex plugin add ponytail@ponytail` |
| Ponytail | Gemini CLI | `gemini extensions install https://github.com/DietrichGebert/ponytail` |
| Serena | любой | `uv tool install -p 3.13 serena-agent`, затем `serena init` |
| Graphify | любой | `uv tool install graphifyy`, затем `graphify install --project` для интеграций с ассистентами |
| Context7 | любой | MCP-сервер `@upstash/context7-mcp` |
| ast-grep | любой | `npm i @ast-grep/cli -g --allow-scripts=@ast-grep/cli`; проверка — `ast-grep --help` |

Установка в одном harness не покрывает другой: каждому harness нужна своя.
