# Binnacle

_English version: [README.md](README.md). Этот файл — русский дубликат; обновляется вместе с `README.md`._

**Одна память проекта. Любой coding agent.**
**Сегодня Claude, завтра Codex. Проект больше не начинается с нуля.**

**Binnacle** — локальный provider-agnostic **AI Engineering Control Plane**: сохраняемый контекст проекта, workflow и наблюдаемость поверх Claude Code, Codex, Gemini, GLM и других coding agents. Он хранит состояние проекта **вне чатов**, даёт свежим агентам компактный актуальный контекст, собирает telemetry по расходам и оставляет человека главным управляющим процессом.

> Нактоуз (binnacle) — тумба с компасом перед штурвалом. Он не рулит и не выбирает курс: он держит приборы там, где рулевой их видит. В этом всё техзадание.

## Что решаем

Современный AI-development быстро упирается не только в качество модели, но и в управление контекстом:

- длинные Product-сессии разрастаются и начинают дорого стоить;
- после compaction часть деталей теряется или искажается;
- новый Claude/Codex/GLM/Gemini заново исследует проект;
- разные агенты повторно читают одни и те же файлы;
- сложно понять, куда ушли токены, cache, tool calls и rework;
- при смене модели приходится вручную переносить контекст;
- параллельные агенты без контроля зависимостей создают merge-конфликты и дублируют работу.

Control Plane выносит состояние проекта в устойчивые источники: Git, Markdown-документацию, ADR, tracker и локальный reconstructable event/telemetry layer. Чат становится временным рабочим контекстом, а не памятью проекта.

## Основной принцип

> **Project knowledge и task state принадлежат проекту, а не конкретной модели, чату или coding harness.**

Claude Code, Codex, GLM, Gemini и будущие/local agents — сменяемые исполнители.

## Что входит в v1

- локальный daemon `binnd`;
- CLI `binn`;
- локальный MCP server;
- небольшой Web Dashboard на Nuxt;
- registry проектов;
- сущности Project / Task / AgentRun / Review;
- Product Snapshot и Daily Snapshot;
- checkpoint вместо conversation handoff;
- ingestion telemetry от coding agents — из session artifacts, которые они и так пишут на диск;
- GitHub/GitLab tracker adapters **только на чтение** + local markdown fallback;
- audit/adopt существующего проекта;
- интеграция с Matt Pocock Skills;
- интеграция с Ponytail;
- Serena, Graphify, Context7 и ast-grep как context/coding capabilities;
- Obsidian как human-facing projection Project Brain;
- manual-first execution: система рекомендует, человек запускает. Binnacle сам никогда не вызывает модель.

## Поддержка любого coding agent

Агенты сильно отличаются тем, что отдают наружу, поэтому поддержка градуированная, а не бинарная:

| Уровень | Что требуется | Что получает пользователь |
| --- | --- | --- |
| 1 — Context | агент умеет вызвать MCP server | память проекта: snapshots, задачи, checkpoints, вопросы и ответы |
| 2 — Attribution | пишет session artifact с рабочим каталогом и id сессии | привязка сессии к проекту, тайминги, история |
| 3 — Usage | в этом artifact есть счётчики токенов | аналитика расходов, стоимость, метрики переделок |
| 4 — Live | отдаёт наблюдаемый поток | что выполняется прямо сейчас |

**Уровня 1 достаточно, чтобы агент считался поддержанным, и адаптер для него не нужен.** Агент, вышедший завтра, получает память проекта в тот день, когда научится MCP. См. `docs/adr/ADR-0014-harness-support-levels.md`.

## Что НЕ входит в v1

- автономная «виртуальная компания» агентов;
- автоматический запуск Architect/QA/Security/Reviewer;
- автоматический model routing;
- собственный Git/task tracker/CI;
- Kubernetes/SRE/incident platform;
- полноценный Release Captain subsystem;
- LiteLLM как обязательный gateway;
- team/server mode;
- сложный AI optimization advisor;
- обязательная зависимость проекта от Binnacle.

## Стек

- **TypeScript** — весь собственный application code;
- **Node.js 24 LTS** — runtime baseline;
- **pnpm** — package manager / workspace;
- **Nuxt** — Web Dashboard;
- **`node:sqlite`** — локальный projection/cache, без нативных модулей и без шага сборки;
- **MCP** — agent-facing API и стабильный контракт для любого harness;
- **локальные session artifacts** — основной источник telemetry; OpenTelemetry — опциональное дополнение там, где harness его поддерживает;
- Markdown/YAML/JSON — переносимые форматы project knowledge/config.

Python/Go/Rust в собственном core не используем. Внешние инструменты могут иметь свой runtime (например Serena/Graphify), но Binnacle их только интегрирует.

## Установка

Binnacle поставляется через npm и требует Node 24. Работает нативно на Linux, macOS и Windows.

```bash
npm i -g @binnacle/cli
```

Daemon запускается как пользовательский процесс командой `binn daemon start`. Установка его как автозапускаемой службы в v1 не входит.

