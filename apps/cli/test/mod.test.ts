import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from '../src/mod/hooks.ts';
import { view, type ViewInput } from '../src/mod/view.ts';

/** A token field as the snapshot sums it: `tokens` null when no record reported it, `partial` when only some did. */
const field = (tokens: number | null, partial = false) => ({ tokens, partial, provenance: tokens === null ? null : ('provider_reported' as const) });
const totals = (output: number | null, partial = false) => ({
  records: 3,
  input: field(20_000),
  cachedInput: field(1_000_000),
  cacheCreation: field(100_000),
  output: field(output, partial),
  reasoning: field(null),
});
type Own = { taskId: string | null; taskTitle: string | null; role: 'product' | 'implementation' | 'review' | 'rework' | 'unknown'; totals: ReturnType<typeof totals> };
/** Nothing waiting for the owner, as `project.snapshot` answers it. */
const NOTHING_PENDING = { questions: { items: [], remainder: 0 }, approvals: { items: [], remainder: 0 }, owner: { items: [], remainder: 0 } };
/** The snapshot as `project.snapshot` answers it for a named session, on a Task's branch, with nothing waiting: `rest` replaces a section. */
const snapshot = (own: Own | null | undefined, rest: Record<string, unknown> = {}) =>
  ({
    project: { id: 'binnacle', name: 'Binnacle', path: '/project' },
    activity: { running: { items: [], remainder: 0 }, recent: [], ...(own !== undefined && { own }) },
    checkout: { root: '/project', registered: true, taskId: 'claude-code-mod/03' },
    roadmap: null,
    next: { action: null, alternatives: [] },
    tasks: null,
    pendingDecisions: NOTHING_PENDING,
    ci: { available: false, reason: NO_FORGE, code: 'ci.no_forge' },
    attention: [],
    ...rest,
  }) as unknown as NonNullable<ViewInput['snapshot']>;
const NO_FORGE = 'There is no forge to read CI from.';
const onTask: Own = { taskId: 'claude-code-mod/02', taskTitle: "The mod's status line", role: 'implementation', totals: totals(80_000) };
const product: Own = { taskId: null, taskTitle: null, role: 'product', totals: totals(520) };
const FULL = { context: { window: 200_000, tokens: 84_000, percent: 42 }, rateLimits: [{ kind: 'five_hour', percentUsed: 23.5 }, { kind: 'seven_day', percentUsed: 7 }] };
const NONE = { context: { window: 200_000 }, rateLimits: [] };
/** Russian's short counts keep a no-break space before their unit, as `Intl` writes them. */
const NBSP = ' ';
const ON_TASK_EN = 'claude-code-mod/02 implementation · 80K output tokens (from activity) · context 42% · 5h 23.5% · 7d 7%';

test("a session on a Task shows its id and role, its tokens from activity.own, its context and each rate-limit window's use", () => {
  assert.equal(view({ snapshot: snapshot(onTask), ...FULL, language: 'en' }).status, ON_TASK_EN);
  assert.equal(
    view({ snapshot: snapshot(onTask), ...FULL, language: 'ru' }).status,
    `claude-code-mod/02 реализация · 80${NBSP}тыс. выходных токенов (по активности) · контекст 42% · 5 ч 23,5% · 7 дн 7%`,
  );
});

test('a session with no Task shows its role, and nothing for the Task without a run', () => {
  assert.equal(view({ snapshot: snapshot(product), ...NONE, language: 'en' }).status, 'product session · 520 output tokens (from activity)');
  assert.equal(view({ snapshot: snapshot(product), ...NONE, language: 'ru' }).status, 'продуктовая сессия · 520 выходных токенов (по активности)');
  // Binnacle has stored no run of the session yet, as on its first refresh: Claude Code's own figures alone.
  assert.equal(view({ snapshot: snapshot(null), ...FULL, language: 'en' }).status, 'context 42% · 5h 23.5% · 7d 7%');
  assert.equal(view({ snapshot: snapshot(null), ...NONE, language: 'en' }).status, undefined);
  // An unknown role is no data, and a Task with it shows its id alone.
  assert.equal(view({ snapshot: snapshot({ ...onTask, role: 'unknown' }), ...NONE, language: 'en' }).status, 'claude-code-mod/02 · 80K output tokens (from activity)');
  assert.equal(view({ snapshot: snapshot({ ...product, role: 'unknown' }), ...NONE, language: 'en' }).status, '520 output tokens (from activity)');
});

test('the tokens are one kind, output, never added to another, in short form and agreeing with their noun', () => {
  const tokens = (output: number | null, language: 'en' | 'ru', partial = false) =>
    view({ snapshot: snapshot({ ...product, role: 'unknown', totals: totals(output, partial) }), ...NONE, language }).status;
  assert.equal(tokens(1, 'en'), '1 output token (from activity)');
  assert.equal(tokens(1_234_567, 'en'), '1.2M output tokens (from activity)');
  assert.equal(tokens(1, 'ru'), '1 выходной токен (по активности)');
  assert.equal(tokens(3, 'ru'), '3 выходных токена (по активности)');
  assert.equal(tokens(11, 'ru'), '11 выходных токенов (по активности)');
  assert.equal(tokens(21, 'ru'), '21 выходной токен (по активности)');
  assert.equal(tokens(25_300, 'ru'), `25,3${NBSP}тыс. выходных токенов (по активности)`);
  assert.equal(tokens(1_234_567, 'ru'), `1,2${NBSP}млн выходных токенов (по активности)`);
  // A sum only some records report is marked partial; one none reports is no data, and the part is left out.
  assert.equal(tokens(500, 'en', true), '500 output tokens (from activity, partial)');
  assert.equal(tokens(500, 'ru', true), '500 выходных токенов (по активности, частично)');
  assert.equal(tokens(null, 'en'), undefined);
});

