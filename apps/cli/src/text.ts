import { wordMessage, type Language, type Params } from '@binnacle/core';
import { LANGUAGE } from './language.ts';

/**
 * `binn`'s own text in the person's language (spec `human-output`, *`binn`'s own text*): the usage,
 * `binn call --help`'s prose, `binn daemon`, `binn project` and `binn dashboard`, with `CONTEXT.md`'s
 * Russian words. Commands, flags, paths, ids and environment variables are never translated.
 * `binn mcp`, `binn call`'s output and every `--json` stay English and do not come from here.
 */
const en = {
  usage: `binn — Binnacle, a local AI engineering control plane.

Usage:
  binn init [--window <days|all>] [--language <en|ru>] [--autostart <yes|no>] [--mod <yes|no>] [--skip-harness <id>]... [path]
                        Set up the Git repository containing path (default: the working directory):
                        show the whole plan and ask once before writing; it never overwrites a file
                        and never commits. --window sets the history import window without asking;
                        --language answers the repository's documentation language, en or ru;
                        --autostart answers whether the daemon starts at login, where it is asked;
                        --skip-harness keeps Binnacle's skills out of that skills CLI harness id
  binn init --plan --json [--window <days|all>] [--language <en|ru>] [--autostart <yes|no>] [--mod <yes|no>] [--skip-harness <id>]... [path]
                        Print that plan and its id as JSON, writing, running and asking nothing
  binn init --apply <id> [--window <days|all>] [--language <en|ru>] [--autostart <yes|no>] [--mod <yes|no>] [--skip-harness <id>]... [path]
                        Write the plan whose id is <id>, as a confirmed run does, without asking;
                        if the plan is no longer that one, write nothing and exit 3

  binn audit [path] [--json]
                        Read-only findings on the Git repository containing path: what is in place,
                        what is missing and what cannot be told, each with a recommendation

  binn daemon start     Start the Binnacle daemon on loopback
  binn daemon status    Report whether a daemon is running, and where
  binn daemon stop      Stop the daemon and remove its runtime file
  binn daemon autostart [on|off]
                        Turn on or off the daemon's start at login, through your own service manager
                        (a systemd user unit on Linux), or say whether it is on, off or broken

  binn project register [path]    Register a repository (default: the working directory)
  binn project list               List the projects this machine tracks
  binn project status [path]      Manifest facts and live Git facts for the project containing path
  binn project unregister [path]  Remove a registration, changing nothing in the repository

  binn dashboard        Open the dashboard in the default browser, already authorised, and print
                        its address without the token
  binn dashboard --print  Print the dashboard's address, with the token, without opening it

  binn mcp              Serve Binnacle's MCP tools on stdio for the working directory
  binn call <tool> [json]
                        Call one of those tools for the working directory, with its arguments as one
                        JSON object, and print what it returns as JSON: for a harness without
                        Binnacle's MCP server. binn call --help lists the tools and their arguments

Options:
  -h, --help            Show this help
  -v, --version         Show the CLI version

Environment:
  BINNACLE_HOME         Binnacle home directory (default: ~/.binnacle)
  BINNACLE_PORT         Port the daemon binds (default: 7717; 0 takes an ephemeral port)
  BINNACLE_HOST         Address the daemon binds: 127.0.0.1, the default, or 0.0.0.0 inside a container
  BINNACLE_ALLOWED_HOSTS  Comma-separated host:port values the daemon accepts as Host beyond its own
                        address, such as 127.0.0.1:7718,localhost:7718 (default: none)
  BINNACLE_GIT_TIMEOUT_MS  Longest a single git call may take before Git facts are unavailable (default: 5000)
  LC_ALL, LANG          binn speaks Russian when the first one set starts with ru, English otherwise

Exit codes:
  0  success
  2  usage error
  3  operation failed
  4  daemon unreachable
`,
  callUsage: (tools: string) => `Usage: binn call <tool> [json]

Call one of Binnacle's MCP tools for the Binnacle project containing the working directory, as
\`binn mcp\` serves them, and print what the tool returns as JSON on stdout. Arguments, if the tool
takes any, are one JSON object, such as '{"id":"<task id>"}'. The JSON is English whatever the locale.

Exit codes: 0 with the result; 3 with the daemon's error envelope on stdout; 4 with an error envelope
on stdout when the daemon is not running; 2 with a message on stderr for an unknown tool, or arguments
that are not JSON or that the tool does not take.

Tools:
${tools}
`,
  unknownCommand: (command: string) => `unknown command ${command}.`,
  /** Appended to the daemon's English when the person's language has no wording for it. */
  english: '',
  warning: 'warning',

  // Failures every command shares.
  unreachable: (address: string) => `No Binnacle daemon answered on ${address}.`,
  tokenMissing: (home: string) => `No Binnacle API token in ${home}.`,
  notRunningStart: 'the Binnacle daemon is not running. Start it with `binn daemon start`.',
  notAnswering: 'no Binnacle daemon is answering. Start it with `binn daemon start`.',
  noBrowser: (error: string) => `could not open a browser (${error}); run \`binn dashboard --print\` at a terminal for the address with its token.`,

  // Labels of a report's rows.
  label: {
    path: 'path',
    name: 'name',
    since: 'since',
    registered: 'since',
    tracker: 'tracker',
    checkout: 'checkout',
    git: 'git',
    remote: 'remote',
    address: 'address',
    bound: 'bound',
    accepts: 'accepts',
    pid: 'pid',
    version: 'version',
  },

  // binn project.
  registered: (id: string) => `Registered ${id}.`,
  noProjects: 'No projects are registered. Register one with `binn project register [path]`.',
  projects: (count: number) => `Binnacle projects (${count}):`,
  unknownId: '(unknown id)',
  unnamed: '(unnamed)',
  unavailable: (reason: string) => `unavailable: ${reason}`,
  manifestUnavailable: (reason: string) => `manifest unavailable: ${reason}`,
  notDeclared: '(not declared)',
  linkedWorktree: (root: string) => `${root} (linked worktree)`,
  head: (head: string, commit: string, dirty: boolean) => `${head} at ${commit}${dirty ? ', dirty' : ''}`,
  detached: '(detached HEAD)',
  noCommits: '(no commits)',
  noRemote: '(none)',
  unregistered: (id: string) => `Unregistered ${id}. Nothing in the repository was changed.`,

  // binn daemon.
  alreadyRunning: 'Binnacle daemon is already running.',
  started: 'Binnacle daemon started.',
  startedService: 'Binnacle daemon started through the service manager.',
  running: 'Binnacle daemon is running.',
  notRunning: 'Binnacle daemon is not running.',
  stale: (pid: number) => `Binnacle daemon is not running (stale runtime file for pid ${pid}).`,
  removedStale: (pid: number) => `Removed a stale runtime file for pid ${pid}.`,
  cannotSignal: (pid: number, error: string) => `could not signal pid ${pid}: ${error}`,
  didNotStop: (pid: number, seconds: number) => `pid ${pid} did not stop within ${seconds}s.`,
  stopped: (pid: number, supervised: boolean) => `Binnacle daemon stopped${supervised ? ' through the service manager' : ''} (pid ${pid}).`,
  exitedEarly: (code: number) => `the daemon exited with code ${code} before it started listening.`,
  didNotStart: (seconds: number) => `the daemon did not start within ${seconds}s.`,
  logHolds: (path: string) => `${path} holds its output.`,
  journal: (service: string) => `\`journalctl --user -u ${service}\` shows its output.`,

  // binn daemon autostart.
  autostartUnknown: (error: string) => `Autostart is unknown: ${error}.`,
  managerFailed: (command: string, error: string) => `${command} failed: ${error}`,
  noScheduler: (error: string) => `Task Scheduler does not answer (${error})`,
  noGuiSession: (error: string) => `no GUI session of this user answers (${error})`,
  noSystemd: (error: string) => `no systemd user manager answers (${error})`,
  autostartUnavailable: (reason: string) => `autostart is not available here: ${reason}. Nothing was changed.`,
  alreadyOn: (home: string) => `Autostart is already on for ${home}; nothing changed.`,
  mayNotBeOn: (path: string, off: string) => `${path} is written but autostart may not be on; \`${off}\` removes it.`,
  turnedOn: (home: string, path: string) => `Autostart is on for ${home}: ${path} starts the daemon at login, and again when it fails.`,
  noTokenFor: (path: string, key: string) => `${path} has no token for ${JSON.stringify(key)}.`,
  /** `problems` are sentences, each joined here without its full stop. */
  unseenToken: (variable: string, problems: string[], path: string) =>
    `${variable} is set in this shell, but the daemon the service manager starts does not see it, and ${problems.map((problem) => problem.replace(/\.$/, '')).join('; ')}. ` +
    `Put a read-only token in ${path} under the tracker's key, owner-only (chmod 600); Binnacle's docs/operations/05-installation-checklist.md, under Tracker credentials, has the details.`,
  alreadyOff: (home: string, serves: string | null) =>
    `Autostart is already off for ${home}; nothing changed.${serves ? ` The service starts the daemon for ${serves}, and stays.` : ''}`,
  turnedOff: (home: string, path: string) => `Autostart is off for ${home}: the service's daemon is stopped and ${path} is removed.`,
  isOn: (home: string, where: string) => `Autostart is on for ${home} (${where}).`,
  isBroken: (home: string, where: string, missing: string[], on: string) =>
    `Autostart is broken for ${home} (${where}): ${missing.join(' and ')} no longer exists. Repair it with \`${on}\`.`,
  isOff: (home: string, platform: string, serves: string | null, on: string) =>
    `Autostart is off for ${home} (${platform}).${serves ? ` The service starts the daemon for ${serves} instead.` : ''} Turn it on with \`${on}\`.`,
  replaced: (path: string) => `replaced ${path}, which Binnacle did not write.`,
  moves: (from: string, to: string) => `Autostart moves from ${from} to ${to}.`,
  rewrote: (path: string) => `Rewrote ${path} with the current paths to Node, the daemon and PATH.`,
};