### Из этого репозитория

Пока npm-пакет не опубликован, `binn` берётся из checkout. Один раз поставьте его в PATH ссылкой — из основного checkout, а не из worktree:

```bash
pnpm install
cd apps/cli && pnpm link --global
```

Если у pnpm ещё нет глобального каталога для исполняемых файлов, сначала выполните `pnpm setup` и откройте новый shell. Затем запустите daemon командой `binn daemon start` и зарегистрируйте репозиторий командой `binn project register`.

Daemon также раздаёт dashboard только для чтения по своему адресу, по умолчанию `http://127.0.0.1:7717/`. Сгенерируйте его один раз в основном checkout командой `pnpm dashboard:generate` и снова — после pull изменения в `apps/dashboard`; до этого адрес отвечает страницей с этой командой. `binn dashboard` открывает dashboard в браузере по умолчанию, уже авторизованным, а `binn dashboard --print` печатает его адрес, ничего не открывая. После первого раза обычный адрес работает в этом браузере как закладка.

Ссылка запускает CLI из основного checkout, с его `node_modules`. Поэтому после pull или merge изменения, которое затрагивает workspace — новый пакет, изменённая зависимость, `pnpm-lock.yaml`, — снова выполните `pnpm install` в основном checkout. До этого пакета, который CLI теперь импортирует, там нет, `binn` падает с `ERR_MODULE_NOT_FOUND`, а с ним пропадают MCP-инструменты у каждой сессии. Установка в worktree не помогает: у каждого checkout свой `node_modules`.

Когда `binn init` установил plugin `binnacle`, Claude Code загружает здесь этот установленный `binnacle@binnacle`, а не skills из `.claude/skills/binnacle/`, поэтому влитое изменение этих skills само до новой сессии не доходит. После pull или merge такого изменения выполните в основном checkout первую команду ниже, а две другие — только если `claude plugin list --json` показывает `binnacle@binnacle`:

```bash
pnpm --filter @binnacle/cli run prepare
claude plugin marketplace update binnacle
claude plugin update binnacle@binnacle
```

Первая команда копирует skills в CLI-пакет и даёт plugin версию, вычисленную из файлов plugin, поэтому она меняется при каждом изменении skill; две другие заставляют Claude Code обновить свою копию до этой версии. Новая сессия затем загружает изменённые skills. `/binnacle:autopilot` делает это сам после каждого своего merge, который их изменил.

`pnpm setup` добавляет свой глобальный каталог для исполняемых файлов в PATH в файле запуска shell, например `~/.bashrc`, а desktop-приложение Claude Code этот файл не читает, поэтому в нём `.mcp.json` не находит `binn`. Сделайте `binn` видимым там скриптом-обёрткой с именем `binn`, исполняемым, в каталоге, который уже есть в PATH приложения, — в Linux это `~/.local/bin`:

```sh
#!/bin/sh
exec "$HOME/.local/share/pnpm/binn" "$@"
```

Путь — это глобальный каталог pnpm для исполняемых файлов, записанный явно, потому что `$PNPM_HOME` у приложения тоже нет: возьмите его из `echo $PNPM_HOME` в shell, где pnpm работает; по умолчанию в Linux это `~/.local/share/pnpm`. Символическая ссылка на `binn` из pnpm вместо обёртки не работает: этот файл — shim, который ищет CLI относительно своего расположения, и через ссылку он отсчитывает путь от каталога ссылки и ничего не находит.

Закоммиченный `.mcp.json` запускает `binn mcp`, поэтому у любой сессии Claude Code, открытой в этом репозитории — в основном checkout или в worktree, — есть MCP-инструменты Binnacle без настройки на каждую сессию. Он намеренно ссылается на слинкованный `binn`, а не на путь внутри рабочего дерева: в worktree такой путь запускал бы недописанный код этой ветки, и сломанная ветка отключала бы инструменты Product-сессии. Если daemon остановлен, сервер всё равно подключается, а каждый инструмент отвечает ошибкой с командой `binn daemon start`.

## Целевая структура репозитория

```text
binnacle/
├── apps/
│   ├── daemon/
│   ├── dashboard/
│   └── cli/
├── packages/
│   ├── core/
│   ├── mcp/
│   ├── telemetry/
│   └── adapters/
├── docs/
├── templates/
├── AGENTS.md
├── CLAUDE.md
└── CONTEXT.md
```

## Быстрый путь нового проекта

```text
idea / discussion
    ↓
initial Markdown docs
    ↓
binn init
    ↓
setup Matt Pocock Skills
    ↓
grill-with-docs
    ↓
to-spec
    ↓
to-tickets
    ↓
/product
    ↓
/task <id>
    ↓
Developer → Review → Merge
```

## Быстрый путь существующего проекта

```text
binn audit
    ↓
прочитать находки и рекомендации
    ↓
binn init
    ↓
/product
```

