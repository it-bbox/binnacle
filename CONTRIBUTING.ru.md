# Участие в разработке

_English version: [CONTRIBUTING.md](CONTRIBUTING.md). Этот файл — русский дубликат; обновляется вместе с `CONTRIBUTING.md`._

Эта страница — для разработки самого Binnacle. Чтобы пользоваться Binnacle, достаточно установки из [README](README.ru.md). Каждый агент, работающий в этом репозитории, следует [AGENTS.md](AGENTS.md).

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

## Структура репозитория

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

Границы каждого пакета описаны в [docs/07-initial-repository-layout.md](docs/07-initial-repository-layout.md).

## Из этого репозитория

Для разработки Binnacle `binn` берётся из checkout. Один раз поставьте его в PATH ссылкой — из основного checkout, а не из worktree:

```bash
pnpm install
cd apps/cli && pnpm link --global
```

Если у pnpm ещё нет глобального каталога для исполняемых файлов, сначала выполните `pnpm setup` и откройте новый shell. Затем запустите daemon командой `binn daemon start` и зарегистрируйте репозиторий командой `binn project register`.

Daemon также раздаёт dashboard только для чтения по своему адресу, по умолчанию `http://127.0.0.1:7717/`. Сгенерируйте его один раз в основном checkout командой `pnpm dashboard:generate` и снова — после pull изменения в `apps/dashboard`; до этого адрес отвечает страницей с этой командой. `binn dashboard` открывает dashboard в браузере по умолчанию, уже авторизованным, а `binn dashboard --print` печатает его адрес, ничего не открывая. После первого раза обычный адрес работает в этом браузере как закладка.

### После pull или merge

Ссылка запускает CLI из основного checkout, с его `node_modules`. Поэтому после pull или merge изменения, которое затрагивает workspace — новый пакет, изменённая зависимость, `pnpm-lock.yaml`, — снова выполните `pnpm install` в основном checkout. До этого пакета, который CLI теперь импортирует, там нет, `binn` падает с `ERR_MODULE_NOT_FOUND`, а с ним пропадают MCP-инструменты у каждой сессии. Установка в worktree не помогает: у каждого checkout свой `node_modules`.

Когда `binn init` установил plugin `binnacle`, Claude Code загружает здесь этот установленный `binnacle@binnacle`, а не skills из `.claude/skills/binnacle/`, поэтому влитое изменение этих skills само до новой сессии не доходит. После pull или merge такого изменения выполните в основном checkout первую команду ниже, а две другие — только если `claude plugin list --json` показывает `binnacle@binnacle`:

```bash
pnpm --filter @binnacle/cli run prepare
claude plugin marketplace update binnacle
claude plugin update binnacle@binnacle
```

Первая команда копирует skills в CLI-пакет и даёт plugin версию, вычисленную из файлов plugin, поэтому она меняется при каждом изменении skill; две другие заставляют Claude Code обновить свою копию до этой версии. Все остальные harness работают с копией `binnacle-<action>`, которую тоже пишет первая команда, поэтому, если в `~/.agents/skills` есть навык `binnacle-*`, установите заново и эту копию, а из Claude Code уберите её снова, назвав после `claude-code` и каждый harness, который вы не пускаете к ней через `binn init --skip-harness`:

```bash
npx skills add ./apps/cli/skills -g -y
npx skills remove -g -a claude-code -s $(ls apps/cli/skills) -y
```

Новая сессия затем загружает изменённые skills. `/binnacle:autopilot` делает это сам один раз, после последнего merge прогона, если его merge их изменили.

## Проверка изменения

`pnpm typecheck` и `pnpm test` проверяют изменение. `pnpm test` работает без сети; живые тесты запускаются отдельно командой `pnpm test:live`: тесты адаптеров, которым нужны токены только для чтения, и тест автозапуска, который ставит настоящую службу и поэтому запускается, только если задана `CI`. CI запускает typecheck и тесты в GitHub Actions на каждый push в `main` и на каждый pull request (`.github/workflows/ci.yml`), без каких-либо секретов, а значит без живых тестов адаптеров, и живой тест автозапуска с настоящим менеджером служб на раннерах Linux, macOS и Windows.

## binn в desktop-приложении Claude Code

`pnpm setup` добавляет свой глобальный каталог для исполняемых файлов в PATH в файле запуска shell, например `~/.bashrc`, а desktop-приложение Claude Code этот файл не читает, поэтому в нём `.mcp.json` не находит `binn`. Сделайте `binn` видимым там скриптом-обёрткой с именем `binn`, исполняемым, в каталоге, который уже есть в PATH приложения, — в Linux это `~/.local/bin`:

```sh
#!/bin/sh
exec "$HOME/.local/share/pnpm/binn" "$@"
```

Путь — это глобальный каталог pnpm для исполняемых файлов, записанный явно, потому что `$PNPM_HOME` у приложения тоже нет: возьмите его из `echo $PNPM_HOME` в shell, где pnpm работает; по умолчанию в Linux это `~/.local/share/pnpm`. Символическая ссылка на `binn` из pnpm вместо обёртки не работает: этот файл — shim, который ищет CLI относительно своего расположения, и через ссылку он отсчитывает путь от каталога ссылки и ничего не находит.

## `.mcp.json` репозитория

Закоммиченный `.mcp.json` запускает `binn mcp`, поэтому у любой сессии Claude Code, открытой в этом репозитории — в основном checkout или в worktree, — есть MCP-инструменты Binnacle без настройки на каждую сессию. Он намеренно ссылается на слинкованный `binn`, а не на путь внутри рабочего дерева: в worktree такой путь запускал бы недописанный код этой ветки, и сломанная ветка отключала бы инструменты Product-сессии. Если daemon остановлен, сервер всё равно подключается, а каждый инструмент отвечает ошибкой с командой `binn daemon start`.