test('a part with no data is left out, never shown as zero', () => {
  assert.equal(view({ snapshot: snapshot({ ...onTask, totals: totals(null) }), ...NONE, language: 'en' }).status, 'claude-code-mod/02 implementation');
  // A snapshot asked without `session`, or whose activity is marked unavailable, has no `own`.
  assert.equal(view({ snapshot: snapshot(undefined), ...NONE, language: 'en' }).status, undefined);
  const unavailable = snapshot(undefined, { activity: { available: false, reason: 'The tracker could not be read' } });
  assert.equal(view({ snapshot: unavailable, ...FULL, language: 'en' }).status, 'context 42% · 5h 23.5% · 7d 7%');
  // A gateway's window has no word of its own and is named as Claude Code names it.
  assert.equal(view({ snapshot: snapshot(null), context: { window: 1 }, rateLimits: [{ kind: 'spend_limit', percentUsed: 104 }], language: 'en' }).status, 'spend_limit 104%');
});

test('without a snapshot the line is cleared, and there is no band and no session-start line', () => {
  assert.deepEqual(view({ snapshot: null, ...FULL, language: 'en' }), { status: undefined, band: undefined, startLines: undefined, pane: undefined, toasts: [], seen: undefined, store: undefined });
});

/** A Task item of the snapshot's *Waiting for the owner*, by its id. */
const task = (id: string) => ({ id, title: `Ticket ${id}`, state: 'READY', unmetDependencies: [], ticket: `docs/specs/${id}.md`, questions: null });
const question = (id: string) => ({ id, title: `Ticket ${id}`, ticket: `docs/specs/${id}.md`, question: 'Which one?', branch: null });
const pending = (questions: number, approvals: number, owner: number, remainder = 0) => ({
  questions: { items: Array.from({ length: questions }, (_, n) => question(`spec/0${n + 1}`)), remainder },
  approvals: { items: Array.from({ length: approvals }, (_, n) => task(`spec/1${n + 1}`)), remainder: 0 },
  owner: { items: Array.from({ length: owner }, (_, n) => task(`spec/2${n + 1}`)), remainder: 0 },
});
/** The two attention items the band shows, as the daemon writes them. */
const CI_FAILING = {
  code: 'ci.failing',
  message: 'CI is failing on main at 0123456789ab, as GitHub reports it: https://github.com/o/r/commit/0123456789ab',
  params: { branch: 'main', commit: '0123456789ab', forge: 'GitHub', url: 'https://github.com/o/r/commit/0123456789ab' },
};
const CI_FAILING_RU = 'CI падает в main на 0123456789ab, по данным GitHub: https://github.com/o/r/commit/0123456789ab';
const STALE = {
  code: 'next_action.stale',
  message: "The Next action's command, /binnacle:task run spec/01, names finished work: spec/01.",
  params: { command: '/binnacle:task run spec/01', tasks: 'spec/01' },
};
const band = (rest: Record<string, unknown>, language: 'en' | 'ru' = 'en') => view({ snapshot: snapshot(null, rest), ...NONE, language }).band;

test('no band with nothing waiting', () => {
  assert.equal(band({}), undefined);
  // Another attention item is not the band's.
  assert.equal(band({ attention: [{ code: 'graph.stale', message: 'The graph is stale.' }] }), undefined);
});

test('each kind of item alone, counted with the first Task id, in English and Russian', () => {
  assert.deepEqual(band({ pendingDecisions: pending(1, 0, 0) }), { title: 'Waiting for you', items: ['Unanswered questions: 1 (spec/01)'] });
  assert.deepEqual(band({ pendingDecisions: pending(2, 0, 0, 3) }, 'ru'), { title: 'Ждёт вас', items: ['Вопросы без ответа: 5 (сначала spec/01)'] });
  assert.deepEqual(band({ pendingDecisions: pending(0, 2, 0) })?.items, ['Waiting for an approval: 2 (spec/11 first)']);
  assert.deepEqual(band({ pendingDecisions: pending(0, 1, 0) }, 'ru')?.items, ['Ждут одобрения: 1 (spec/11)']);
  assert.deepEqual(band({ pendingDecisions: pending(0, 0, 1) })?.items, ['Yours to start: 1 (spec/21)']);
  assert.deepEqual(band({ pendingDecisions: pending(0, 0, 3) }, 'ru')?.items, ['Начать вам: 3 (сначала spec/21)']);
  assert.deepEqual(band({ attention: [CI_FAILING] })?.items, [CI_FAILING.message]);
  assert.deepEqual(band({ attention: [CI_FAILING] }, 'ru')?.items, [CI_FAILING_RU]);
});

test('next_action.stale is worded by its code, as /binnacle:product words it', () => {
  assert.deepEqual(band({ attention: [STALE] })?.items, [STALE.message]);
  assert.deepEqual(band({ attention: [STALE] }, 'ru')?.items, ['Команда следующего шага, /binnacle:task run spec/01, называет завершённую работу: spec/01.']);
  // Params core cannot word leave the daemon's English, marked.
  assert.deepEqual(band({ attention: [{ ...STALE, params: { command: '/x' } }] }, 'ru')?.items, [`${STALE.message} (англ.)`]);
});

