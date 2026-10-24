import type { Language } from './manifest.ts';

/**
 * The daemon's messages in the person's language (spec `human-output`, *One Russian wording
 * of the daemon's codes*). A message carries its `code`, its English `message`, which is the
 * daemon's own wording, and `params`, the values that sentence is written from. The Russian
 * here is a pure function of the code and those values, with the Russian terms `CONTEXT.md`
 * lists; English is the message as the daemon wrote it. Commands, paths, Task ids, branch
 * names and a file's own markers (`Status:`, `## Comments`, a roadmap cell) are never translated.
 */

/** The values a message is written from: Task ids, paths, numbers and names. */
export type Params = Record<string, string | number>;

/** A message for a person: a diagnostic, an error or one of an error's details. */
export type Coded = { code: string; message: string; params?: Params };

/** `params` that cannot give the sentence: a value missing, or not one the wording knows. */
class Unusable extends Error {}

/** The values of one message, each read as the wording needs it; a missing one makes the params unusable. */
type Values = {
  /** A value, as text. */
  s(name: string): string;
  /** A number. */
  n(name: string): number;
  /** A value when it is there, null when it is not. */
  o(name: string): string | null;
  /** A value's Russian, from `table`. */
  of(name: string, table: Record<string, string>): string;
};

const values = (params: Params): Values => {
  const s = (name: string): string => {
    const value = params[name];
    if (typeof value !== 'string' && typeof value !== 'number') throw new Unusable();
    return String(value);
  };
  return {
    s,
    n: (name) => {
      const value = params[name];
      if (typeof value !== 'number') throw new Unusable();
      return value;
    },
    o: (name) => (params[name] === undefined ? null : s(name)),
    of: (name, table) => {
      const value = s(name);
      if (!Object.hasOwn(table, value)) throw new Unusable();
      return table[value]!;
    },
  };
};

/** The sentence for the message's `kind`, or the value `name` names, when it is one of `kinds`: a code worded in several ways, as its English is. */
const pick = (v: Values, kinds: Record<string, () => string>, name = 'kind'): string => {
  const kind = v.s(name);
  if (!Object.hasOwn(kinds, kind)) throw new Unusable();
  return kinds[kind]!();
};

const PLURAL = new Intl.PluralRules('ru');

/** `count` with its noun in the right form: one, few, many. */
const counted = (count: number, [one, few, many]: [string, string, string]): string => {
  const form = PLURAL.select(count);
  return `${count} ${form === 'one' ? one : form === 'few' ? few : many}`;
};

/** A shape the manifest's validation names, as `describe` writes it in English. */
const SHAPES: Record<string, string> = {
  nothing: 'ничего',
  null: 'null',
  'a list': 'список',
  'a date': 'дата',
  'a mapping': 'отображение',
  string: 'строка',
  number: 'число',
  boolean: 'логическое значение',
  bigint: 'число',
  symbol: 'символ',
  function: 'функция',
  'a string other than "auto"': 'строка, но не "auto"',
};

/** A value the daemon names by its shape, or a number as written. */
const shape = (v: Values, name: string): string => (/^-?\d+(\.\d+)?$/.test(v.s(name)) ? v.s(name) : v.of(name, SHAPES));

/** A list the daemon joins with commas, said as alternatives. */
const either = (v: Values, name: string): string => v.s(name).split(', ').join(' или ');

/** What a forge lists, as the remote tracker names it. */
const LISTED: Record<string, string> = {
  issues: 'issues',
  comments: 'комментарии',
  'pull requests': 'pull requests',
  'merge requests': 'merge requests',
  reviews: 'ревью',
  repository: 'репозиторий',
  commits: 'коммиты',
  'workflow runs': 'запуски workflow',
  statuses: 'статусы',
  pipelines: 'pipelines',
};

/** Whether a refused request was made with a token. */
const TOKEN: Record<string, string> = { used: 'запрос был с токеном', none: 'запрос был без токена' };

/** What a state machine is about. */
const ENTITIES: Record<string, string> = { Task: 'задачи', AgentRun: 'запуска', Review: 'ревью' };

