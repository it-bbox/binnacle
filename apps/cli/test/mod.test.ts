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
/** The snapshot's `activity` as `project.snapshot` answers it for a named session. */
const snapshot = (own: Own | null | undefined) => ({ activity: { running: { items: [], remainder: 0 }, recent: [], ...(own !== undefined && { own }) } }) as unknown as ViewInput['snapshot'];
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
  const unavailable = { activity: { available: false, reason: 'The tracker could not be read' } } as unknown as ViewInput['snapshot'];
  assert.equal(view({ snapshot: unavailable, ...FULL, language: 'en' }).status, 'context 42% · 5h 23.5% · 7d 7%');
  // A gateway's window has no word of its own and is named as Claude Code names it.
  assert.equal(view({ snapshot: snapshot(null), context: { window: 1 }, rateLimits: [{ kind: 'spend_limit', percentUsed: 104 }], language: 'en' }).status, 'spend_limit 104%');
});

test('without a snapshot the line is cleared', () => {
  assert.equal(view({ snapshot: null, ...FULL, language: 'en' }).status, undefined);
});

/**
 * The hooks module with a stand-in for Claude Code's `$`: the `binnacle` server's answers and the locale are the
 * test's, and every refresh draws the line from scratch.
 */
function engine(locale: Record<string, string> = { LANG: 'C' }) {
  type Answer = { content: { type: string; text?: string }[]; isError: boolean } | Error;
  const hooks = new Map<string, (...args: unknown[]) => unknown>();
  const state = { answer: null as Answer | null, lines: [] as (string | undefined)[], calls: [] as unknown[][], timers: [] as { ms: number; fn: () => void }[] };
  const $ = {
    mcp: {
      call: async (...args: unknown[]) => {
        state.calls.push(args);
        if (state.answer instanceof Error) throw state.answer;
        return state.answer!;
      },
    },
    session: { id: async () => 'session-1', usage: async () => ({ startedAt: 0, ...FULL }) },
    env: { get: async (name: string) => locale[name] },
    clock: { every: (ms: number, fn: () => void) => (state.timers.push({ ms, fn }), { cancel: () => {} }) },
    ui: { status: (text: string | undefined) => void state.lines.push(text) },
  };
  register(((event: string, hook: (...args: unknown[]) => unknown) => void hooks.set(event, hook)) as never);
  /** Raises an event, then lets the refresh it started finish. */
  const run = async (event: string, e: unknown) => {
    const result = await hooks.get(event)!($, e, async (input: unknown) => input);
    await new Promise((resolve) => setImmediate(resolve));
    return result;
  };
  return { state, run };
}
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