test('every kind together, in order', () => {
  assert.deepEqual(band({ pendingDecisions: pending(1, 1, 1), attention: [STALE, CI_FAILING] })?.items, [
    'Unanswered questions: 1 (spec/01)',
    'Waiting for an approval: 1 (spec/11)',
    'Yours to start: 1 (spec/21)',
    STALE.message,
    CI_FAILING.message,
  ]);
  assert.deepEqual(band({ pendingDecisions: pending(1, 1, 1), attention: [CI_FAILING] }, 'ru')?.items, [
    'Вопросы без ответа: 1 (spec/01)',
    'Ждут одобрения: 1 (spec/11)',
    'Начать вам: 1 (spec/21)',
    CI_FAILING_RU,
  ]);
});

test('a section marked available: false is left out of the band', () => {
  const tracker = { available: false, reason: 'The tracker cannot be read.', code: 'tracker.unavailable', params: { kind: 'unreadable' } };
  assert.equal(band({ pendingDecisions: tracker }), undefined);
  assert.deepEqual(band({ pendingDecisions: tracker, attention: [CI_FAILING] })?.items, [CI_FAILING.message]);
  const unread = { ...pending(0, 1, 0), questions: { available: false, reason: 'The issue comments could not be read.' } };
  assert.deepEqual(band({ pendingDecisions: unread })?.items, ['Waiting for an approval: 1 (spec/11)']);
});

/** A session off a Task's branch, with the roadmap's current epic and Next action. */
const EPIC = { number: 22, title: 'A Binnacle mod for Claude Code', status: 'in progress', spec: 'claude-code-mod', progress: { done: 2, all: 7 } };
const ON_MAIN = {
  checkout: { root: '/project', registered: true, taskId: null },
  roadmap: { epics: [EPIC], current: EPIC, focus: null, sections: [] },
  next: { action: { description: 'start the band with', command: '/binnacle:task run docs/specs/claude-code-mod/issues/03-x.md' }, alternatives: [] },
  pendingDecisions: pending(1, 0, 2),
};
const START_LINES = [
  'Current epic: 22, A Binnacle mod for Claude Code (in progress, 2 of 7 Tasks done)',
  'Waiting for the owner: unanswered questions 1, waiting for an approval 0, yours to start 2',
  'Next action: start the band with `/binnacle:task run docs/specs/claude-code-mod/issues/03-x.md`',
];
const lines = (rest: Record<string, unknown>, language: 'en' | 'ru' = 'en') => view({ snapshot: snapshot(null, { ...ON_MAIN, ...rest }), ...NONE, language }).startLines;

test('the session-start lines: the current epic, what waits as counts and the Next action, at most three', () => {
  assert.deepEqual(lines({}), START_LINES);
  // The agent reads them, and text for an agent stays English (ADR-0045).
  assert.deepEqual(lines({}, 'ru'), START_LINES);
  // A line with no data is left out: an epic with no progress keeps its status alone, questions that could not be read are not counted.
  assert.deepEqual(
    lines({
      roadmap: { epics: [], current: { ...EPIC, progress: null }, focus: null, sections: [] },
      next: { action: null, alternatives: [] },
      pendingDecisions: { ...pending(0, 0, 0), questions: { available: false, reason: 'unread' } },
    }),
    ['Current epic: 22, A Binnacle mod for Claude Code (in progress)', 'Waiting for the owner: waiting for an approval 0, yours to start 0'],
  );
  assert.equal(lines({ roadmap: null, next: { action: null, alternatives: [] }, pendingDecisions: { available: false, reason: 'unread' } }), undefined);
});

test("no session-start lines on a Task's branch, or when the snapshot did not answer", () => {
  assert.equal(lines({ checkout: { root: '/project', registered: true, taskId: 'claude-code-mod/03' } }), undefined);
  assert.equal(view({ snapshot: null, ...NONE, language: 'en' }).startLines, undefined);
});

/** A Task in flight, as the snapshot's `tasks.inFlight` lists it. */
const flying = (id: string, state: string) => ({ ...task(id), state, start: null, roles: { required: [], source: 'default', suggested: [] } });
const CI = (state: string) => ({
  forge: { provider: 'github', host: 'github.com', repository: 'o/r', from: 'remote' },
  defaultBranch: { branch: 'main', commit: '0123456789ab', state: { value: state, provenance: 'provider_reported' }, url: 'https://github.com/o/r', at: null },
  requests: { items: [], remainder: 0 },
});
const AUTOPILOT = { kind: 'autopilot', tasks: [], params: {}, command: '/binnacle:autopilot claude-code-mod', description: 'Run autopilot.' };
/** A session on `main` with every section of the pane filled. */
const FILLED = {
  ...ON_MAIN,
  tasks: { inFlight: { items: [flying('spec/31', 'ACTIVE'), flying('spec/32', 'READY_FOR_REVIEW')], remainder: 2 } },
  ci: CI('passing'),
  next: { ...ON_MAIN.next, alternatives: [AUTOPILOT] },
  pendingDecisions: pending(1, 0, 0),
};
const pane = (rest: Record<string, unknown>, language: 'en' | 'ru' = 'en') => view({ snapshot: snapshot(null, rest), ...NONE, language }).pane;
const keys = (rest: Record<string, unknown>) => pane(rest)?.buttons.map((button) => button.key);