const NEXT_ACTION_SHAPE = 'абзац, который начинается с «Next action:» и заканчивается командой в обратных кавычках';

const PARALLEL_RULE = (v: Values): string => `Лимит параллельной работы — целое число от 1 до ${v.s('max')} или "auto"`;

/** One Russian sentence per code, from its values. */
const RUSSIAN: Record<string, (v: Values) => string> = {
  // Details of an error, and the manifest's warnings: what a field was expected to be.
  'expected.mapping': (v) => `ожидается YAML-отображение, а здесь ${v.of('got', SHAPES)}`,
  'expected.version': (v) => `ожидается ${v.s('expected')}, а здесь ${v.of('got', SHAPES)}`,
  'expected.non_empty_string': () => 'ожидается непустая строка',
  'expected.string': () => 'ожидается строка',
  'expected.string_or_null': () => 'ожидается непустая строка или null',
  'expected.one_of': (v) => `ожидается одно из: ${v.s('allowed')}`,
  'expected.positive_integer': (v) => `ожидается целое положительное число${v.o('or') === null ? '' : ` или ${v.s('or')}`}`,
  'expected.capability': () => 'ожидается true, false или "optional"',
  'expected.range': (v) => `ожидается число от ${v.s('min')} до ${v.s('max')}`,
  'expected.hash': () => 'ожидается от 4 до 64 шестнадцатеричных цифр',
  'expected.ancestor': () => 'ожидается коммит, от которого происходит HEAD',
  'expected.alone': (v) => `не вместе с «${v.s('other')}»`,
  'expected.absolute_path': () => 'ожидается абсолютный путь, разрешённый вызывающим',
  'expected.relative_path': () => 'ожидается относительный путь внутри проекта',
  'expected.array': () => 'ожидается массив',
  'manifest.unknown_key': () => 'неизвестный ключ, пропущен: его написал более новый Binnacle или это опечатка',
  'manifest.unknown_language': (v) => `ожидается одно из: ${v.s('allowed')}; читается как en`,
  'yaml.syntax': (v) => `YAML не разбирается: ${v.s('error')}`,
  'project.shared_id': (v) => `«${v.s('id')}» — также id проекта, зарегистрированного в ${v.s('other')}`,

  // The manifest.
  'manifest.missing': (v) => `В ${v.s('path')} нет .binnacle/project.yaml. Его пишет \`binn init\`.`,
  'manifest.invalid': (v) =>
    v.o('count') === null ? `${v.s('path')} не разбирается как YAML.` : `В ${v.s('path')} ${counted(v.n('count'), ['ошибка', 'ошибки', 'ошибок'])}.`,
  'manifest.unsupported_version': (v) => `${v.s('path')} не объявляет version ${v.s('version')}, единственную, которую поддерживает этот Binnacle.`,
  'manifest.warning': (v) => {
    const warning = v.s('warning');
    if (!Object.hasOwn(RUSSIAN, warning) || warning === 'manifest.warning') throw new Unusable();
    return `${v.s('path')}: ${RUSSIAN[warning]!(v)}.`;
  },

  // The roadmap and its Next action.
  'roadmap.missing': (v) =>
    pick(v, {
      docs: () => 'Роадмап лежит в <knowledge.docs>/roadmap.md, а этот проект не задаёт knowledge.docs.',
      path: () => `Роадмапа нет: ${v.s('path')} не существует.`,
      manifest: () => 'Без читаемого манифеста у проекта нет роадмапа.',
    }),
  'roadmap.focus_missing': () => 'В роадмапе нет раздела «## Current focus».',
  'roadmap.table_missing': () => 'В роадмапе нет таблицы с заголовком «| # | Epic | Status | Spec |».',
  'roadmap.row_invalid': (v) => {
    const kinds: Record<string, () => string> = {
      cells: () => `в ней ${counted(v.n('cells'), ['ячейка', 'ячейки', 'ячеек'])}, а не ${v.s('expected')}`,
      number: () => `# «${v.s('value')}» — не число`,
      title: () => 'её ячейка Epic пуста',
      status: () => `Status «${v.s('value')}» — не одно из: ${v.s('allowed')}`,
      spec: () => `Spec «${v.s('value')}» — не «—» и не ссылка на specs/<slug>/spec.md`,
    };
    return `Строка ${v.s('line')} роадмапа пропущена: ${pick(v, kinds)}.`;
  },
  'roadmap.spec_missing': (v) => `Эпик ${v.s('epic')} (${v.s('title')}) отмечен в роадмапе как «${v.s('status')}», но в его ячейке Spec — «—».`,
  'roadmap.status_mismatch': (v) => {
    const epic = `Эпик ${v.s('epic')} (${v.s('title')})`;
    const kinds: Record<string, () => string> = {
      done: () => `${epic} отмечен в роадмапе как «done», но эти тикеты не готовы и не отменены: ${v.s('tasks')}.`,
      not_started: () => `${epic} отмечен в роадмапе как «not started», но у его спецификации ${v.s('spec')} уже ${counted(v.n('count'), ['тикет', 'тикета', 'тикетов'])}.`,
      finished: () => `${epic} отмечен в роадмапе как «${v.s('status')}», но все тикеты ${v.s('spec')} готовы или отменены.`,
    };
    return pick(v, kinds);
  },
  'roadmap.spec_unlisted': (v) => `На спецификацию ${v.s('path')} не ссылается ни одна строка роадмапа.`,
  'next_action.missing': (v) =>
    pick(v, {
      focus: () => `В роадмапе нет текущего фокуса, а значит, и следующего шага. Следующий шаг — ${NEXT_ACTION_SHAPE}.`,
      paragraph: () => `Последний абзац текущего фокуса — не следующий шаг. Следующий шаг — ${NEXT_ACTION_SHAPE}.`,
    }),
  'next_action.stale': (v) => {
    const why: string[] = [];
    if (v.o('tasks') !== null) why.push(`называет завершённую работу: ${v.s('tasks')}`);
    if (v.o('epic') !== null) {
      const human = v.o('human');
      why.push(
        `запускает эпик ${v.s('epic')} (${v.s('title')}), но в ${v.s('spec')} не осталось тикетов для агента: все готовы, отменены или ready-for-human` +
          (human === null ? '' : `, а ${human} — ready-for-human`),
      );
    }
    if (why.length === 0) throw new Unusable();
    return `Команда следующего шага, ${v.s('command')}, ${why.join('; кроме того, она ')}.`;
  },
  // One of the Suggested step's alternatives: its kind, the Task it names as `task` or several as `tasks`, its epic.
  'next.alternative': (v) => {
    const one = (): boolean => v.o('task') !== null;
    const tasks = (): string => (one() ? v.s('task') : v.s('tasks'));
    const epic = (): string => `${v.s('epic')} (${v.s('title')})`;
    return pick(v, {
      wait: () =>
        `Над ${tasks()} идёт работа: ${one() ? 'активен запуск' : 'активны запуски'} реализации. Лучше дождаться её конца, чем начинать что-то поверх.`,
      parallel: () =>
        one()
          ? `${tasks()} готова к старту, и лимит параллельной работы позволяет: начните её рядом с текущей работой.`
          : `${tasks()} готовы к старту, в любом порядке, и лимит параллельной работы позволяет: начните одну из них рядом с текущей работой.`,
      resume: () => `${v.s('task')} в работе, но ни один её запуск не активен. Продолжите её.`,
      autopilot: () => `У эпика ${epic()} есть задачи, готовые к старту. Пройдите его оставшиеся тикеты.`,
      byHand: () =>
        one()
          ? `${tasks()} готова к старту. Возьмите её вручную, по одному тикету за раз.`
          : `${tasks()} готовы к старту, в любом порядке. Возьмите одну из них вручную.`,
      owner: () => `${tasks()} ${one() ? 'готова' : 'готовы'} к старту и в триаже ready-for-human: ${one() ? 'её' : 'их'} делает владелец, а не агент.`,
      blocked: () =>
        `Ни одна задача эпика ${epic()} не может стартовать: каждая готовая ждёт невыполненной зависимости, она в скобках: ${v.s('waits')}.`,
      close: () => `Все задачи эпика ${epic()} готовы или отменены, но в роадмапе он не отмечен как «done». Закройте его в продуктовой сессии.`,
      plan: () =>
        pick(
          v,
          {
            epics: () => 'В роадмапе нет ни одного эпика. Предложите эпики из видения.',
            grilling: () => `Эпик ${epic()} не начат. Проведите грилинг.`,
            spec: () => `Эпику ${epic()} нужна спецификация.`,
            tickets: () => `Эпику ${epic()} нужны тикеты.`,
          },
          'need',
        ),
      finished: () => 'Все эпики роадмапа готовы.',
    });
  },

  // Tasks and the tracker.
  'task.not_found': (v) => `В трекере проекта нет задачи «${v.s('id')}».`,
  'task.unknown_state': (v) =>
    v.o('status') === null
      ? `В ${v.s('task')} (${v.s('ticket')}) нет строки Status:.`
      : `В ${v.s('task')} (${v.s('ticket')}) Status: «${v.s('status')}» — не состояние задачи.`,
  'task.unknown_role': (v) => `В ${v.s('task')} (${v.s('ticket')}) в Roles: стоит «${v.s('role')}», а это не одна из ролей ${v.s('roles')}, и она пропущена.`,
  'task.shared_branch': (v) =>
    `${v.s('branch')}, ветка задачи ${v.s('task')}, — также ветка ${v.s('others')}, поэтому работа в ней не засчитывается ни одной задаче. Слаг тикета должен быть уникален во всех эпиках.`,
  'task.dangling_dependency': (v) => `Задача ${v.s('task')} (${v.s('ticket')}) объявлена заблокированной ${v.s('dependency')}, но такой задачи нет.`,
  'review.missing': (v) => `Задача ${v.s('task')} (${v.s('ticket')}) готова, но в её тикете нет ревью в ## Comments.`,
  'tracker.remote_mismatch': (v) => `Трекер объявлен на ${v.s('tracker')}, но ни один Git remote туда не указывает: ${v.s('remotes')}.`,
  'tracker.issues_missing': (v) => `tracker.local.issues указывает на ${v.s('path')}, но это не каталог.`,
  'tracker.credentials_insecure': (v) => `${v.s('path')} может читать не только его владелец, поэтому он не прочитан; оставьте доступ только владельцу (chmod 600).`,
  'tracker.unavailable': (v) => {
    const kinds: Record<string, () => string> = {
      token: () => `${v.s('source')} — непригодный токен, поэтому с ним ничего не прочитано.`,
      credentials_token: () => `Запись для ${v.s('key')} в ${v.s('path')} — непригодный токен, поэтому с ним ничего не прочитано.`,
      credentials_unreadable: () => `${v.s('path')} не читается (${v.s('error')}).`,
      credentials_invalid: () => `${v.s('path')} — не JSON-объект «хост — токен», поэтому с его токенами ничего не прочитано.`,
      manifest: () => 'Без читаемого манифеста задачи не прочитать.',
      provider: () => 'Этот проект не задаёт tracker.provider.',
      issues: () => 'tracker.provider — local, а этот проект не задаёт tracker.local.issues.',
      repository: () => `tracker.provider — ${v.s('provider')}, а этот проект не задаёт tracker.repository.`,
      unreadable: () => 'Трекер не читается.',
    };
    return pick(v, kinds);
  },
  'tracker.unreachable': (v) => {
    const forge = (): string => v.s('forge');
    const kinds: Record<string, () => string> = {
      url: () => `tracker.host не даёт URL для ${v.s('where')}.`,
      list: () => `${forge()} ответил для ${v.s('where')} не списком: ожидались ${v.of('what', LISTED)}.`,
      host: () => `${forge()} отправил за следующей страницей ${v.s('where')} на другой хост, ${v.s('origin')}, и он не читается.`,
      object: () => `${forge()} ответил для ${v.s('where')} не тем, что ожидалось: ${v.of('what', LISTED)}.`,
      error: () => `${forge()} не читается для ${v.s('where')}: ${v.s('error')}.`,
      status: () => `${forge()} ответил ${v.s('status')} для ${v.s('where')}.`,
    };
    return pick(v, kinds);
  },
  'tracker.rate_limited': (v) => `${v.s('forge')} ограничил частоту чтения ${v.s('where')} (${v.s('status')}).`,
  'tracker.unauthorized': (v) => `${v.s('forge')} отклонил запрос для ${v.s('where')} (401); ${v.of('token', TOKEN)}.`,
  'tracker.forbidden': (v) => `${v.s('forge')} не дал доступа на чтение: ${v.of('what', LISTED)} в ${v.s('where')} (403); ${v.of('token', TOKEN)}.`,
  'tracker.not_found': (v) => `${v.s('forge')}: в ${v.s('where')} не найдено то, что видно этому запросу (${v.of('what', LISTED)}, ${v.s('status')}); ${v.of('token', TOKEN)}.`,
  'tracker.state_mismatch': (v) =>
    v.o('status') === null
      ? `${v.s('task')} (${v.s('ticket')}) открыт, но его Status: — ${v.s('state')}.`
      : `${v.s('task')} (${v.s('ticket')}) закрыт как ${v.s('state')}, но его Status: — ${v.s('status')}.`,
  'transition.unknown_state': (v) => `У ${v.of('entity', ENTITIES)} нет состояния ${either(v, 'states')}.`,
  'transition.terminal': (v) => `Состояние ${v.of('entity', ENTITIES)} ${v.s('from')} конечное; перейти в ${v.s('to')} нельзя.`,
  'transition.not_allowed': (v) => `Перейти из ${v.s('from')} в ${v.s('to')} для ${v.of('entity', ENTITIES)} нельзя.`,
  'epic.unknown': (v) => `В роадмапе нет эпика ${v.s('epic')}.`,
  'epic.no_spec': (v) => `У эпика ${v.s('epic')} (${v.s('title')}) в роадмапе нет спецификации, поэтому задач у него пока нет.`,
  'adr.missing': (v) => `knowledge.adr указывает на ${v.s('path')}, но это не каталог.`,
  'checkpoint.uncommitted': (v) =>
    `В ${v.s('path')} есть незакоммиченные изменения, поэтому его нет в записанном коммите ${v.s('head')}, и он снова появится в следующей дельте. Закоммитьте его и запишите чекпойнт ещё раз.`,
  'checkpoint.path_missing': (v) => `По пути ${v.s('path')} в этой рабочей копии ничего нет, поэтому туда ничего не перенесено.`,

  // Git, CI, the graph, telemetry and the machine.
  'git.not_a_repository': (v) =>
    pick(v, { directory: () => `Каталога ${v.s('path')} нет.`, repository: () => `${v.s('path')} — не внутри Git-репозитория.` }),
  'git.not_found': () => 'git нет в PATH.',
  'git.timeout': (v) => `git ${v.s('command')} не ответил за ${v.s('timeout')} мс.`,
  'git.failed': (v) => `git ${v.s('command')} завершился с ошибкой: ${v.s('detail')}`,
  'git.no_commits': () => 'В этой рабочей копии ещё нет коммитов.',
  'ci.failing': (v) => `CI падает в ${v.s('branch')} на ${v.s('commit')}, по данным ${v.s('forge')}: ${v.s('url')}`,
  'ci.no_forge': () => 'CI читать неоткуда: трекер — не GitHub и не GitLab, и Git remote на GitHub или GitLab нет.',
  'review.remote': () => 'Из комментариев к issue Binnacle читает только вопросы и ответы, поэтому ревью на GitHub и GitLab не читается.',
  'graph.unavailable': (v) =>
    pick(v, {
      none: () => 'Графа нет.',
      off: () => 'Проект не использует Graphify: в его манифесте capabilities.graphify — false.',
      no_graphify: () => 'graphify нет в PATH демона, поэтому граф не строится и не читается.',
      not_built: () => `Граф ещё не построен: ${v.s('file')} нет.`,
      unreadable: () => `${v.s('file')} не читается как граф.`,
    }),
  'harness.no_sessions': (v) => `Сессий ${v.s('harness')} этого проекта в ${v.s('path')} не найдено.`,
  'usage.import_pending': () => 'Импорт этого проекта ещё не дошёл ни до одной записи.',
  'harness.no_export': (v) => {
    const harness = v.s('harness');
    return pick(v, {
      database: () => `Экспорт OpenTelemetry у ${harness} не описан, поэтому Binnacle считает его только по его базе данных, каждый вызов — после его завершения.`,
      session_files: () => `Встроенного экспорта OpenTelemetry у ${harness} нет, поэтому Binnacle считает его только по файлам его сессий, каждый вызов — после его завершения.`,
      encrypted: () =>
        `У ${harness} нет экспорта OpenTelemetry, а его разговоры зашифрованы, поэтому Binnacle видит только его сессии и их каталоги, по состоянию его окна, без модели и счётчиков токенов.`,
    });
  },
  'ponytail.no_comparison': (v) =>
    pick(v, {
      no_commit: () => 'Ни один коммит в ветке по умолчанию не добавляет Ponytail в AGENTS.md или CLAUDE.md, поэтому «до» и «после» нет.',
      unread: () => 'Git не может прочитать историю ветки по умолчанию, поэтому дата Ponytail неизвестна.',
      none_before: () => 'Ни одна задача с запусками не завершена до Ponytail, сравнивать не с чем.',
      none_after: () => 'После Ponytail не завершена ни одна задача с запусками, сравнивать не с чем.',
      neither: () => 'Ни одну задачу с запусками коммит в ветке по умолчанию не перевёл в Status: DONE, сравнивать не с чем.',
      remote: () => 'На GitHub и GitLab задача становится готовой по своему issue, а не по коммиту, поэтому ни одна задача не попадает ни до, ни после Ponytail.',
    }),
  'graph.update_failed': (v) =>
    `Обновление графа для ${v.s('commit')} не удалось: ${v.s('reason')}${v.o('kept') === null ? '' : ` Граф, построенный по ${v.s('kept')}, сохранён.`}`,
  'graph.not_ignored': (v) =>
    `Git не игнорирует ${v.s('directory')}/ в ${v.s('path')}, поэтому демон не запускает там Graphify. Добавьте ${v.s('directory')}/ в .gitignore.`,
  'telemetry.unreadable': (v) => {
    const others = v.n('others');
    return `${v.s('harness')}: не удалось прочитать ${v.s('what')}.${others === 0 ? '' : ` Не удалось прочитать и ещё ${counted(others, ['файл или каталог', 'файла или каталога', 'файлов или каталогов'])}.`}`;
  },
  'context.pressure': (v) => {
    const why: string[] = [];
    if (v.o('tokens') !== null) {
      why.push(`прочитала ${counted(v.n('tokens'), ['токен', 'токена', 'токенов'])} контекста в последнем вызове${v.o('threshold') === null ? '' : `, не меньше telemetry.context_pressure.tokens, ${v.s('threshold')}`}`);
    }
    if (v.o('at') !== null) {
      const since = v.o('checkpoint') === null ? 'а чекпойнт не записан' : `после последнего чекпойнта в ${v.s('checkpoint')}`;
      why.push(`сжала контекст (${v.o('trigger') ?? 'причина не сообщается'}) в ${v.s('at')}, ${since}`);
    }
    if (why.length === 0) throw new Unusable();
    return `Продуктовая сессия ${v.s('session')} в ${v.s('harness')} ${why.join(', а также ')}. Запустите /binnacle:checkpoint и продолжайте в новой сессии.`;
  },
  'parallel_limit.invalid': (v) => {
    const kinds: Record<string, () => string> = {
      file: () => `${v.s('file')} не читается как JSON-объект, поэтому лимит параллельной работы — ${v.s('limit')}.`,
      setting: () => `${PARALLEL_RULE(v)}, а parallelLimit в ${v.s('file')} не таков, поэтому лимит — ${v.s('limit')}.`,
      value: () => `${PARALLEL_RULE(v)}; ${shape(v, 'got')} не подходит.`,
    };
    return pick(v, kinds);
  },
  'settings.unreadable': (v) => `${v.s('file')} не читается как JSON-объект, поэтому не перезаписывается. Исправьте его вручную.`,
  'vault.unwritable': (v) => {
    const kinds: Record<string, () => string> = {
      settings: () => `${v.s('file')} не читается как JSON, поэтому проекции в Obsidian нет.`,
      path: () => `obsidian.vaultPath в ${v.s('file')} — не абсолютный путь, поэтому проекции в Obsidian нет.`,
      directory: () => `Хранилище ${v.s('path')} — не каталог, поэтому в него ничего не проецируется.`,
      write: () => `В хранилище ${v.s('path')} нельзя писать (${v.s('error')}), поэтому в него ничего не проецируется.`,
    };
    return pick(v, kinds);
  },
  'daemon.autostart_broken': (v) => `Автозапуск для ${v.s('home')} сломан: ${v.s('missing')} больше нет. Почините его командой \`${v.s('command')}\`.`,
  'registry.unreadable': (v) => {
    const why = pick(v, { json: () => `не JSON: ${v.s('error')}`, projects: () => 'в нём нет массива "projects"', entry: () => 'у одной из записей нет "path"' });
    return `Реестр проектов Binnacle в ${v.s('path')} не читается (${why}). Почините или удалите файл.`;
  },
  'project.path_not_found': (v) => `Каталога ${v.s('path')} нет.`,
  'project.not_registered': (v) =>
    pick(v, {
      registered: () => `${v.s('path')} — не зарегистрированный проект Binnacle.`,
      contains: () => `Ни один зарегистрированный проект Binnacle не содержит ${v.s('path')}.`,
    }),

  // The daemon's API.
  'request.invalid': (v) => `Неверное поле запроса «${v.s('field')}».`,
  'request.body_invalid': () => 'Тело запроса должно быть JSON-документом.',
  'request.body_too_large': (v) => `Тело запроса больше ${v.s('limit')} байт.`,
  'request.unsupported_media_type': (v) =>
    `Binnacle принимает OTLP по HTTP только как несжатый JSON (application/json), а не ${v.s('received')}: укажите в экспортере протокол http/json.`,
  'request.not_found': (v) => `Маршрута ${v.s('route')} нет.`,
  'request.method_not_allowed': (v) => `Метод «${v.s('method')}» здесь не разрешён; используйте ${either(v, 'allowed')}.`,
  'request.forbidden_host': (v) => `Host «${v.s('host')}» — не ${v.s('address')}, адрес, на котором слушает этот демон.`,
  'request.forbidden_origin': (v) => `Origin «${v.s('origin')}» не разрешён.`,
  'operation.unknown': (v) => `Неизвестная операция «${v.s('operation')}».`,
  'auth.missing': () => 'Эта операция требует API-токен Binnacle.',
  'auth.invalid': () => 'Предъявленный API-токен Binnacle недействителен.',
  'internal.error': () => 'Внутренняя ошибка демона.',
};

/** Every code with a Russian wording. */
export const WORDED_CODES: readonly string[] = Object.keys(RUSSIAN);

/**
 * `item` in `language`: in English its message as the daemon wrote it; in Russian its wording,
 * or, for a code with none or `params` it cannot use, the English message with `english` true,
 * for the caller to mark.
 */
export function wordMessage(language: Language, item: Coded): { text: string; english: boolean } {
  if (language === 'en') return { text: item.message, english: false };
  if (Object.hasOwn(RUSSIAN, item.code)) {
    try {
      return { text: RUSSIAN[item.code]!(values(item.params ?? {})), english: false };
    } catch (error) {
      if (!(error instanceof Unusable)) throw error;
    }
  }
  return { text: item.message, english: true };
}
