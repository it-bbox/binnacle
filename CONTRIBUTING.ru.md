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

Daemon также раздаёт dashboard только для чтения по своему адресу, по умолчанию `http://127.0.0.1:7717/`. При работе из checkout сгенерируйте его один раз в основном checkout командой `pnpm dashboard:generate` и снова — после pull изменения в `apps/dashboard`. До этого адрес отвечает страницей с этой командой.

`binn dashboard` открывает dashboard в браузере по умолчанию, уже авторизованным; `binn dashboard --print` печатает его адрес с токеном и ничего не открывает. После первого раза обычный адрес работает в этом браузере как закладка.

### После pull или merge

Ссылка запускает CLI из основного checkout, с его `node_modules`. Поэтому после pull или merge изменения, которое затрагивает workspace — новый пакет, изменённая зависимость, `pnpm-lock.yaml`, — снова выполните `pnpm install` в основном checkout.

До этого пакета, который CLI теперь импортирует, там нет: `binn` падает с `ERR_MODULE_NOT_FOUND`, а с ним пропадают MCP-инструменты у каждой сессии. Установка в worktree не помогает, потому что у каждого checkout свой `node_modules`.

Когда `binn init` установил plugin `binnacle`, Claude Code загружает здесь этот установленный `binnacle@binnacle`, а не skills из `.claude/skills/binnacle/`, поэтому влитое изменение этих skills само до новой сессии не доходит. После pull или merge такого изменения выполните в основном checkout первую команду ниже, а две другие — только если `claude plugin list --json` показывает `binnacle@binnacle`:

```bash
pnpm --filter @binnacle/cli run prepare
claude plugin marketplace update binnacle
claude plugin update binnacle@binnacle
```

Первая команда копирует skills в CLI-пакет и даёт plugin версию, вычисленную из файлов plugin, поэтому она меняется при каждом изменении skill. Две другие заставляют Claude Code обновить свою копию до этой версии.

Все остальные harness работают с копией `binnacle-<action>`, которую тоже пишет первая команда. Поэтому, если в `~/.agents/skills` есть навык `binnacle-*`, установите заново и эту копию, а из Claude Code уберите её снова. После `claude-code` назовите и каждый harness, который вы не пускаете к ней через `binn init --skip-harness`:

```bash
npx skills add ./apps/cli/skills -g -y
npx skills remove -g -a claude-code -s $(ls apps/cli/skills) -y
```

Новая сессия затем загружает изменённые skills. `/binnacle:autopilot` делает это сам один раз, после последнего merge прогона, если его merge их изменили.

## Проверка изменения

`pnpm typecheck` и `pnpm test` проверяют изменение; `pnpm test` работает без сети. Живые тесты запускаются отдельно, командой `pnpm test:live`:

| Живой тест | Что ему нужно |
| --- | --- |
| тесты адаптеров | токены tracker только для чтения |
| тест автозапуска | настоящий менеджер служб; он ставит настоящую службу и поэтому запускается, только если задана `CI` |
| тест tarball | ничего, кроме `pnpm install`: он собирает, упаковывает и устанавливает пакет (*Релиз*, ниже) |

CI работает в GitHub Actions на каждый push в `main` и на каждый pull request (`.github/workflows/ci.yml`), без каких-либо секретов:

- typecheck и `pnpm test` — в Linux;
- живые тесты автозапуска и tarball — на раннерах Linux, macOS и Windows.

Живые тесты адаптеров, которым нужны токены, там не запускаются.

## Релиз

Binnacle публикуется в npm одним пакетом, `@it-bbox/binnacle`, чья версия — версия из `apps/cli/package.json` (ADR-0044). Собственные пакеты workspace остаются приватными.

1. **Проверка.** `pnpm install`, затем `pnpm typecheck` и `pnpm test`.
2. **Сборка.** `pnpm --filter @binnacle/cli build` пишет пакет в `apps/cli/dist/`: `binn` и `binnd`, собранные со всеми зависимостями, сгенерированный dashboard, plugin и его marketplace, копию skills, `LICENSE`, README и его `package.json`. `nuxt generate` она запускает сама.
3. **Тест tarball.** `node --test apps/cli/test/tarball.live.ts` собирает пакет, выполняет `npm pack`, устанавливает tarball в пустой префикс с временными `HOME` и `BINNACLE_HOME` и проверяет установленные команды. После установки workspace сеть ему не нужна. Job `tarball-live` в CI запускает его на трёх платформах; публикуйте, только когда этот job зелёный на голове `main`.
4. **Публикация.** Владелец публикует вручную, чтобы токен npm не лежал в CI:

```bash
npm login
cd apps/cli/dist
npm publish --access public
```

Затем `npm view @it-bbox/binnacle version` печатает опубликованную версию. Чтобы установить его из реестра, следуйте [чек-листу установки](docs/operations/05-installation-checklist.ru.md).

## binn в desktop-приложении Claude Code

`pnpm setup` добавляет свой глобальный каталог для исполняемых файлов в PATH в файле запуска shell, например `~/.bashrc`, а desktop-приложение Claude Code этот файл не читает, поэтому в нём `.mcp.json` не находит `binn`. Сделайте `binn` видимым там скриптом-обёрткой с именем `binn`, исполняемым, в каталоге, который уже есть в PATH приложения, — в Linux это `~/.local/bin`:

```sh
#!/bin/sh
exec "$HOME/.local/share/pnpm/binn" "$@"
```

Путь — это глобальный каталог pnpm для исполняемых файлов, записанный явно, потому что `$PNPM_HOME` у приложения тоже нет: возьмите его из `echo $PNPM_HOME` в shell, где pnpm работает; по умолчанию в Linux это `~/.local/share/pnpm`.

Символическая ссылка на `binn` из pnpm вместо обёртки не работает: этот файл — shim, который ищет CLI относительно своего расположения, и через ссылку он отсчитывает путь от каталога ссылки и ничего не находит.

## `.mcp.json` репозитория

Закоммиченный `.mcp.json` запускает `binn mcp`, поэтому у любой сессии Claude Code, открытой в этом репозитории — в основном checkout или в worktree, — есть MCP-инструменты Binnacle без настройки на каждую сессию.

Он намеренно ссылается на слинкованный `binn`, а не на путь внутри рабочего дерева: в worktree такой путь запускал бы недописанный код этой ветки, и сломанная ветка отключала бы инструменты Product-сессии. Если daemon остановлен, сервер всё равно подключается, а каждый инструмент отвечает ошибкой с командой `binn daemon start`.