test("the pane's sections from a snapshot, in English and Russian", () => {
  assert.deepEqual(pane(FILLED)?.sections, [
    { heading: 'Current epic', lines: ['22, A Binnacle mod for Claude Code (in progress, 2 of 7 Tasks done)'] },
    { heading: 'Waiting for you', lines: ['Unanswered questions: 1 (spec/01)'] },
    { heading: 'In progress', lines: ['spec/31 Ticket spec/31 (in progress)', 'spec/32 Ticket spec/32 (in review)', 'and 2 more'] },
    { heading: 'CI', lines: ['main: passing'] },
    { heading: 'Next action', lines: ['start the band with /binnacle:task run docs/specs/claude-code-mod/issues/03-x.md'] },
  ]);
  assert.deepEqual(pane({ ...FILLED, ci: CI('failing'), attention: [CI_FAILING] }, 'ru')?.sections, [
    { heading: 'Текущий эпик', lines: ['22, A Binnacle mod for Claude Code (в работе, готово 2 из 7)'] },
    { heading: 'Ждёт вас', lines: ['Вопросы без ответа: 1 (spec/01)', CI_FAILING_RU] },
    { heading: 'В работе', lines: ['spec/31 Ticket spec/31 (в работе)', 'spec/32 Ticket spec/32 (на ревью)', 'и ещё 2'] },
    { heading: 'CI', lines: ['main: падает'] },
    { heading: 'Следующий шаг', lines: ['start the band with /binnacle:task run docs/specs/claude-code-mod/issues/03-x.md'] },
  ]);
});

test('a section marked available: false, or with nothing in it, is left out of the pane', () => {
  const unavailable = { available: false, reason: 'unread' };
  assert.deepEqual(pane({ tasks: null, ci: unavailable, pendingDecisions: unavailable }), { sections: [], buttons: [] });
  assert.deepEqual(pane({ tasks: { inFlight: { items: [], remainder: 0 } }, ci: CI('none') })?.sections, [{ heading: 'CI', lines: ['main: no checks'] }]);
  assert.equal(view({ snapshot: null, ...NONE, language: 'en' }).pane, undefined);
});

test('each button is shown or left out by its rule, and carries its command', () => {
  assert.deepEqual(pane(FILLED)?.buttons, [
    { key: 'next', command: '/binnacle:task run docs/specs/claude-code-mod/issues/03-x.md' },
    { key: 'suggested', command: '/binnacle:autopilot claude-code-mod' },
    { key: 'answer', command: '/binnacle:answer' },
    { key: 'checkpoint', command: '/binnacle:checkpoint' },
  ]);
  // No Next action: no button for it, the Suggested step's stays.
  assert.deepEqual(keys({ ...FILLED, next: { action: null, alternatives: [AUTOPILOT] } }), ['suggested', 'answer', 'checkpoint']);
  // The first Suggested step only, and none when it is the Next action's command, has none, or cannot be read.
  const same = { ...AUTOPILOT, command: ON_MAIN.next.action.command };
  assert.deepEqual(keys({ ...FILLED, next: { ...ON_MAIN.next, alternatives: [same, AUTOPILOT] } }), ['next', 'answer', 'checkpoint']);
  assert.deepEqual(keys({ ...FILLED, next: { ...ON_MAIN.next, alternatives: [{ ...AUTOPILOT, command: null }] } }), ['next', 'answer', 'checkpoint']);
  assert.deepEqual(keys({ ...FILLED, next: { ...ON_MAIN.next, alternatives: { available: false, reason: 'unread' } } }), ['next', 'answer', 'checkpoint']);
  // `/binnacle:answer` only while a question is unanswered.
  assert.deepEqual(keys({ ...FILLED, pendingDecisions: pending(0, 1, 1) }), ['next', 'suggested', 'checkpoint']);
  assert.deepEqual(keys({ ...FILLED, pendingDecisions: { ...pending(0, 0, 0), questions: { available: false, reason: 'unread' } } }), ['next', 'suggested', 'checkpoint']);
  // `/binnacle:checkpoint` only off a Task's branch.
  assert.deepEqual(keys({ ...FILLED, checkout: { root: '/project', registered: true, taskId: 'spec/31' } }), ['next', 'suggested', 'answer']);
});

/** A refresh's toasts: `rest` replaces sections of a snapshot on `main`, `previous` is what the session saw last, `store` what the store holds. */
const refresh = (rest: Record<string, unknown>, previous?: ReturnType<typeof view>['seen'], store?: unknown, language: 'en' | 'ru' = 'en') =>
  view({ snapshot: snapshot(null, { ...ON_MAIN, ...rest }), ...NONE, language, previous, store });
const PASSING = { ci: CI('passing') };
const FAILING = { ci: CI('failing'), attention: [CI_FAILING] };
/** The `context.pressure` item as the daemon raises it for a session asked by itself (`own`) or by another. */
const pressure = (own: boolean) => ({
  code: 'context.pressure',
  message: `${own ? 'This' : 'Another'} Product session in Claude Code, started at 10:00, latest activity 10:30, read 160000 tokens of context in its latest call, at least the default threshold, 150000. Run /binnacle:checkpoint, then go on in a fresh session.`,
  params: { session: 's', harness: 'Claude Code', startedAt: '2026-10-28T10:00:00Z', lastActivityAt: '2026-10-28T10:30:00Z', tokens: 160_000, threshold: 150_000, thresholdSource: 'default', own },
});

test("a session's first refresh records the state and toasts nothing", () => {
  const first = refresh({ ...FAILING, attention: [CI_FAILING, pressure(true)], pendingDecisions: pending(2, 0, 0) });
  assert.deepEqual(first.toasts, []);
  assert.equal(first.store, undefined);
  assert.deepEqual(first.seen, { failing: '0123456789ab', questions: [['spec/01', 'Which one?'], ['spec/02', 'Which one?']], pressure: true });
  // Without a snapshot nothing is seen, and what was is kept.
  assert.deepEqual(view({ snapshot: null, ...NONE, language: 'en', previous: first.seen }).seen, first.seen);
  assert.deepEqual(view({ snapshot: null, ...NONE, language: 'en' }).toasts, []);
});

