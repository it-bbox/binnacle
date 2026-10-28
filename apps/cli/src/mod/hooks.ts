import { personLanguage, type Language } from '@binnacle/core';
import { PANE_COMMAND, view, type View, type ViewInput } from './view.ts';

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
  command: { register: (command: { name: string; description: string }) => Promise<unknown> };
  prompt: { fill: (args: { text: string; mode: 'replace' }) => Promise<unknown> };
  ui: {
    status: (text: string | undefined) => void;
    invalidate: (event: 'ui.render') => void;
    resolve: (e: Render) => Record<'Box' | 'Text' | 'Button', (props: never) => Node>;
    open: (pane: { id: string; title: string }) => Promise<unknown>;
    close: (pane: { id: string }) => Promise<void>;
    panes: () => Promise<readonly { id: string }[]>;
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
  (event: 'ui.render', matcher: { component: 'AbovePrompt' } | { component: 'Pane'; requestId: string }, hook: Hook<Render>): unknown;
  (event: 'prompt.context', hook: Hook<Blocks>): unknown;
  (event: 'command.run', matcher: { command: string }, hook: Hook): unknown;
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
 * refresh drew, null before the first and after a failure; `drawn`, that view's band and pane as text, so that a refresh
 * that changes neither redraws nothing.
 */
type Kept = { latest: Promise<View | null>; shown: View | null; drawn: string };

/** The person's language by `binn`'s locale rule, read through Claude Code's environment. */
async function readLanguage($: Engine): Promise<Language> {
  // `$.env.get` takes literal names, which `claude plugin validate` lists.
  const [lcAll, lang] = await Promise.all([$.env.get('LC_ALL'), $.env.get('LANG')]);
  return personLanguage({ LC_ALL: lcAll ?? undefined, LANG: lang ?? undefined });
}

/** Reads the snapshot and Claude Code's figures, draws the line and asks for the band and the pane when they changed; on any failure, clears them. Never throws. */
async function draw($: Engine, kept: Kept): Promise<View | null> {
  let shown: View | null = null;
  try {
    const [snapshot, usage, language] = await Promise.all([readSnapshot($), $.session.usage(), readLanguage($)]);
    shown = view({ snapshot, context: usage.context, rateLimits: usage.rateLimits, language });
    $.ui.status(shown.status);
  } catch {
    $.ui.status(undefined);
  }
  kept.shown = shown;
  const drawn = JSON.stringify([shown?.band ?? null, shown?.pane ?? null]);
  if (drawn !== kept.drawn) {
    kept.drawn = drawn;
    try {
      $.ui.invalidate('ui.render');
    } catch {
      // They show at the engine's next redraw instead.
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
  const kept: Kept = { latest: Promise.resolve(null), shown: null, drawn: '[null,null]' };
  on('session.start', async ($, e, next) => {
    refresh($, kept);
    $.clock.every(REFRESH_MS, () => refresh($, kept));
    try {
      await $.command.register({ name: 'binnacle-pane', description: PANE_COMMAND[await readLanguage($)] });
    } catch {
      // Without its command the pane cannot open; the rest of the mod goes on.
    }
    return next(e);
  });
  // The pane opens only by its command, which closes it when it is open. The command, the pane's id and the matchers are
  // literals: `claude plugin validate` reads a matcher's values off the source, and a named one reads as `?`.
  on('command.run', { command: 'binnacle-pane' }, async ($) => {
    if ((await $.ui.panes()).some((pane) => pane.id === 'binnacle')) await $.ui.close({ id: 'binnacle' });
    else await $.ui.open({ id: 'binnacle', title: 'Binnacle' });
    return {};
  });
  // The pane's snapshot from the last view drawn, nothing without one; each button puts its command in the prompt box and sends nothing.
  on('ui.render', { component: 'Pane', requestId: 'binnacle' }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e);
    const pane = kept.shown?.pane;
    if (pane === undefined) return h(Box, null);
    return h(
      Box,
      { flexDirection: 'column' },
      ...pane.sections.flatMap((section) => [h(Text, { bold: true }, section.heading), ...section.lines.map((line) => h(Text, null, line))]),
      // A box that cannot take the text (a dialog holds the keys) leaves the press without effect.
      ...pane.buttons.map(({ key, command }) => h(Button, { key, onPress: () => void $.prompt.fill({ text: command, mode: 'replace' }).catch(() => {}) }, command)),
    );
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
