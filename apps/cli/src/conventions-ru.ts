import { ROLES, TASK_STATES, type TrackerProvider } from '@binnacle/core';

/**
 * The Russian text of each convention `conventions.ts` writes, for a repository whose language is
 * Russian (ADR-0045). Every marker Binnacle or a skill parses stays English: the ticket header's
 * field names and states, `## Ticket header`, `## Agent skills`, `## Comments`, `### Question`,
 * `### Answer`, the triage label strings, the triage flag `/triage` reads, and the code.
 */

const ISSUE_NUMBERS = 'номера issue, которых он ждёт, например `#12, #15`';
const PATH_OR_LINK = 'её путь, например `docs/specs/<slug>/spec.md`, или ссылка на этот файл, закреплённая за коммитом';
const KEEP_CURRENT = 'Binnacle сообщает о любом расхождении между ними, поэтому обновляйте строку, когда закрываете issue.';
const QUESTION_OPTIONS =
  'После текста вопроса идут его варианты, у каждого своя цена, рекомендуемый первым и с пометкой "(recommended)"; ' +
  'владелец выбирает один из них или пишет свой ответ.';
const REMOTE_QUESTIONS =
  'Вопрос, на который может ответить только владелец, и ответ на него — это комментарии к issue, которые начинаются с `### Question` и `### Answer`; ' +
  `ответ пишет владелец или \`/binnacle:answer\`, никогда не агент. ${QUESTION_OPTIONS}`;

const CONVENTIONS: Record<TrackerProvider, { ticket: string; blockedBy: string; example: string; spec: string; rule: string; questions: string }> = {
  local: {
    ticket: 'каждого тикета',
    blockedBy: 'номера тикетов той же спецификации, которых он ждёт, например `01, 03`',
    example: '01, 03',
    spec: 'её путь, например `docs/specs/<slug>/spec.md`',
    rule:
      'Slug тикета, имя его файла без номера, уникален среди тикетов всех спецификаций: он даёт имя ветке тикета, `feat/<slug>`, ' +
      'а работу на ветке, общей для двух тикетов, Binnacle не засчитывает ни одному из них.',
    questions:
      'Вопрос, на который может ответить только владелец, пишется под заголовком `### Question` внутри `## Comments`, в коммите, который меняет только тикет, на ветке, где идёт работа; ' +
      'ответ владельца идёт сразу за ним под `### Answer`, его пишет владелец или `/binnacle:answer`, никогда не агент. ' +
      `Binnacle читает их с ветки задачи, пока она не слита. ${QUESTION_OPTIONS}`,
  },
  github: {
    ticket: 'описания каждого issue',
    blockedBy: ISSUE_NUMBERS,
    example: '#12, #15',
    spec: PATH_OR_LINK,
    rule:
      'Закрытие issue важнее его строки `Status:`: issue, закрытый как выполненный (completed), готов, а закрытый как не запланированный (not planned) или как дубликат — отменён, что бы ни говорила строка. ' +
      `Issue, закрытый без причины, отменён, если его \`Status:\` говорит \`CANCELLED\`, и готов в остальных случаях. ${KEEP_CURRENT}`,
    questions: REMOTE_QUESTIONS,
  },
  gitlab: {
    ticket: 'описания каждого issue',
    blockedBy: ISSUE_NUMBERS,
    example: '#12, #15',
    spec: PATH_OR_LINK,
    rule:
      'Закрытие issue важнее его строки `Status:`, а GitLab не сообщает причину закрытия: закрытый issue готов, если только его `Status:` не говорит `CANCELLED`. ' +
      `Ставьте \`Status: CANCELLED\`, прежде чем закрыть брошенную работу. ${KEEP_CURRENT}`,
    questions: REMOTE_QUESTIONS,
  },
};