test("CI turning failing on main toasts once, and not again from a store that already holds it", () => {
  const passing = refresh(PASSING).seen;
  const failing = refresh(FAILING, passing);
  assert.deepEqual(failing.toasts, [CI_FAILING.message]);
  assert.deepEqual(failing.store, { ci: '0123456789ab' });
  assert.deepEqual(refresh(FAILING, passing, undefined, 'ru').toasts, [CI_FAILING_RU]);
  // Still failing: no turn.
  assert.deepEqual(refresh(FAILING, failing.seen).toasts, []);
  // Another session that finds the change already shown stays quiet, and writes nothing.
  const quiet = refresh(FAILING, passing, failing.store);
  assert.deepEqual([quiet.toasts, quiet.store], [[], undefined]);
  // CI that cannot be read is no turn: the failing commit seen before stays.
  const unread = refresh({ ci: { available: false, reason: NO_FORGE } }, failing.seen);
  assert.deepEqual([unread.toasts, unread.seen?.failing], [[], '0123456789ab']);
  assert.deepEqual(refresh(FAILING, unread.seen).toasts, []);
  // CI first read after the session opened is no turn: its failure may be older than the session.
  const opened = refresh({ ci: { available: false, reason: NO_FORGE } });
  assert.deepEqual(refresh(FAILING, opened.seen).toasts, []);
  // A new commit failing is a turn of its own; a store holding another change does not silence it.
  const next = { ...CI_FAILING, params: { ...CI_FAILING.params, commit: 'fedcba987654' } };
  assert.deepEqual(refresh({ ci: CI('failing'), attention: [next] }, failing.seen, failing.store).store, { ci: 'fedcba987654' });
});

test('a question leaving the unanswered list toasts, in English and Russian, once per machine', () => {
  const two = refresh({ pendingDecisions: pending(2, 0, 0) }).seen;
  // spec/02's question was answered.
  const one = refresh({ pendingDecisions: pending(1, 0, 0) }, two);
  assert.deepEqual(one.toasts, ['A question on spec/02 was answered']);
  assert.deepEqual(one.store, { answered: [['spec/02', 'Which one?']] });
  assert.deepEqual(refresh({ pendingDecisions: pending(1, 0, 0) }, two, undefined, 'ru').toasts, ['Получен ответ на вопрос по spec/02']);
  assert.deepEqual(refresh({ pendingDecisions: pending(1, 0, 0) }, two, one.store).toasts, []);
  // Two answers toasted one after the other by one session: a session behind by both toasts neither.
  const none = refresh({ pendingDecisions: pending(0, 0, 0) }, one.seen, one.store);
  assert.deepEqual([none.toasts, none.store], [['A question on spec/01 was answered'], { answered: [['spec/02', 'Which one?'], ['spec/01', 'Which one?']] }]);
  assert.deepEqual(refresh({ pendingDecisions: pending(0, 0, 0) }, two, none.store).toasts, []);
  // Questions that could not be read are no change.
  const unread = refresh({ pendingDecisions: { ...pending(0, 0, 0), questions: { available: false, reason: 'unread' } } }, two);
  assert.deepEqual([unread.toasts, unread.seen?.questions], [[], two?.questions]);
  // CI and a question at once, the store keeping both.
  const both = refresh({ ...FAILING, pendingDecisions: pending(1, 0, 0) }, { ...two!, failing: null });
  assert.deepEqual(both.store, { ci: '0123456789ab', answered: [['spec/02', 'Which one?']] });
});

test('a question pushed off a full list by a new one is not answered', () => {
  // The snapshot lists ten questions, `from` to `from + 9` but for `answered`, and counts the rest.
  const listed = (from: number, remainder: number, answered?: number) => {
    const ids = Array.from({ length: 11 }, (_, n) => `spec/${String(from + n).padStart(2, '0')}`).filter((id) => id !== `spec/${String(answered).padStart(2, '0')}`);
    return { pendingDecisions: { ...pending(0, 0, 0), questions: { items: ids.slice(0, 10).map(question), remainder } } };
  };
  const ten = refresh(listed(1, 0)).seen;
  // A question asked ahead of them pushes spec/10 into the remainder.
  assert.deepEqual(refresh(listed(0, 1), ten).toasts, []);
  // spec/03, ahead of a question still listed, left the list.
  assert.deepEqual(refresh(listed(1, 1, 3), ten).toasts, ['A question on spec/03 was answered']);
});

test("context pressure toasts in its own session when it first appears, never for another session's item", () => {
  const calm = refresh({}).seen;
  assert.deepEqual(refresh({ attention: [pressure(true)] }, calm).toasts, [pressure(true).message]);
  assert.match(refresh({ attention: [pressure(true)] }, calm, undefined, 'ru').toasts[0]!, /^Эта продуктовая сессия в Claude Code, .* Запустите \/binnacle:checkpoint/);
  assert.deepEqual(refresh({ attention: [pressure(false)] }, calm).toasts, []);
  // Once: still raised, no toast; and the store is not the session's to share.
  const raised = refresh({ attention: [pressure(true)] }, calm);
  assert.equal(raised.store, undefined);
  assert.deepEqual(refresh({ attention: [pressure(true)] }, raised.seen).toasts, []);
  // Gone, then back: it appears again.
  const gone = refresh({}, raised.seen).seen;
  assert.deepEqual(refresh({ attention: [pressure(true)] }, gone).toasts, [pressure(true).message]);
});

/**
 * The hooks module with a stand-in for Claude Code's `$`: the `binnacle` server's answers and the locale are the
 * test's, and every refresh draws the line from scratch.
 */