const ru: typeof en = {
  usage: `binn — Binnacle, локальная панель управления разработкой с ИИ-агентами.

Использование:
  binn init [--window <days|all>] [--language <en|ru>] [--autostart <yes|no>] [--mod <yes|no>] [--skip-harness <id>]... [path]
                        Настроить Git-репозиторий, в котором лежит path (по умолчанию — текущий каталог):
                        показать весь план и один раз спросить перед записью; файлы не перезаписываются,
                        коммитов нет. --window задаёт окно импорта истории без вопроса;
                        --language отвечает, на каком языке документация репозитория, en или ru;
                        --autostart отвечает, запускать ли демон при входе в систему, там, где это спрашивается;
                        --skip-harness не ставит скиллы Binnacle в клиент агента с этим id в skills CLI
  binn init --plan --json [--window <days|all>] [--language <en|ru>] [--autostart <yes|no>] [--mod <yes|no>] [--skip-harness <id>]... [path]
                        Напечатать этот план и его id в JSON, ничего не записывая, не запуская и не спрашивая
  binn init --apply <id> [--window <days|all>] [--language <en|ru>] [--autostart <yes|no>] [--mod <yes|no>] [--skip-harness <id>]... [path]
                        Записать план с id <id>, как после подтверждения, без вопросов;
                        если план уже не тот, ничего не записать и выйти с кодом 3

  binn audit [path] [--json]
                        Находки по Git-репозиторию, в котором лежит path, только чтение: что на месте,
                        чего не хватает и что нельзя определить, у каждой — рекомендация

  binn daemon start     Запустить демон Binnacle на loopback
  binn daemon status    Сказать, запущен ли демон и где
  binn daemon stop      Остановить демон и удалить его runtime-файл
  binn daemon autostart [on|off]
                        Включить или выключить автозапуск демона при входе в систему через ваш
                        менеджер служб (на Linux — пользовательский юнит systemd) или сказать,
                        включён он, выключен или сломан

  binn project register [path]    Зарегистрировать репозиторий (по умолчанию — текущий каталог)
  binn project list               Показать проекты, которые ведёт эта машина
  binn project status [path]      Факты манифеста и живые факты Git о проекте, в котором лежит path
  binn project unregister [path]  Снять регистрацию, ничего не меняя в репозитории

  binn dashboard        Открыть дашборд в браузере по умолчанию, уже авторизованным, и напечатать
                        его адрес без токена
  binn dashboard --print  Напечатать адрес дашборда с токеном, не открывая его

  binn mcp              Отдавать MCP-инструменты Binnacle по stdio для текущего каталога
  binn call <tool> [json]
                        Вызвать один из этих инструментов для текущего каталога с аргументами одним
                        JSON-объектом и напечатать его ответ в JSON: для клиента агента без
                        MCP-сервера Binnacle. binn call --help перечисляет инструменты и их аргументы

Параметры:
  -h, --help            Показать эту справку
  -v, --version         Показать версию CLI

Переменные окружения:
  BINNACLE_HOME         Домашний каталог Binnacle (по умолчанию: ~/.binnacle)
  BINNACLE_PORT         Порт демона (по умолчанию: 7717; 0 — любой свободный порт)
  BINNACLE_HOST         Адрес, на котором слушает демон: 127.0.0.1, по умолчанию, или 0.0.0.0 в контейнере
  BINNACLE_ALLOWED_HOSTS  Значения host:port через запятую, которые демон принимает как Host помимо
                        своего адреса, например 127.0.0.1:7718,localhost:7718 (по умолчанию: нет)
  BINNACLE_GIT_TIMEOUT_MS  Сколько может длиться один вызов git, прежде чем факты Git станут недоступны (по умолчанию: 5000)
  LC_ALL, LANG          binn говорит по-русски, когда первая заданная начинается с ru, иначе по-английски

Коды выхода:
  0  успех
  2  ошибка использования
  3  операция не удалась
  4  демон недоступен
`,
  callUsage: (tools: string) => `Использование: binn call <tool> [json]

Вызвать один из MCP-инструментов Binnacle для проекта Binnacle, в котором лежит текущий каталог, так,
как их отдаёт \`binn mcp\`, и напечатать ответ инструмента в JSON на stdout. Аргументы, если инструмент
их принимает, — один JSON-объект, например '{"id":"<task id>"}'. JSON всегда на английском, при любой локали.

Коды выхода: 0 — с результатом; 3 — с конвертом ошибки демона на stdout; 4 — с конвертом ошибки
на stdout, когда демон не запущен; 2 — с сообщением на stderr, если инструмент неизвестен или аргументы
не JSON либо инструмент их не принимает.

Инструменты:
${tools}
`,
  unknownCommand: (command: string) => `неизвестная команда ${command}.`,
  english: ' (англ.)',
  warning: 'предупреждение',

  unreachable: (address: string) => `Демон Binnacle не ответил по адресу ${address}.`,
  tokenMissing: (home: string) => `В ${home} нет API-токена Binnacle.`,
  notRunningStart: 'демон Binnacle не запущен. Запустите его командой `binn daemon start`.',
  notAnswering: 'демон Binnacle не отвечает. Запустите его командой `binn daemon start`.',
  noBrowser: (error: string) => `не удалось открыть браузер (${error}); адрес с токеном напечатает \`binn dashboard --print\` в терминале.`,

  label: {
    path: 'путь',
    name: 'имя',
    since: 'запущен',
    registered: 'добавлен',
    tracker: 'трекер',
    checkout: 'рабочая копия',
    git: 'git',
    remote: 'remote',
    address: 'адрес',
    bound: 'слушает',
    accepts: 'принимает',
    pid: 'pid',
    version: 'версия',
  },

  registered: (id: string) => `${id} зарегистрирован.`,
  noProjects: 'Зарегистрированных проектов нет. Зарегистрируйте проект командой `binn project register [path]`.',
  projects: (count: number) => `Проекты Binnacle (${count}):`,
  unknownId: '(id неизвестен)',
  unnamed: '(без имени)',
  unavailable: (reason: string) => `недоступен: ${reason}`,
  manifestUnavailable: (reason: string) => `манифест недоступен: ${reason}`,
  notDeclared: '(не задан)',
  linkedWorktree: (root: string) => `${root} (связанный worktree)`,
  head: (head: string, commit: string, dirty: boolean) => `${head} на ${commit}${dirty ? ', есть изменения' : ''}`,
  detached: '(отсоединённый HEAD)',
  noCommits: '(коммитов нет)',
  noRemote: '(нет)',
  unregistered: (id: string) => `Регистрация ${id} снята. В репозитории ничего не изменено.`,

  alreadyRunning: 'Демон Binnacle уже запущен.',
  started: 'Демон Binnacle запущен.',
  startedService: 'Демон Binnacle запущен через менеджер служб.',
  running: 'Демон Binnacle работает.',
  notRunning: 'Демон Binnacle не запущен.',
  stale: (pid: number) => `Демон Binnacle не запущен (устаревший runtime-файл процесса ${pid}).`,
  removedStale: (pid: number) => `Удалён устаревший runtime-файл процесса ${pid}.`,
  cannotSignal: (pid: number, error: string) => `не удалось послать сигнал процессу ${pid}: ${error}`,
  didNotStop: (pid: number, seconds: number) => `процесс ${pid} не остановился за ${seconds} с.`,
  stopped: (pid: number, supervised: boolean) => `Демон Binnacle остановлен${supervised ? ' через менеджер служб' : ''} (pid ${pid}).`,
  exitedEarly: (code: number) => `демон завершился с кодом ${code}, не начав слушать.`,
  didNotStart: (seconds: number) => `демон не запустился за ${seconds} с.`,
  logHolds: (path: string) => `Его вывод — в ${path}.`,
  journal: (service: string) => `Его вывод показывает \`journalctl --user -u ${service}\`.`,

  autostartUnknown: (error: string) => `Состояние автозапуска неизвестно: ${error}.`,
  managerFailed: (command: string, error: string) => `не удалось выполнить ${command}: ${error}`,
  noScheduler: (error: string) => `Планировщик заданий не отвечает (${error})`,
  noGuiSession: (error: string) => `нет графического сеанса этого пользователя (${error})`,
  noSystemd: (error: string) => `пользовательский менеджер systemd не отвечает (${error})`,
  autostartUnavailable: (reason: string) => `автозапуск здесь недоступен: ${reason}. Ничего не изменено.`,
  alreadyOn: (home: string) => `Автозапуск для ${home} уже включён; ничего не изменено.`,
  mayNotBeOn: (path: string, off: string) => `${path} записан, но автозапуск, возможно, не включён; \`${off}\` его удалит.`,
  turnedOn: (home: string, path: string) => `Автозапуск для ${home} включён: ${path} запускает демон при входе в систему и снова, если он упадёт.`,
  noTokenFor: (path: string, key: string) => `В ${path} нет токена для ${JSON.stringify(key)}.`,
  unseenToken: (variable: string, problems: string[], path: string) =>
    `${variable} задана в этой оболочке, но демон, запущенный менеджером служб, её не видит. ${problems.join(' ')} ` +
    `Положите токен только для чтения в ${path} под ключом трекера, с доступом только для владельца (chmod 600); подробности — в docs/operations/05-installation-checklist.ru.md Binnacle, раздел «Учётные данные tracker».`,
  alreadyOff: (home: string, serves: string | null) =>
    `Автозапуск для ${home} уже выключен; ничего не изменено.${serves ? ` Служба запускает демон для ${serves} и остаётся.` : ''}`,
  turnedOff: (home: string, path: string) => `Автозапуск для ${home} выключен: демон службы остановлен, ${path} удалён.`,
  isOn: (home: string, where: string) => `Автозапуск для ${home} включён (${where}).`,
  isBroken: (home: string, where: string, missing: string[], on: string) =>
    `Автозапуск для ${home} сломан (${where}): ${missing.join(' и ')} больше нет. Почините автозапуск командой \`${on}\`.`,
  isOff: (home: string, platform: string, serves: string | null, on: string) =>
    `Автозапуск для ${home} выключен (${platform}).${serves ? ` Служба вместо этого запускает демон для ${serves}.` : ''} Включите автозапуск командой \`${on}\`.`,
  replaced: (path: string) => `заменён ${path}, который записал не Binnacle.`,
  moves: (from: string, to: string) => `Автозапуск переходит с ${from} на ${to}.`,
  rewrote: (path: string) => `${path} переписан с текущими путями к Node, демону и PATH.`,
};

export type Text = typeof en;

/** `binn`'s text in each language. */
export const TEXT: Record<Language, Text> = { en, ru };

/** `binn`'s text in the person's language, read once per run. */
export const T = TEXT[LANGUAGE];

/** A report's row: its label, padded to the longest label of the language, and its value. */
export const row = (label: keyof typeof en.label, value: string, indent = '  '): string => {
  const width = Math.max(...Object.values(T.label).map((text) => text.length));
  return `${indent}${T.label[label].padEnd(width)} ${value}`;
};

/** Text the daemon or another library wrote with no code, marked English when the person's language is not. */
export const marked = (text: string): string => `${text}${T.english}`;

/**
 * A daemon's message for a person, without its code: in English as the daemon wrote it, in
 * Russian from core's wording and `params`, or the daemon's English marked when there is none.
 * `language` is the person's unless the text is for the chat, which is English.
 */
export function say({ code, message, params }: { code: string; message: string; params?: Params | undefined }, language: Language = LANGUAGE): string {
  const { text, english } = wordMessage(language, { code, message, ...(params && { params }) });
  return english ? `${text}${TEXT[language].english}` : text;
}
