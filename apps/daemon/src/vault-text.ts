import { wordMessage, type Diagnostic, type Coded, type Language, type Params } from '@binnacle/core';
import { FALLBACK_DAYS } from './daily.ts';

/**
 * The vault's own words, the snapshot's and the daily's headings and generated lines, in the
 * repository language (spec `human-output`, *The vault's own words in the repository language*),
 * with the Russian terms `CONTEXT.md` lists. English is the notes as they were before the
 * language. A value Binnacle reports only as an English sentence, a reason with no code, is
 * written as it is, and in Russian marked `(англ.)`.
 */
export type VaultWords = {
  none: string;
  more: (count: number) => string;
  untitled: string;
  /** A Task's state; null when the tracker gave none. */
  state: (state: string | null) => string;
  /** An English sentence from the daemon, marked as such in Russian. */
  english: (text: string) => string;
  attention: (item: Diagnostic) => string;
  /** A value not available, worded from its code when it has one. */
  notAvailable: (value: { reason: string; code?: string; params?: Params }) => string;
  waiting: string;
  questions: string;
  onBranch: (branch: string) => string;
  approvals: string;
  ownersToStart: string;
  ci: string;
  ciState: (state: string) => string;
  ciHead: (branch: string, forge: string, repository: string, state: string, commit: string, at: string | null) => string;
  providerReported: (url: string) => string;
  openRequests: string;
  draft: string;
  snapshotTitle: (name: string) => string;
  servedFrom: (branch: string | null, commit: string | null, dirty: boolean) => string;
  servedWithoutGit: (reason: string) => string;
  next: string;
  nextAction: (description: string, command: string) => string;
  noNextAction: string;
  noSuggestedStep: (reason: string) => string;
  tasks: string;
  trackerUnreadable: string;
  inFlight: string;
  readyToStart: string;
  parallel: string;
  limit: (limit: number, auto: boolean, source: 'manifest' | 'machine' | 'default', inProgress: number, free: number) => string;
  noConflictRisk: (reason: string) => string;
  pair: (tasks: string[], risk: string, reason: string) => string;
  decisions: string;
  noAdrDirectory: string;
  graph: string;
  graphAvailable: string;
  noGraph: (reason: string) => string;
  builtFrom: (commit: string, at: string, behind: boolean) => string;
  lastRun: (commit: string, at: string, failed: string | null) => string;
  attentionHeading: string;
  dailyTitle: (name: string) => string;
  trackerUnreadableNow: string;
  range: (from: string | null, source: string, head: string, dirty: boolean) => string;
  fallback: (fallback: { reason: string; message: string }) => string;
  commits: (count: number) => string;
  statusChanges: string;
  transition: (from: string | null, to: string | null) => string;
  newTickets: string;
  roadmap: string;
  noRoadmap: string;
  epic: (number: number, title: string, from: string | null, to: string) => string;
  change: (change: 'added' | 'changed') => string;
};