function engine(locale: Record<string, string> = { LANG: 'C' }, store = new Map<string, unknown>()) {
  type Answer = { content: { type: string; text?: string }[]; isError: boolean } | Error;
  const hooks = new Map<string, (...args: unknown[]) => unknown>();
  const state = {
    answer: null as Answer | null,
    /** Holds the server's answer back until it settles; `sleep` settles a `$.clock.sleep`, never by default. */
    held: Promise.resolve(),
    sleep: new Promise<void>(() => {}),
    lines: [] as (string | undefined)[],
    calls: [] as unknown[][],
    timers: [] as { ms: number; fn: () => void }[],
    invalidated: 0,
    /** How many times the conversation's context was asked to be computed again. */
    reread: 0,
    commands: [] as unknown[],
    /** The toasts shown; `store` is Claude Code's store of the plugin, which another session may share. */
    toasts: [] as string[],
    store,
    /** The panes open now, as `$.ui.panes()` lists them, and what the prompt box was filled with. */
    panes: [] as { id: string; title: string }[],
    filled: [] as unknown[],
  };
  const $ = {
    mcp: {
      call: async (...args: unknown[]) => {
        state.calls.push(args);
        await state.held;
        if (state.answer instanceof Error) throw state.answer;
        return state.answer!;
      },
    },
    session: { id: async () => 'session-1', usage: async () => ({ startedAt: 0, ...FULL }) },
    env: { get: async (name: string) => locale[name] },
    clock: { every: (ms: number, fn: () => void) => (state.timers.push({ ms, fn }), { cancel: () => {} }), sleep: () => state.sleep },
    store: { get: async (key: string) => store.get(key), set: async (key: string, value: unknown) => void store.set(key, JSON.parse(JSON.stringify(value))) },
    ui: {
      toast: (text: string) => void state.toasts.push(text),
      status: (text: string | undefined) => void state.lines.push(text),
      invalidate: (event: string) => void (event === 'prompt.context' ? (state.reread += 1) : (state.invalidated += 1)),
      // Each element by its name, so that a test reads the tree the band would draw.
      resolve: () => ({ Box: 'Box', Text: 'Text', Button: 'Button' }),
      open: async (pane: { id: string; title: string }) => (state.panes.push(pane), { isPlaced: true }),
      close: async ({ id }: { id: string }) => void (state.panes = state.panes.filter((pane) => pane.id !== id)),
      panes: async () => state.panes,
    },
    command: { register: async (command: unknown) => (state.commands.push(command), { command: 'binnacle-pane' }) },
    prompt: { fill: async (args: unknown) => (state.filled.push(args), { isFilled: true, text: '', cursor: 0 }) },
  };
  // A hook by its event and, when its matcher names one, its component: a matcher stands before the hook.
  register(((event: string, ...rest: unknown[]) => {
    const component = rest.length > 1 ? (rest[0] as { component?: string }).component : undefined;
    hooks.set(component ? `${event} ${component}` : event, rest.at(-1) as (...args: unknown[]) => unknown);
  }) as never);
  /** Raises an event, then lets the refresh it started finish. */
  const run = async (event: string, e: unknown) => {
    const result = await hooks.get(event)!($, e, async (input: unknown) => input);
    await new Promise((resolve) => setImmediate(resolve));
    return result;
  };
  /** The band's tree, or what lies beneath it when the mod passes. */
  const band = (props: Record<string, unknown> = {}) =>
    hooks.get('ui.render AbovePrompt')!($, { surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, ...props } }, async () => 'beneath');
  /** The pane's tree. */
  const pane = () => hooks.get('ui.render Pane')!($, { surface: 'terminal', component: 'Pane', requestId: 'binnacle', props: {} }, async () => 'beneath');
  /** The permission check on a tool call, asked with `next` raised by a plugin (`next.origin`). */
  const check = (e: unknown, next: unknown) => hooks.get('tool.check')!($, e, next);
  return { state, run, band, pane, check };
}
/** Claude Code's global JSX factory, giving plain data. */
(globalThis as { h?: unknown }).h = (type: string, props: object | null, ...children: unknown[]) => ({ type, props, children });
const answered = (result: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(result) }], isError: false });
const refused = (code: string) => ({ content: [{ type: 'text', text: JSON.stringify({ error: { code, message: code } }) }], isError: true });
const START = { cwd: '/project', surface: 'terminal', isInteractive: true };

test('silence: an MCP error, a missing binnacle server, a stopped daemon or an unregistered project clears the line, and the next refresh shows it again', async () => {
  const { state, run } = engine();
  state.answer = refused('daemon.unreachable');
  assert.deepEqual(await run('session.start', START), START);
  assert.deepEqual(state.calls, [['binnacle', 'project_snapshot', { session: 'session-1' }]]);
  assert.deepEqual(state.lines, [undefined]);
  // Refreshed once a minute, the forge cache's own period.
  assert.deepEqual(state.timers.map((timer) => timer.ms), [60_000]);

  state.answer = answered(snapshot(onTask));
  state.timers[0]!.fn();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.lines.at(-1), ON_TASK_EN);

  for (const answer of [refused('project.not_registered'), refused('internal.error'), new Error('No MCP server named binnacle'), { content: [], isError: false }]) {
    state.answer = answer;
    await run('session.measure', { ...FULL, changed: ['context'] });
    assert.equal(state.lines.at(-1), undefined, String(answer instanceof Error ? answer.message : JSON.stringify(answer)));
  }
  // After each turn, as at the start.
  state.answer = answered(snapshot(product));
  assert.deepEqual(await run('session.measure', { ...FULL, changed: ['context'] }), { ...FULL, changed: ['context'] });
  assert.equal(state.lines.at(-1), 'product session · 520 output tokens (from activity) · context 42% · 5h 23.5% · 7d 7%');
});