/** `ticketHeaderSection` in Russian. */
export function ticketHeaderSectionRu(provider: TrackerProvider): string {
  const { ticket, blockedBy, example, spec, rule, questions } = CONVENTIONS[provider];
  const states = TASK_STATES.map((state) => `\`${state}\``).join(', ');
  return `
## Ticket header

Binnacle читает состояние тикета, его зависимости и спецификацию из заголовка: из этих строк, по одной в строке, в самом начале ${ticket}, до всего остального. Пишите их в каждом тикете и держите \`Status:\` актуальным.

- \`Status:\` — состояние тикета, одно из ${states}.
- \`Blocked by:\` — ${blockedBy}, или \`None\`.
- \`Spec:\` — спецификация, которую он реализует: ${spec}.
- \`Roles:\` — роли, нужные задаче, через запятую, из ${ROLES.join(', ').replace(/, (\w+)$/, ' и $1')}, например \`Developer, Reviewer, Security\`. Строка необязательна: без неё задаче нужны Developer и Reviewer. Binnacle показывает рядом со строкой роли, которые предлагает сам, и никогда её не меняет.

${rule}

${questions}

Например:

\`\`\`text
Status: READY
Blocked by: ${example}
Spec: \`docs/specs/<slug>/spec.md\`
Roles: Developer, Reviewer, Security
\`\`\`
`;
}

const PLANNING_CONVENTIONS = `- Грилинг заканчивается брифом эпика, \`docs/specs/<epic>/brief.md\`: что решено, словами владельца, в пяти частях — проблема, желаемый результат, кого это касается, какие системы затронуты, ограничения и открытые вопросы. Владелец читает его целиком перед \`/to-spec\`, который начинает с него, а следующий шаг (Next action), ведущий к грилингу эпика, называет его бриф
- Спецификация перечисляет спорные моменты под заголовком \`## Contested points\`: где требования противоречат друг другу или выбор был близким, у каждого — выбранный вариант`;

const REMOTE_SPECS = `- Спецификация — это файл \`docs/specs/<slug>/spec.md\`, закоммиченный в Git, и никогда не issue; issue называет её в строке \`Spec:\`
${PLANNING_CONVENTIONS}`;

const remotePublish = (forge: string): string => `## Когда скилл говорит "publish to the issue tracker"

Создайте issue в ${forge} для тикета. Спецификация или бриф — это файл в \`docs/specs/<slug>/\`, закоммиченный в Git.`;

