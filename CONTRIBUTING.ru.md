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
│   ├── cli/
│   └── devcontainer-feature/
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

`binn dashboard` открывает dashboard, уже авторизованный, в браузере по умолчанию; `binn dashboard --print` печатает его адрес с токеном и ничего не открывает. После первого раза обычный адрес работает в этом браузере как закладка.

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

`pnpm typecheck`, `pnpm --filter @binnacle/dashboard typecheck` и `pnpm test` проверяют изменение. У dashboard свой typecheck: он остаётся на TypeScript 5.x, который нужен `vue-tsc`, а workspace работает на 7. `pnpm test` работает без сети. Живые тесты запускаются отдельно, командой `pnpm test:live`:

| Живой тест | Что ему нужно |
| --- | --- |
| тесты адаптеров | токены tracker только для чтения |
| тест автозапуска | настоящий менеджер служб; он ставит настоящую службу и поэтому запускается, только если задана `CI` |
| тест tarball | ничего, кроме `pnpm install`: он собирает, упаковывает и устанавливает пакет (*Релиз*, ниже) |
| тест dev container feature | `docker` и `devcontainer`, CLI dev container, в PATH, и сеть: он собирает контейнеры с feature и `binn` из npm (*Релиз*, ниже) |

CI работает в GitHub Actions на каждый push в `main` и на каждый pull request (`.github/workflows/ci.yml`), без каких-либо секретов:

- typecheck, typecheck dashboard и `pnpm test` — в Linux;
- живые тесты автозапуска и tarball — на раннерах Linux, macOS и Windows.

Живые тесты адаптеров, которым нужны токены, и тест dev container feature там не запускаются.

## Релиз

Binnacle публикуется в npm одним пакетом, `@it-bbox/binnacle`, чья версия — версия из `apps/cli/package.json` (ADR-0044). Собственные пакеты workspace остаются приватными.

1. **Версия.** Поднимите `version` в `apps/cli/package.json` для каждого релиза после `0.1.0`: npm никогда не принимает одну версию дважды.
2. **Проверка.** `pnpm install`, затем `pnpm typecheck` и `pnpm test`.
3. **Сборка.** `pnpm --filter @binnacle/cli build` сама запускает `nuxt generate` и пишет пакет в `apps/cli/dist/`:
   - `bin/binn.js` и `bin/binnd.js`, собранные со всеми зависимостями;
   - `dashboard/`, сгенерированный dashboard;
   - `plugin/` и `.claude-plugin/marketplace.json`, plugin и его marketplace;
   - `skills/`, копию `binnacle-<action>` для других harness;
   - `LICENSE`, `README.md` и `package.json`, который пишет сборка.
4. **Тест tarball.** `node --test apps/cli/test/tarball.live.ts` собирает пакет, выполняет `npm pack`, устанавливает tarball в пустой префикс с временными `HOME` и `BINNACLE_HOME` и проверяет установленные команды. После установки workspace сеть ему не нужна. Job `tarball-live` в CI запускает его на трёх платформах; публикуйте, только когда этот job зелёный на голове `main`.
5. **Публикация.** Владелец публикует вручную, чтобы токен npm не лежал в CI. npm публикует только с аккаунта, на котором включена двухфакторная аутентификация; без неё `npm publish` падает с `E403`. С ней `npm publish` запрашивает второй фактор в браузере: откройте ссылку, которую он печатает, и подтвердите там. Не входите по коду восстановления: он ставит аккаунт на 72-часовую блокировку, и до её конца публиковать нельзя.

```bash
npm login
cd apps/cli/dist
npm publish --access public
```

Затем `npm view @it-bbox/binnacle version` печатает опубликованную версию. Новый пакет несколько минут может показывать `0.0.0-stage` как `latest`, прежде чем появится его версия: подождите и проверьте снова. Чтобы установить его из реестра, следуйте [чек-листу установки](docs/operations/05-installation-checklist.ru.md).

### Dev container feature

Dev container feature, `apps/devcontainer-feature/src/binnacle/`, публикуется в GitHub Container Registry как `ghcr.io/it-bbox/binnacle/binnacle` — владельцем и вручную, как и npm. Она ставит `@it-bbox/binnacle` из npm, поэтому публикуйте её после того релиза npm, который ей нужен.

1. **Версия.** У feature своя версия, `version` в `devcontainer-feature.json`, отдельная от версии npm. Поднимайте её, только когда меняются файлы feature: patch — за исправление, minor — за новую опцию, major — когда опция или заданная ею переменная переименована или удалена либо значение по умолчанию меняет то, что получает контейнер. Новый релиз npm сам по себе ничего не двигает: значение опции `version` по умолчанию, `latest`, подхватит его при следующей сборке контейнера. `devcontainer features publish` пропускает уже опубликованную версию, так что изменение без поднятой версии не публикуется никогда.
2. **Проверка.** С установленными `docker` и CLI dev container (`npm install -g @devcontainers/cli`) команда `node --test apps/cli/test/devcontainer.live.ts` собирает контейнеры с feature из этого checkout и `binn` из npm, поэтому запускайте её, когда этот релиз npm уже вышел: `binn` запускается, демон отвечает на `/health`, его home лежит на volume, а контейнер, остановленный и запущенный снова, снова запускает демон. Под Docker Desktop в Linux запускайте её с `TMPDIR` внутри домашнего каталога, например `TMPDIR=~/.cache/binnacle-live`: его ВМ ничего не монтирует из `/tmp`.
3. **Публикация.** Войдите в `ghcr.io` с токеном GitHub, у которого есть `write:packages`, затем опубликуйте коллекцию; CLI ставит теги версии, её minor, её major и `latest`:

```bash
docker login ghcr.io -u <github-user>
devcontainer features publish --registry ghcr.io --namespace it-bbox/binnacle apps/devcontainer-feature/src
```

Если `docker login` не может сохранить токен, как при конфиге Docker с пустым хранилищем `pass`, передайте его CLI напрямую: `DEVCONTAINERS_OCI_AUTH="ghcr.io|<github-user>|$(gh auth token)" devcontainer features publish …`, предварительно выполнив `gh auth refresh -h github.com -s write:packages`.

Новый пакет в `ghcr.io` приватный. Один раз, после первой публикации, сделайте `binnacle/binnacle` публичным в пакетах организации на GitHub, иначе ни один контейнер не сможет его скачать; сначала организация должна разрешить публичные пакеты в своих настройках *Packages*. Затем `devcontainer features info manifest ghcr.io/it-bbox/binnacle/binnacle:1` печатает то, что опубликовано.

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