test("the line follows binn's locale rule, read through Claude Code's environment", async () => {
  const { state, run } = engine({ LC_ALL: 'ru_RU.UTF-8', LANG: 'C' });
  state.answer = answered(snapshot(product));
  await run('session.start', START);
  assert.equal(state.lines.at(-1), 'продуктовая сессия · 520 выходных токенов (по активности) · контекст 42% · 5 ч 23,5% · 7 дн 7%');
});

test('the band is drawn with a question waiting, and passes beneath without one or under a survey', async () => {
  const { state, run, band } = engine();
  state.answer = answered(snapshot(onTask));
  await run('session.start', START);
  assert.equal(await band(), 'beneath');
  // The first snapshot gives the pane its content, though not the band.
  assert.equal(state.invalidated, 1);

  state.answer = answered(snapshot(onTask, { pendingDecisions: pending(1, 0, 0) }));
  await run('session.measure', { ...FULL, changed: ['context'] });
  assert.equal(state.invalidated, 2);
  assert.deepEqual(await band(), {
    type: 'Box',
    props: { flexDirection: 'column' },
    children: [
      { type: 'Text', props: { bold: true, color: 'warning' }, children: ['Waiting for you'] },
      { type: 'Text', props: null, children: ['Unanswered questions: 1 (spec/01)'] },
    ],
  });
  assert.equal(await band({ hasSurvey: true }), 'beneath');
  // The same band again asks for no redraw; a stopped daemon takes it away.
  await run('session.measure', { ...FULL, changed: ['context'] });
  assert.equal(state.invalidated, 2);
  state.answer = refused('daemon.unreachable');
  await run('session.measure', { ...FULL, changed: ['context'] });
  assert.equal(state.invalidated, 3);
  assert.equal(await band(), 'beneath');
});

test("the session-start lines join the conversation's context off a Task's branch, and nothing is added on one", async () => {
  const core = { name: 'currentDate', text: 'Today' };
  const context = async (answer: ReturnType<typeof answered>) => {
    const { state, run } = engine();
    state.answer = answer;
    await run('session.start', START);
    return run('prompt.context', { blocks: [core] });
  };
  assert.deepEqual(await context(answered(snapshot(null, ON_MAIN))), { blocks: [core, { name: 'binnacle', text: START_LINES.join('\n') }] });
  assert.deepEqual(await context(answered(snapshot(null))), { blocks: [core] });
  assert.deepEqual(await context(refused('daemon.unreachable')), { blocks: [core] });
});

test('the session-start lines wait on the refresh under way, and give up inside the hook budget', async () => {
  const core = { name: 'currentDate', text: 'Today' };
  const { state, run } = engine();
  let answer = () => {};
  state.held = new Promise((resolve) => (answer = resolve));
  state.answer = answered(snapshot(null, ON_MAIN));
  await run('session.start', START);
  const context = run('prompt.context', { blocks: [core] });
  answer();
  assert.deepEqual(await context, { blocks: [core, { name: 'binnacle', text: START_LINES.join('\n') }] });

  // A daemon slower than the wait adds nothing.
  state.held = new Promise(() => {});
  state.sleep = Promise.resolve();
  await run('session.measure', { ...FULL, changed: ['context'] });
  assert.deepEqual(await run('prompt.context', { blocks: [core] }), { blocks: [core] });
});

test('a binnacle server still connecting at the start: the hook asks again, and an answer after it has the context computed again once', async () => {
  const core = { name: 'currentDate', text: 'Today' };
  const block = { name: 'binnacle', text: START_LINES.join('\n') };
  const connecting = new Error('MCP server "binnacle" is not connected');
  const first = engine();
  first.state.answer = connecting;
  await first.run('session.start', START);
  first.state.answer = answered(snapshot(null, ON_MAIN));
  assert.deepEqual(await first.run('prompt.context', { blocks: [core] }), { blocks: [core, block] });
  assert.equal(first.state.calls.length, 2);
  assert.equal(first.state.reread, 0);

  // Still connecting when the context is computed: the first answer after it asks for the context again, once.
  const { state, run } = engine();
  state.answer = connecting;
  await run('session.start', START);
  assert.deepEqual(await run('prompt.context', { blocks: [core] }), { blocks: [core] });
  state.answer = answered(snapshot(null, ON_MAIN));
  await run('session.measure', { ...FULL, changed: ['context'] });
  assert.equal(state.reread, 1);
  assert.deepEqual(await run('prompt.context', { blocks: [core] }), { blocks: [core, block] });
  await run('session.measure', { ...FULL, changed: ['context'] });
  assert.equal(state.reread, 1);
});

test("the mod's own read of the snapshot needs no one's leave; the model's call of the same tool stays under the rules", async () => {
  const { check } = engine();
  const beneath = async () => ({ decision: 'ask' });
  const raised = (plugin: string) => Object.assign(beneath, { origin: { plugin, tier: 'user' } });
  assert.deepEqual(await check({ tool: 'mcp__binnacle__project_snapshot', input: {} }, raised('binnacle-mod')), { decision: 'allow' });
  assert.deepEqual(await check({ tool: 'mcp__binnacle__project_snapshot', input: {} }, raised('engine')), { decision: 'ask' });
  assert.deepEqual(await check({ tool: 'mcp__binnacle__project_snapshot', input: {} }, raised('another-mod')), { decision: 'ask' });
});