const ENGLISH: VaultWords = {
  none: 'None.',
  more: (count) => `and ${count} more`,
  untitled: 'untitled',
  state: (state) => state ?? 'unknown',
  english: (text) => text,
  attention: (item) => `\`${item.code}\`: ${item.message}`,
  notAvailable: (value) => `Not available: ${value.reason}`,
  waiting: '## Waiting for the owner',
  questions: '### Questions',
  onBranch: (branch) => ` on \`${branch}\``,
  approvals: '### Approvals',
  ownersToStart: '### The owner’s to start',
  ci: '## CI',
  ciState: (state) => state,
  ciHead: (branch, forge, repository, state, commit, at) => `\`${branch}\` on ${forge} (${repository}): ${state} at \`${commit}\`${at ? `, ${at}` : ''}`,
  providerReported: (url) => ` (provider reported). ${url}`,
  openRequests: '### Open pull requests',
  draft: ' (draft)',
  snapshotTitle: (name) => `# Snapshot of ${name}`,
  servedFrom: (branch, commit, dirty) => `Served from \`${branch ?? 'a detached HEAD'}\` at \`${commit ?? 'no commit'}\`${dirty ? ', with uncommitted changes' : ''}.`,
  servedWithoutGit: (reason) => `Served without Git: ${reason}`,
  next: '## Next',
  nextAction: (description, command) => `Next action: ${description} \`${command}\``,
  noNextAction: "The roadmap's focus names no Next action.",
  noSuggestedStep: (reason) => `Suggested step not available: ${reason}`,
  tasks: '## Tasks',
  trackerUnreadable: 'The tracker cannot be read; the attention says why.',
  inFlight: '## In flight',
  readyToStart: '## Ready to start',
  parallel: '## Parallel',
  limit: (limit, auto, source, inProgress, free) => `Limit ${limit}${auto ? ' (auto)' : ''}, from the ${source}, in progress ${inProgress}, free ${free} (calculated).`,
  noConflictRisk: (reason) => `Conflict risk not available: ${reason}`,
  pair: (tasks, risk, reason) => `${tasks.join(' and ')}: ${risk} — ${reason} (calculated)`,
  decisions: '## Decisions',
  noAdrDirectory: 'This project declares no ADR directory.',
  graph: '## Graph',
  graphAvailable: 'A graph is available.',
  noGraph: (reason) => `No graph: ${reason}`,
  builtFrom: (commit, at, behind) => ` Built from \`${commit}\` at ${at}${behind ? ', and the default branch has moved past it' : ''}.`,
  lastRun: (commit, at, failed) => ` The last run, of \`${commit}\` at ${at}, ${failed === null ? 'built' : `failed: ${failed}`}.`,
  attentionHeading: '## Attention',
  dailyTitle: (name) => `# Daily of ${name}`,
  trackerUnreadableNow: 'The tracker cannot be read now; the attention says why.',
  range: (from, source, head, dirty) =>
    `From ${from ? `\`${from}\`` : 'the first commit'} (${source}) to \`${head}\`${dirty ? ', with uncommitted changes left out' : ''}.`,
  fallback: (fallback) => fallback.message,
  commits: (count) => `## Commits (${count})`,
  statusChanges: '## Status changes',
  transition: (from, to) => `${from ?? 'none'} → ${to ?? 'none'}`,
  newTickets: '## New tickets',
  roadmap: '## Roadmap',
  noRoadmap: 'There is no roadmap.',
  epic: (number, title, from, to) => `Epic ${number}, ${title}: ${from ?? 'new'} → ${to}`,
  change: (change) => change,
};

const TASK_STATE: Record<string, string> = {
  BACKLOG: 'бэклог',
  READY: 'готова',
  ACTIVE: 'в работе',
  BLOCKED: 'заблокирована',
  READY_FOR_REVIEW: 'на ревью',
  APPROVED: 'одобрена',
  MERGE_READY: 'готова к слиянию',
  MERGED: 'слита',
  DONE: 'готово',
  CANCELLED: 'отменена',
};
const EPIC_STATUS: Record<string, string> = { 'not started': 'не начат', spec: 'спецификация', tickets: 'тикеты', 'in progress': 'в работе', done: 'готов' };
const CI_STATE: Record<string, string> = { passing: 'проходит', failing: 'падает', running: 'идёт', none: 'нет проверок' };
const RISK: Record<string, string> = { high: 'высокий', medium: 'средний', low: 'низкий', unknown: 'неизвестен' };
const LIMIT_SOURCE = { manifest: 'из манифеста', machine: 'из настроек машины', default: 'по умолчанию' };
const RANGE_SOURCE: Record<string, string> = { daily: 'от прошлого daily', checkpoint: 'от чекпойнта', since: 'от указанного коммита', fallback: 'запасное окно' };
const FALLBACK: Record<string, string> = {
  no_baseline: 'Для этого проекта на этой машине ещё не записан ни daily, ни чекпойнт.',
  baseline_missing: 'Записанная точка отсчёта — не коммит этого репозитория.',
  baseline_diverged: 'Записанная точка отсчёта — не предок HEAD: история переписана, или эта рабочая копия на другой линии работы.',
};
const DAYS: Partial<Record<Intl.LDMLPluralRule, string>> = { one: 'день', few: 'дня' };
/** A value the table does not know is written as it came. */
const word = (table: Record<string, string>, value: string): string => table[value] ?? value;
const english = (text: string): string => `${text} (англ.)`;
const worded = (item: Coded): string => {
  const { text, english: marked } = wordMessage('ru', item);
  return marked ? english(text) : text;
};

