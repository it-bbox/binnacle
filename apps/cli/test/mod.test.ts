import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from '../src/mod/hooks.ts';
import { view, type ViewInput } from '../src/mod/view.ts';

/** A token field as the snapshot sums it: `tokens` null when no record reported it. */
const field = (tokens: number | null) => ({ tokens, partial: false, provenance: tokens === null ? null : ('provider_reported' as const) });
const totals = (input: number | null, output: number | null, reasoning: number | null = null) => ({
  records: 3,
  input: field(input),
  cachedInput: field(input === null ? null : 1_000_000),
  cacheCreation: field(input === null ? null : 100_000),
  output: field(output),
  reasoning: field(reasoning),
});
type Own = { taskId: string | null; taskTitle: string | null; role: 'product' | 'implementation' | 'review' | 'rework' | 'unknown'; totals: ReturnType<typeof totals> };
/** The snapshot's `activity` as `project.snapshot` answers it for a named session. */
const snapshot = (own: Own | null | undefined) => ({ activity: { running: { items: [], remainder: 0 }, recent: [], ...(own !== undefined && { own }) } }) as unknown as ViewInput['snapshot'];
const onTask: Own = { taskId: 'claude-code-mod/02', taskTitle: "The mod's status line", role: 'implementation', totals: totals(20_000, 80_000, 30_000) };
const product: Own = { taskId: null, taskTitle: null, role: 'product', totals: totals(4_000, 520) };
const FULL = { context: { window: 200_000, tokens: 84_000, percent: 42 }, rateLimits: [{ kind: 'five_hour', percentUsed: 23.5 }, { kind: 'seven_day', percentUsed: 7 }] };
const NONE = { context: { window: 200_000 }, rateLimits: [] };

test("a session on a Task shows its id and role, its tokens from activity.own, its context and each rate-limit window's use", () => {
  // Every token once: input, cached input, cache creation and output; reasoning is inside output.
  assert.equal(view({ snapshot: snapshot(onTask), ...FULL, language: 'en' }).status, 'claude-code-mod/02 implementation · 1.2M tokens (from activity) · context 42% · 5h 23.5% · 7d 7%');
  assert.equal(
    view({ snapshot: snapshot(onTask), ...FULL, language: 'ru' }).status,
    'claude-code-mod/02 реализация · 1,2 млн токенов (по активности) · контекст 42% · 5 ч 23,5% · 7 дн 7%',
  );
});

test('a session with no Task shows its role, and nothing for the Task without a run', () => {
  assert.equal(view({ snapshot: snapshot(product), ...NONE, language: 'en' }).status, 'product session · 1.1M tokens (from activity)');
  assert.equal(view({ snapshot: snapshot(product), ...NONE, language: 'ru' }).status, 'продуктовая сессия · 1,1 млн токенов (по активности)');
  // Binnacle has stored no run of the session yet, as on its first refresh: Claude Code's own figures alone.
  assert.equal(view({ snapshot: snapshot(null), ...FULL, language: 'en' }).status, 'context 42% · 5h 23.5% · 7d 7%');
  assert.equal(view({ snapshot: snapshot(null), ...NONE, language: 'en' }).status, undefined);
  // An unknown role is no data, and a Task with it shows its id alone.
  assert.equal(view({ snapshot: snapshot({ ...onTask, role: 'unknown' }), ...NONE, language: 'en' }).status, 'claude-code-mod/02 · 1.2M tokens (from activity)');
  assert.equal(view({ snapshot: snapshot({ ...product, role: 'unknown' }), ...NONE, language: 'en' }).status, '1.1M tokens (from activity)');
});

test('a part with no data is left out, never shown as zero', () => {
  // No token reported by any record of the session.
  assert.equal(view({ snapshot: snapshot({ ...onTask, totals: totals(null, null) }), ...NONE, language: 'en' }).status, 'claude-code-mod/02 implementation');
  // Small counts are written whole, and agree with their noun in Russian.
  const few = { ...product, totals: { ...totals(null, 3), records: 1 } };
  assert.equal(view({ snapshot: snapshot(few), ...NONE, language: 'en' }).status, 'product session · 3 tokens (from activity)');
  assert.equal(view({ snapshot: snapshot(few), ...NONE, language: 'ru' }).status, 'продуктовая сессия · 3 токена (по активности)');
  assert.equal(view({ snapshot: snapshot({ ...few, totals: { ...few.totals, output: field(1) } }), ...NONE, language: 'ru' }).status, 'продуктовая сессия · 1 токен (по активности)');
  assert.equal(view({ snapshot: snapshot({ ...few, totals: { ...few.totals, output: field(25_300) } }), ...NONE, language: 'ru' }).status, 'продуктовая сессия · 25,3 тыс. токенов (по активности)');
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
 * The hooks module with a stand-in for Claude Code's `$`: the `binnacle` server's answers are the test's, and
 * every refresh draws the line from scratch.
 */
function engine() {
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
    env: { get: async (name: string) => (name === 'LANG' ? 'C' : undefined) },
    clock: { every: (ms: number, fn: () => void) => (state.timers.push({ ms, fn }), { cancel: () => {} }) },
    ui: { status: (text: string | undefined) => void state.lines.push(text) },
  };
  register(((event: string, hook: (...args: unknown[]) => unknown) => void hooks.set(event, hook)) as never);
  const run = (event: string, e: unknown) => hooks.get(event)!($, e, async (input: unknown) => input);
  return { state, run };
}
const answered = (result: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(result) }], isError: false });
const refused = (code: string) => ({ content: [{ type: 'text', text: JSON.stringify({ error: { code, message: code } }) }], isError: true });

test('silence: an MCP error, a missing binnacle server, a stopped daemon or an unregistered project clears the line, and the next refresh shows it again', async () => {
  const { state, run } = engine();
  state.answer = refused('daemon.unreachable');
  await run('session.start', { cwd: '/project', surface: 'terminal', isInteractive: true });
  assert.deepEqual(state.calls, [['binnacle', 'project_snapshot', { session: 'session-1' }]]);
  assert.deepEqual(state.lines, [undefined]);
  // Refreshed once a minute, the forge cache's own period.
  assert.deepEqual(state.timers.map((timer) => timer.ms), [60_000]);

  state.answer = answered(snapshot(onTask));
  state.timers[0]!.fn();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(state.lines.at(-1), 'claude-code-mod/02 implementation · 1.2M tokens (from activity) · context 42% · 5h 23.5% · 7d 7%');

  for (const answer of [refused('project.not_registered'), refused('internal.error'), new Error('No MCP server named binnacle'), { content: [], isError: false }]) {
    state.answer = answer;
    await run('session.measure', { ...FULL, changed: ['context'] });
    assert.equal(state.lines.at(-1), undefined, String(answer instanceof Error ? answer.message : JSON.stringify(answer)));
  }
  // After each turn, as at the start.
  state.answer = answered(snapshot(product));
  assert.deepEqual(await run('session.measure', { ...FULL, changed: ['context'] }), { ...FULL, changed: ['context'] });
  assert.equal(state.lines.at(-1), 'product session · 1.1M tokens (from activity) · context 42% · 5h 23.5% · 7d 7%');
});