/** `docs/agents/issue-tracker.md` before its ticket header, by tracker, in Russian. */
export const TRACKER_FILES_RU: Record<TrackerProvider, string> = {
  local: `# Трекер задач: локальный Markdown

Спецификации и задачи этого репозитория лежат Markdown-файлами в Git, в \`docs/specs/\`.

## Соглашения

- Одна работа — один каталог: \`docs/specs/<slug>/\`
- Спецификация — \`docs/specs/<slug>/spec.md\`
- Задачи на реализацию — по файлу на тикет, \`docs/specs/<slug>/issues/NN-<slug>.md\`, с номерами от \`01\`, и никогда не один общий файл тикетов
- Два отдельных поля в начале каждого файла задачи: \`Status:\`, состояние тикета (см. *Ticket header* ниже), и \`Triage:\`, строка роли из \`triage-labels.md\`
- Комментарии и история обсуждения дописываются в конец файла под заголовком \`## Comments\`
${PLANNING_CONVENTIONS}

## Когда скилл говорит "publish to the issue tracker"

Создайте новый файл в \`docs/specs/<slug>/\` (и каталог, если его нет).

## Когда скилл говорит "fetch the relevant ticket"

Прочитайте файл по указанному пути. Обычно пользователь передаёт путь или номер задачи прямо.

## Операции wayfinding

Их использует \`/wayfinder\`. **Карта** — это файл, а у каждого тикета свой **дочерний** файл.

- **Карта**: \`docs/specs/<effort>/map.md\` (тело Notes / Decisions-so-far / Fog).
- **Дочерний тикет**: \`docs/specs/<effort>/issues/NN-<slug>.md\`, с номерами от \`01\`, вопрос — в теле. Строка \`Type:\` записывает тип тикета (\`research\`/\`prototype\`/\`grilling\`/\`task\`); строка \`Status:\` записывает \`claimed\`/\`resolved\`.
- **Блокировка**: строка \`Blocked by: NN, NN\` в начале файла. Тикет разблокирован, когда каждый перечисленный в ней файл в состоянии \`resolved\`.
- **Фронтир**: просмотреть \`docs/specs/<effort>/issues/\` и найти открытые, разблокированные и никем не занятые файлы; берётся первый по номеру.
- **Занять**: поставить \`Status: claimed\` и сохранить до начала работы.
- **Решить**: дописать ответ под заголовком \`## Answer\`, поставить \`Status: resolved\`, затем дописать указатель на контекст (суть и ссылку) в Decisions-so-far карты, в \`map.md\`.
`,
  github: `# Трекер задач: GitHub

Задачи этого репозитория — issues на GitHub, а спецификации — файлы в Git, в \`docs/specs/\`. Все операции с issues выполняйте через CLI \`gh\`.

## Соглашения

- **Создать issue**: \`gh issue create --title "..." --body "..."\`. Многострочное описание передавайте через heredoc.
- **Прочитать issue**: \`gh issue view <number> --comments\`, отфильтровав комментарии через \`jq\` и получив заодно метки.
- **Список issues**: \`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'\` с подходящими фильтрами \`--label\` и \`--state\`.
- **Прокомментировать issue**: \`gh issue comment <number> --body "..."\`
- **Поставить / снять метки**: \`gh issue edit <number> --add-label "..."\` / \`--remove-label "..."\`
- **Закрыть**: \`gh issue close <number> --comment "..."\`
${REMOTE_SPECS}

Репозиторий определяйте по \`git remote -v\`; \`gh\` делает это сам, когда запущен внутри клона.

## Pull request как поверхность триажа

**PRs as a request surface: no.** _(Поставьте \`yes\`, если этот репозиторий считает внешние PR запросами на доработку; \`/triage\` читает этот флаг.)_

При \`yes\` PR проходят через те же метки и состояния, что и issues, с аналогами из \`gh pr\`:

- **Прочитать PR**: \`gh pr view <number> --comments\` и \`gh pr diff <number>\` для диффа.
- **Список внешних PR для триажа**: \`gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments\`, затем оставить только те, у которых \`authorAssociation\` равен \`CONTRIBUTOR\`, \`FIRST_TIME_CONTRIBUTOR\` или \`NONE\` (отбросить \`OWNER\`/\`MEMBER\`/\`COLLABORATOR\`).
- **Комментарий / метки / закрытие**: \`gh pr comment\`, \`gh pr edit --add-label\`/\`--remove-label\`, \`gh pr close\`.

На GitHub у issues и PR общая нумерация, поэтому голый \`#42\` может быть и тем и другим: проверьте через \`gh pr view 42\`, а если не вышло — через \`gh issue view 42\`.

${remotePublish('GitHub')}

## Когда скилл говорит "fetch the relevant ticket"

Выполните \`gh issue view <number> --comments\`.

## Операции wayfinding

Их использует \`/wayfinder\`. **Карта** — это один issue, а тикеты — его **дочерние** issues.

- **Карта**: один issue с меткой \`wayfinder:map\`, в теле Notes / Decisions-so-far / Fog. \`gh issue create --label wayfinder:map\`.
- **Дочерний тикет**: issue, привязанный к карте как sub-issue GitHub (\`gh api\` к эндпоинту sub-issues). Где sub-issues не включены, добавьте дочерний issue в список задач в теле карты и поставьте \`Part of #<map>\` в начало его описания. Метки: \`wayfinder:<type>\` (\`research\`/\`prototype\`/\`grilling\`/\`task\`). Занятый тикет назначается на разработчика, который его ведёт.
- **Блокировка**: **встроенные зависимости issues** GitHub, каноническое представление, видимое в интерфейсе. Связь добавляется через \`gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>\`, где \`<blocker-db-id>\` — числовой **database id** блокирующего issue (\`gh api repos/<owner>/<repo>/issues/<n> --jq .id\`, _не_ \`#number\` и не \`node_id\`). GitHub сообщает \`issue_dependencies_summary.blocked_by\` (только открытые блокеры, текущее условие). Где зависимости недоступны, используйте строку \`Blocked by: #<n>, #<n>\` в начале описания дочернего issue. Тикет разблокирован, когда закрыт каждый его блокер.
- **Запрос фронтира**: перечислить открытые дочерние issues карты (\`gh issue list --state open\`, в пределах sub-issues или списка задач карты), отбросить те, у которых есть открытый блокер (\`issue_dependencies_summary.blocked_by > 0\` или открытый issue в строке \`Blocked by\`) или исполнитель; берётся первый в порядке карты.
- **Занять**: \`gh issue edit <n> --add-assignee @me\`, первая запись сессии.
- **Решить**: \`gh issue comment <n> --body "<answer>"\`, затем \`gh issue close <n>\`, затем дописать указатель на контекст (суть и ссылку) в Decisions-so-far карты.
`,
  gitlab: `# Трекер задач: GitLab

Задачи этого репозитория — issues в GitLab, а спецификации — файлы в Git, в \`docs/specs/\`. Все операции с issues выполняйте через CLI [\`glab\`](https://gitlab.com/gitlab-org/cli).

## Соглашения

- **Создать issue**: \`glab issue create --title "..." --description "..."\`. Многострочное описание передавайте через heredoc. \`--description -\` открывает редактор.
- **Прочитать issue**: \`glab issue view <number> --comments\`. Для машиночитаемого вывода — \`-F json\`.
- **Список issues**: \`glab issue list -F json\` с подходящими фильтрами \`--label\`.
- **Прокомментировать issue**: \`glab issue note <number> --message "..."\`. Комментарии в GitLab называются notes.
- **Поставить / снять метки**: \`glab issue update <number> --label "..."\` / \`--unlabel "..."\`. Несколько меток пишутся через запятую или повтором флага.
- **Закрыть**: \`glab issue close <number>\`. \`glab issue close\` не принимает комментарий при закрытии, поэтому сначала опубликуйте объяснение через \`glab issue note <number> --message "..."\`, а потом закройте.
- **Merge request**: так в GitLab называются PR. Используйте \`glab mr create\`, \`glab mr view\`, \`glab mr note\` и так далее, по образцу \`gh pr ...\`, с \`mr\` вместо \`pr\` и \`note\`/\`--message\` вместо \`comment\`/\`--body\`.
${REMOTE_SPECS}

Репозиторий определяйте по \`git remote -v\`; \`glab\` делает это сам, когда запущен внутри клона.

## Merge request как поверхность триажа

**MRs as a request surface: no.** _(Поставьте \`yes\`, если этот репозиторий считает внешние merge request запросами на доработку; \`/triage\` читает этот флаг.)_

При \`yes\` MR проходят через те же метки и состояния, что и issues, с аналогами из \`glab mr\`:

- **Прочитать MR**: \`glab mr view <number> --comments\` и \`glab mr diff <number>\` для диффа.
- **Список внешних MR для триажа**: \`glab mr list -F json\`, затем оставить только MR, автор которых не участник и не владелец проекта (MR контрибьютора, а не текущая работа мейнтейнера).
- **Комментарий / метки / закрытие**: \`glab mr note\`, \`glab mr update --label\`/\`--unlabel\`, \`glab mr close\`.

В отличие от GitHub, GitLab нумерует issues и MR отдельно, поэтому \`#42\` однозначен, когда известно, о чём говорит мейнтейнер.

${remotePublish('GitLab')}

## Когда скилл говорит "fetch the relevant ticket"

Выполните \`glab issue view <number> --comments\`.

## Операции wayfinding

Их использует \`/wayfinder\`. **Карта** — это один issue, а тикеты — его **дочерние** issues.

- **Карта**: один issue с меткой \`wayfinder:map\`, в теле Notes / Decisions-so-far / Fog. \`glab issue create --label wayfinder:map\`. (В тарифах GitLab со встроенными эпиками карту может держать эпик; issue с меткой работает везде.)
- **Дочерний тикет**: issue с \`Part of #<map>\` в начале описания и метками \`wayfinder:<type>\` (\`research\`/\`prototype\`/\`grilling\`/\`task\`). Занятый тикет назначается на разработчика, который его ведёт.
- **Блокировка**: **встроенная блокирующая связь** GitLab, каноническое представление, видимое в интерфейсе. Добавьте её быстрым действием \`/blocked_by #<n>\`, опубликованным как note (\`glab issue note <child> --message "/blocked_by #<blocker>"\`). Встроенные блокирующие связи есть только в Premium/Ultimate; на бесплатном тарифе (или где их нет) используйте строку \`Blocked by: #<n>, #<n>\` в начале описания. Тикет разблокирован, когда закрыт каждый его блокер.
- **Запрос фронтира**: \`glab issue list -F json\` в пределах дочерних issues карты, отбросить те, у которых есть открытый блокер: встроенная связь \`blocked_by\` с открытым issue (\`glab api projects/:id/issues/:iid/links\`), открытый issue в строке \`Blocked by\` или исполнитель; берётся первый в порядке карты.
- **Занять**: \`glab issue update <n> --assignee @me\`, первая запись сессии.
- **Решить**: \`glab issue note <n> --message "<answer>"\`, затем \`glab issue close <n>\`, затем дописать указатель на контекст (суть и ссылку) в Decisions-so-far карты.
`,
};