const RUSSIAN: VaultWords = {
  none: 'Нет.',
  more: (count) => `и ещё ${count}`,
  untitled: 'без названия',
  state: (state) => (state === null ? 'неизвестно' : word(TASK_STATE, state)),
  english,
  attention: (item) => worded(item),
  notAvailable: (value) => `Нет данных: ${value.code === undefined ? english(value.reason) : worded({ code: value.code, message: value.reason, ...(value.params && { params: value.params }) })}`,
  waiting: '## Ждёт владельца',
  questions: '### Вопросы',
  onBranch: (branch) => ` в ветке \`${branch}\``,
  approvals: '### Ждут одобрения',
  ownersToStart: '### Запускает владелец',
  ci: '## CI',
  ciState: (state) => word(CI_STATE, state),
  ciHead: (branch, forge, repository, state, commit, at) => `\`${branch}\` на ${forge} (${repository}): ${state} на \`${commit}\`${at ? `, ${at}` : ''}`,
  providerReported: (url) => ` (по данным провайдера). ${url}`,
  openRequests: '### Открытые пул-реквесты',
  draft: ' (черновик)',
  snapshotTitle: (name) => `# Снимок проекта ${name}`,
  servedFrom: (branch, commit, dirty) =>
    `Снят с \`${branch ?? 'отсоединённого HEAD'}\` на \`${commit ?? 'без коммита'}\`${dirty ? ', с незакоммиченными изменениями' : ''}.`,
  servedWithoutGit: (reason) => `Снят без Git: ${english(reason)}`,
  next: '## Следующий шаг',
  nextAction: (description, command) => `Следующий шаг: ${description} \`${command}\``,
  noNextAction: 'Фокус роадмапа не называет следующего шага.',
  noSuggestedStep: (reason) => `Предложенный шаг: нет данных — ${english(reason)}`,
  tasks: '## Задачи',
  trackerUnreadable: 'Трекер не читается; почему — в разделе «Внимание».',
  inFlight: '## В работе',
  readyToStart: '## Готовы к старту',
  parallel: '## Параллельная работа',
  limit: (limit, auto, source, inProgress, free) => `Лимит ${limit}${auto ? ' (авто)' : ''}, ${LIMIT_SOURCE[source]}, в работе ${inProgress}, свободно ${free} (оценка).`,
  noConflictRisk: (reason) => `Риск конфликта: нет данных — ${english(reason)}`,
  pair: (tasks, risk, reason) => `${tasks.join(' и ')}: риск конфликта ${word(RISK, risk)} (оценка) — ${english(reason)}`,
  decisions: '## Решения',
  noAdrDirectory: 'Проект не объявляет каталог ADR.',
  graph: '## Граф',
  graphAvailable: 'Граф есть.',
  noGraph: (reason) => `Графа нет: ${english(reason)}`,
  builtFrom: (commit, at, behind) => ` Построен из \`${commit}\` в ${at}${behind ? ', и основная ветка ушла дальше' : ''}.`,
  lastRun: (commit, at, failed) => ` Последний запуск, по \`${commit}\` в ${at}, ${failed === null ? 'построил граф' : `упал: ${english(failed)}`}.`,
  attentionHeading: '## Внимание',
  dailyTitle: (name) => `# Сводка дня: ${name}`,
  trackerUnreadableNow: 'Трекер сейчас не читается; почему — в разделе «Внимание».',
  range: (from, source, head, dirty) =>
    `С ${from ? `\`${from}\`` : 'первого коммита'} (${word(RANGE_SOURCE, source)}) до \`${head}\`${dirty ? ', незакоммиченные изменения не учтены' : ''}.`,
  fallback: (fallback) =>
    `${Object.hasOwn(FALLBACK, fallback.reason) ? FALLBACK[fallback.reason] : english(fallback.message)} Вместо этого — коммиты за последние ${FALLBACK_DAYS} ${DAYS[new Intl.PluralRules('ru').select(FALLBACK_DAYS)] ?? 'дней'}.`,
  commits: (count) => `## Коммиты (${count})`,
  statusChanges: '## Смена статусов',
  transition: (from, to) => `${from === null ? 'нет' : word(TASK_STATE, from)} → ${to === null ? 'нет' : word(TASK_STATE, to)}`,
  newTickets: '## Новые тикеты',
  roadmap: '## Роадмап',
  noRoadmap: 'Роадмапа нет.',
  epic: (number, title, from, to) => `Эпик ${number}, ${title}: ${from === null ? 'новый' : word(EPIC_STATUS, from)} → ${word(EPIC_STATUS, to)}`,
  change: (change) => (change === 'added' ? 'добавлено' : 'изменено'),
};

/** The vault's words for a repository whose manifest states `language`; none is English. */
export const vaultWords = (language: Language | null): VaultWords => (language === 'ru' ? RUSSIAN : ENGLISH);
