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
    activity: { running: { items: [], remainder: 0 }, recent: [], ...(own !== undefined && { own }) },
    checkout: { root: '/project', registered: true, taskId: 'claude-code-mod/03' },
    roadmap: null,
    next: { action: null, alternatives: [] },
    pendingDecisions: NOTHING_PENDING,
    attention: [],
    ...rest,
  }) as unknown as NonNullable<ViewInput['snapshot']>;
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
  assert.deepEqual(view({ snapshot: null, ...FULL, language: 'en' }), { status: undefined, band: undefined, startLines: undefined });
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

/**
 * The hooks module with a stand-in for Claude Code's `$`: the `binnacle` server's answers and the locale are the
 * test's, and every refresh draws the line from scratch.
 */
function engine(locale: Record<string, string> = { LANG: 'C' }) {
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
    ui: {
      status: (text: string | undefined) => void state.lines.push(text),
      invalidate: () => void (state.invalidated += 1),
      // Each element by its name, so that a test reads the tree the band would draw.
      resolve: () => ({ Box: 'Box', Text: 'Text' }),
    },
  };
  // A matcher, when there is one, stands before the hook.
  register(((event: string, ...rest: unknown[]) => void hooks.set(event, rest.at(-1) as (...args: unknown[]) => unknown)) as never);
  /** Raises an event, then lets the refresh it started finish. */
  const run = async (event: string, e: unknown) => {
    const result = await hooks.get(event)!($, e, async (input: unknown) => input);
    await new Promise((resolve) => setImmediate(resolve));
    return result;
  };
  /** The band's tree, or what lies beneath it when the mod passes. */
  const band = (props: Record<string, unknown> = {}) =>
    hooks.get('ui.render')!($, { surface: 'terminal', component: 'AbovePrompt', props: { hasSurvey: false, ...props } }, async () => 'beneath');
  return { state, run, band };
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
  assert.equal(state.invalidated, 0);

  state.answer = answered(snapshot(onTask, { pendingDecisions: pending(1, 0, 0) }));
  await run('session.measure', { ...FULL, changed: ['context'] });
  assert.equal(state.invalidated, 1);
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
  assert.equal(state.invalidated, 1);
  state.answer = refused('daemon.unreachable');
  await run('session.measure', { ...FULL, changed: ['context'] });
  assert.equal(state.invalidated, 2);
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