export const TRIAGE_LABELS_FILE_RU = `# Метки триажа

Скиллы говорят о пяти канонических ролях триажа. Этот файл сопоставляет эти роли строкам меток, которые на деле используются в трекере этого репозитория.

| Метка в mattpocock/skills | Метка в нашем трекере | Значение                                       |
| ------------------------- | --------------------- | ---------------------------------------------- |
| \`needs-triage\`            | \`needs-triage\`        | Мейнтейнеру нужно оценить эту задачу           |
| \`needs-info\`              | \`needs-info\`          | Ждём от автора больше информации               |
| \`ready-for-agent\`         | \`ready-for-agent\`     | Полностью описана, готова для агента без людей |
| \`ready-for-human\`         | \`ready-for-human\`     | Нужна реализация человеком                     |
| \`wontfix\`                 | \`wontfix\`             | Делаться не будет                              |

Когда скилл упоминает роль (например, «поставь метку готовности для агента»), используйте соответствующую строку метки из этой таблицы.

Правьте правый столбец меток под словарь, которым вы пользуетесь на деле.
`;

export const DOMAIN_FILE_RU = `# Документация домена

Как инженерным скиллам читать документацию домена этого репозитория, когда они исследуют код.

## Перед исследованием прочитайте

- **\`CONTEXT.md\`** в корне репозитория: канонический глоссарий.
- **\`docs/adr/\`**: ADR, которые касаются области, где вы собираетесь работать.

Если каких-то из этих файлов нет, **продолжайте молча**. Не отмечайте их отсутствие и не предлагайте создать их заранее. Скилл \`/domain-modeling\` (через \`/grill-with-docs\` и \`/improve-codebase-architecture\`) создаёт их по мере надобности, когда термины или решения действительно определены.

## Структура файлов

В этом репозитории **один контекст**: один глоссарий и один каталог ADR в корне.

\`\`\`
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
\`\`\`

## Пользуйтесь словарём глоссария

Когда ваш текст называет понятие домена (в заголовке задачи, предложении рефакторинга, гипотезе, имени теста), используйте термин так, как он определён в \`CONTEXT.md\`. Не сползайте к синонимам, которых глоссарий прямо избегает.

Если нужного понятия в глоссарии ещё нет, это сигнал: либо вы придумываете язык, которым проект не пользуется (подумайте ещё раз), либо это настоящий пробел (отметьте его для \`/domain-modeling\`).

## Отмечайте конфликты с ADR

Если ваш текст противоречит существующему ADR, скажите об этом явно, а не переписывайте его молча:

> _Противоречит ADR-0007 (заказы на event sourcing), но стоит пересмотреть, потому что…_
`;

const WHERE_ISSUES: Record<TrackerProvider, string> = {
  local: 'Спецификации и задачи лежат Markdown-файлами в Git, в `docs/specs/<slug>/`.',
  github: 'Задачи — в GitHub Issues этого репозитория, а спецификации — в Git, в `docs/specs/<slug>/`.',
  gitlab: 'Задачи — в GitLab Issues этого репозитория, а спецификации — в Git, в `docs/specs/<slug>/`.',
};

/** `agentSkillsBlock` in Russian, with the line that states the documentation language. */
export const agentSkillsBlockRu = (provider: TrackerProvider): string => `
## Agent skills

Документация этого репозитория ведётся на русском: спецификации, тикеты и остальные документы пишите на русском, а маркеры, которые читает Binnacle, оставляйте английскими.

### Трекер задач

${WHERE_ISSUES[provider]} См. \`docs/agents/issue-tracker.md\`.

### Метки триажа

Пять канонических ролей триажа, строки меток используются дословно. См. \`docs/agents/triage-labels.md\`.

### Документация домена

Один контекст: \`CONTEXT.md\` и \`docs/adr/\` в корне репозитория. См. \`docs/agents/domain.md\`.
`;