`binn audit [path]` читает репозиторий и печатает находки, текстом или с `--json`. Он ничего не пишет и не требует демона. В Claude Code `/binnacle:audit [path]` запускает его из чата и показывает находки там же, сначала пробелы. `binn init` — команда, которая пишет в репозиторий: она показывает один план и спрашивает один раз. Если их нет, план создаёт каталог задач, который читает локальный трекер, и заготовку `<knowledge.docs>/roadmap.md` в формате Binnacle, чьё Next action — `/grill-with-docs`, а новый манифест объявляет `knowledge.docs`; существующий roadmap никогда не переписывается, а не соответствующий формату называется в Summary и разбирается в `binn audit`. План также устанавливает недостающие Serena и Graphify (через `uv tool install`) и ast-grep (через npm), вне репозитория; инструмент, который уже есть в `PATH` или объявлен `false` в `capabilities`, не трогается, а без `uv` init называет команду, которая его ставит, и оставляет Serena и Graphify вне плана. Затем он регистрирует MCP-серверы Serena, Context7 и Graphify в каждом найденном харнессе через его собственный CLI и никогда в репозитории: уже зарегистрированный сервер не трогается, кроме Serena в пользовательском файле Codex с контекстом Claude Code, который он предлагает перерегистрировать с контекстом Codex, а там, где у харнесса нет такой команды, запись печатается. Если найден Claude Code, init устанавливает плагины Matt Pocock Skills и Ponytail через CLI плагинов Claude Code на уровне пользователя, если Claude Code их ещё не перечисляет; для любого другого харнесса его Summary говорит, где их взять. Если Obsidian перечисляет на этой машине ровно одно хранилище, а `~/.binnacle/settings.json` ещё не называет никакого, план записывает его туда, вне репозитория, как хранилище, в которое демон проецирует Project Brain; если хранилищ нет или их несколько, init называет найденные и говорит, как задать путь. Последним шагом, если Graphify найден или установлен, init добавляет `graphify-out/` в `.gitignore`, если Git его ещё не игнорирует, и строит первый граф командой `graphify extract . --code-only`, а затем его отчёт командой `graphify cluster-only . --no-label`; ни той, ни другой не нужны ни API-ключ, ни модель; неудачная сборка или отчёт попадает в Summary, а демон построит их позже.

Настройка работает и из чата, и из терминала. В Claude Code `/binnacle:init [path]` запускает `binn init --plan --json`, показывает в чате тот же план, каждый пункт целиком, вместе с историей сессий и окном импорта, которое он использует, и спрашивает один раз; назовите там другое окно, чтобы увидеть план с ним. Записывает его только ваше «да» в чате, через `binn init --apply <id>`, который отказывается от плана, изменившегося с момента показа, и тогда навык показывает новый план и спрашивает снова (ADR-0037). Навыку не нужен демон, и он никогда не коммитит: просмотрите и закоммитьте то, что записал init, сами, как после запуска в терминале. При остановленном демоне регистрация в план не входит, и `/binnacle:daemon start`, а затем `/binnacle:register` её добавляют. Когда init записывает `.mcp.json`, навык в конце говорит открыть новую сессию в репозитории и одобрить сервер `binnacle` проекта: Claude Code читает `.mcp.json` только при старте сессии. Навык доступен, когда плагин `binnacle` установлен, а это делает на уровне пользователя первый `binn init` на этой машине.

## Работа из другого harness

`binn init` предлагает зарегистрировать MCP-сервер `binnacle` для каждого найденного harness и в своём Summary печатает следующий шаг для каждого, кроме Claude Code. Навыки Binnacle устанавливаются только в Claude Code; любому другому агенту говорят прочитать файл навыка и следовать ему. Попросите его:

```text
read the Binnacle product skill file at <path> and follow it
```

`<path>` — это `.claude/skills/binnacle/skills/product/SKILL.md`, если проект несёт собственный плагин, иначе `plugin/skills/product/SKILL.md` в пакете Binnacle; Summary печатает тот, что подходит.

- **Codex** читает `.codex/config.toml` проекта только в доверенном проекте (trusted project). Доверьте проект в Codex, иначе запись `binnacle` не будет видна. Десктопное приложение Codex ставит свой CLI вне `PATH`; на Linux это `/usr/lib/chatgpt/resources/codex`.
- **opencode** читает `opencode.json` или `opencode.jsonc` в проекте. Запустите `opencode` в корне репозитория.
- **GLM** — модель, а не harness. Подключайте её через harness, например Claude Code или opencode; адаптера GLM искать не нужно.

## Документация

Начать читать в таком порядке:

1. `docs/00-scope.md`
2. `docs/01-architecture.md`
3. `docs/02-project-brain.md`
4. `docs/workflow/01-product-workflow.md`
5. `docs/workflow/02-development-workflow.md`
6. `docs/03-mcp-and-skills.md`
7. `docs/04-telemetry-dashboard.md`
8. `docs/05-mvp-plan.md`

Актуальные архитектурные решения зафиксированы в `docs/adr/`.

## Лицензия

Apache-2.0. См. `LICENSE`.
