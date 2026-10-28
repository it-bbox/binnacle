import { personLanguage } from '@binnacle/core';
import { view, type View, type ViewInput } from './view.ts';

/**
 * `binnacle-mod`'s hooks module (ADR-0047), bundled with the view into one ES module with no `import()`, which
 * Claude Code refuses. The mod has no Node: it reaches the daemon only through the `binnacle` MCP server, and reads
 * the session's figures from Claude Code. It writes nothing.
 */

/** The oldest Claude Code the mod was validated on; raised with the mod whenever its API moves. */
export const MINIMUM_CLAUDE_CODE = '2.1.308';

/** How often a session refreshes on its own: the daemon's forge cache period, so sessions add no forge calls. */
const REFRESH_MS = 60_000;

/** How long the session-start lines wait on the refresh under way, inside Claude Code's 10-second budget for a hook. */
const START_WAIT_MS = 8_000;

/**
 * The few parts of Claude Code's `$` the mod uses, typed here: the engine's own declarations are written by
 * Claude Code beside a mod it loads, not shipped to this repository.
 */
type Engine = {
  mcp: { call: (server: string, tool: string, args?: Record<string, unknown>) => Promise<{ content: { type: string; text?: string }[]; isError: boolean }> };
  session: { id: () => Promise<string>; usage: () => Promise<Pick<ViewInput, 'context' | 'rateLimits'>> };
  env: { get: (name: string) => Promise<string | undefined | null> };
  clock: { every: (ms: number, fn: () => void) => unknown; sleep: (ms: number) => Promise<void> };
  ui: {
    status: (text: string | undefined) => void;
    invalidate: (event: 'ui.render') => void;
    resolve: (e: Render) => Record<'Box' | 'Text', (props: never) => Node>;
  };
};
/** A tree's node, built by Claude Code's global JSX factory: the mod's source is `.ts`, so it calls `h` by name. */
type Node = unknown;
declare const h: (tag: (props: never) => Node, props: Record<string, unknown> | null, ...children: unknown[]) => Node;
type Render = { surface: string; component: string; props: { hasSurvey?: boolean } };
type Blocks = { blocks: readonly { name: string; text: string }[] };
type Hook<E = never> = ($: Engine, e: E, next: (e: E) => Promise<unknown>) => Promise<unknown>;
type On = {
  (event: 'session.start' | 'session.measure', hook: Hook): unknown;
  (event: 'ui.render', matcher: { component: 'AbovePrompt' }, hook: Hook<Render>): unknown;
  (event: 'prompt.context', hook: Hook<Blocks>): unknown;
};

/** The snapshot asked with this session's id, or null on any failure: an MCP error, no `binnacle` server, a stopped daemon, an unregistered project. */
async function readSnapshot($: Engine): Promise<ViewInput['snapshot']> {
  try {
    const result = await $.mcp.call('binnacle', 'project_snapshot', { session: await $.session.id() });
    const text = result.content.find((block) => block.type === 'text')?.text;
    return result.isError || text === undefined ? null : (JSON.parse(text) as ViewInput['snapshot']);
  } catch {
    return null;
  }
}

/**
 * What a session keeps between its hooks: `latest`, the refresh under way or the last one; `shown`, the last view a
 * refresh drew, null before the first and after a failure; `band`, that view's band as text, so that a refresh that
 * changes nothing redraws nothing.
 */
type Kept = { latest: Promise<View | null>; shown: View | null; band: string };

/** Reads the snapshot and Claude Code's figures, draws the line and asks for the band when it changed; on any failure, clears both. Never throws. */
async function draw($: Engine, kept: Kept): Promise<View | null> {
  let shown: View | null = null;
  try {
    // `$.env.get` takes literal names, which `claude plugin validate` lists.
    const [snapshot, usage, lcAll, lang] = await Promise.all([readSnapshot($), $.session.usage(), $.env.get('LC_ALL'), $.env.get('LANG')]);
    const language = personLanguage({ LC_ALL: lcAll ?? undefined, LANG: lang ?? undefined });
    shown = view({ snapshot, context: usage.context, rateLimits: usage.rateLimits, language });
    $.ui.status(shown.status);
  } catch {
    $.ui.status(undefined);
  }
  kept.shown = shown;
  const band = JSON.stringify(shown?.band ?? null);
  if (band !== kept.band) {
    kept.band = band;
    try {
      $.ui.invalidate('ui.render');
    } catch {
      // The band shows at the engine's next redraw instead.
    }
  }
  return shown;
}

/** Starts a refresh, unawaited, as the one under way for the hooks that wait on it. */
function refresh($: Engine, kept: Kept): void {
  kept.latest = draw($, kept);
}

// A function declaration: `claude plugin validate` reads `register` off the bundle's source and refuses an arrow bound to a name.
// Each refresh runs unawaited: Claude Code awaits `session.start` before the first prompt, and a snapshot on a cold forge
// cache takes seconds. ponytail: two refreshes may finish out of order and an older line stand until the next one; a
// sequence number if it shows.
export function register(on: On): void {
  const kept: Kept = { latest: Promise.resolve(null), shown: null, band: 'null' };
  on('session.start', async ($, e, next) => {
    refresh($, kept);
    $.clock.every(REFRESH_MS, () => refresh($, kept));
    return next(e);
  });
  // After each turn: Claude Code measures the session and the snapshot may have moved with it.
  on('session.measure', async ($, e, next) => {
    refresh($, kept);
    return next(e);
  });
  // *Waiting for you*, above the prompt, while something waits; nothing otherwise, and nothing while a survey holds the band.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The last view drawn, never one under way: a draw does not wait on the daemon.
    const band = kept.shown?.band;
    if (band === undefined || e.props.hasSurvey) return next(e);
    const { Box, Text } = $.ui.resolve(e);
    return h(Box, { flexDirection: 'column' }, h(Text, { bold: true, color: 'warning' }, band.title), ...band.items.map((item) => h(Text, null, item)));
  });
  // Once per conversation, when its first message's context is computed: the project's position, off a Task's branch only.
  on('prompt.context', async ($, e, next) => {
    const result = (await next(e)) as Blocks;
    // A daemon slower than the wait adds nothing, rather than fail the hook.
    const lines = (await Promise.race([kept.latest, $.clock.sleep(START_WAIT_MS).then(() => null)]))?.startLines;
    return lines === undefined ? result : { ...result, blocks: [...result.blocks, { name: 'binnacle', text: lines.join('\n') }] };
  });
}