test('the command is registered at the start, opens the pane, and closes it on a second run; the pane never opens by itself', async () => {
  const { state, run } = engine();
  state.answer = answered(snapshot(null, FILLED));
  await run('session.start', START);
  assert.deepEqual(state.commands, [{ name: 'binnacle-pane', description: 'Open or close the Binnacle pane' }]);
  assert.deepEqual(state.panes, []);
  const command = { command: 'binnacle-pane', args: '', origin: { kind: 'composer' }, presentation: {} };
  assert.deepEqual(await run('command.run', command), {});
  assert.deepEqual(state.panes, [{ id: 'binnacle', title: 'Binnacle' }]);
  await run('command.run', command);
  assert.deepEqual(state.panes, []);
  await run('command.run', command);
  assert.deepEqual(state.panes, [{ id: 'binnacle', title: 'Binnacle' }]);

  // The command's line in the typeahead follows the person's language.
  const russian = engine({ LANG: 'ru_RU.UTF-8' });
  await russian.run('session.start', START);
  assert.deepEqual(russian.state.commands, [{ name: 'binnacle-pane', description: 'Открыть или закрыть панель Binnacle' }]);
});

test("the pane draws the last view's sections and buttons, and a button fills the prompt box without sending it", async () => {
  const { state, run, pane } = engine();
  state.answer = refused('daemon.unreachable');
  await run('session.start', START);
  // Without the daemon, no content.
  assert.deepEqual(await pane(), { type: 'Box', props: null, children: [] });

  state.answer = answered(snapshot(null, { ...ON_MAIN, pendingDecisions: NOTHING_PENDING }));
  await run('session.measure', { ...FULL, changed: ['context'] });
  // A pane that changed asks for a redraw.
  assert.equal(state.invalidated, 1);
  type Drawn = { type: string; props: { key?: string; onPress?: () => void } | null; children: Drawn[] };
  const tree = (await pane()) as Drawn;
  assert.equal(tree.type, 'Box');
  assert.deepEqual(
    tree.children.map((node) => [node.type, ...node.children]),
    [
      ['Text', 'Current epic'],
      ['Text', '22, A Binnacle mod for Claude Code (in progress, 2 of 7 Tasks done)'],
      ['Text', 'Next action'],
      ['Text', 'start the band with /binnacle:task run docs/specs/claude-code-mod/issues/03-x.md'],
      ['Button', '/binnacle:task run docs/specs/claude-code-mod/issues/03-x.md'],
      ['Button', '/binnacle:checkpoint'],
    ],
  );
  const buttons = tree.children.filter((node) => node.type === 'Button');
  assert.deepEqual(buttons.map((node) => node.props?.key), ['next', 'checkpoint']);
  buttons[1]!.props!.onPress!();
  assert.deepEqual(state.filled, [{ text: '/binnacle:checkpoint', mode: 'replace' }]);
});

test("a project's change toasts in the first session that sees it, and the others sharing the store stay quiet", async () => {
  const store = new Map<string, unknown>();
  const sessions = [engine({ LANG: 'C' }, store), engine({ LANG: 'C' }, store)];
  for (const { state, run } of sessions) {
    state.answer = answered(snapshot(null, { ...ON_MAIN, ci: CI('passing') }));
    await run('session.start', START);
  }
  // Opening a session replays nothing.
  assert.deepEqual(sessions.map(({ state }) => state.toasts), [[], []]);

  for (const { state, run } of sessions) {
    state.answer = answered(snapshot(null, { ...ON_MAIN, ci: CI('failing'), attention: [CI_FAILING] }));
    await run('session.measure', { ...FULL, changed: ['context'] });
  }
  assert.deepEqual(sessions.map(({ state }) => state.toasts), [[CI_FAILING.message], []]);
  assert.deepEqual(store.get('shown /project'), { ci: '0123456789ab' });
  // The next refresh, still failing, toasts nothing anywhere.
  for (const { run } of sessions) await run('session.measure', { ...FULL, changed: ['context'] });
  assert.deepEqual(sessions.map(({ state }) => state.toasts.length), [1, 0]);
});

test('context pressure toasts in its own session only, and a stopped daemon replays nothing when it comes back', async () => {
  const { state, run } = engine();
  state.answer = answered(snapshot(null, ON_MAIN));
  await run('session.start', START);
  state.answer = refused('daemon.unreachable');
  await run('session.measure', { ...FULL, changed: ['context'] });
  state.answer = answered(snapshot(null, { ...ON_MAIN, attention: [pressure(false)] }));
  await run('session.measure', { ...FULL, changed: ['context'] });
  assert.deepEqual(state.toasts, []);
  state.answer = answered(snapshot(null, { ...ON_MAIN, attention: [pressure(true)] }));
  await run('session.measure', { ...FULL, changed: ['context'] });
  assert.deepEqual(state.toasts, [pressure(true).message]);
  // Not the project's to share.
  assert.deepEqual([...state.store.keys()], []);
});

test('a refresh that finishes after a newer one draws nothing, and replays no toast', async () => {
  const { state, run } = engine();
  state.answer = answered(snapshot(null, ON_MAIN));
  await run('session.start', START);
  // An older refresh, held; a newer one finishes first with this session's context pressure.
  let older = () => {};
  state.held = new Promise((resolve) => (older = resolve));
  await run('session.measure', { ...FULL, changed: ['context'] });
  state.held = Promise.resolve();
  state.answer = answered(snapshot(onTask, { ...ON_MAIN, attention: [pressure(true)] }));
  await run('session.measure', { ...FULL, changed: ['context'] });
  assert.deepEqual(state.toasts, [pressure(true).message]);
  const line = state.lines.at(-1);
  // The older one now answers without it: it neither draws nor forgets what the newer one saw.
  state.answer = answered(snapshot(null, ON_MAIN));
  older();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.lines.at(-1), line);
  state.answer = answered(snapshot(onTask, { ...ON_MAIN, attention: [pressure(true)] }));
  await run('session.measure', { ...FULL, changed: ['context'] });
  assert.deepEqual(state.toasts, [pressure(true).message]);
});
