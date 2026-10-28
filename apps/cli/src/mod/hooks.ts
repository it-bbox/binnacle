import { personLanguage } from '@binnacle/core';
import { view, type ViewInput } from './view.ts';

/**
 * `binnacle-mod`'s hooks module (ADR-0047), bundled with the view into one ES module with no `import()`, which
 * Claude Code refuses. The mod has no Node: it reaches the daemon only through the `binnacle` MCP server, and reads
 * the session's figures from Claude Code. It writes nothing.
 */

/** The oldest Claude Code the mod was validated on; raised with the mod whenever its API moves. */
export const MINIMUM_CLAUDE_CODE = '2.1.308';

/** How often a session refreshes on its own: the daemon's forge cache period, so sessions add no forge calls. */
const REFRESH_MS = 60_000;

/**
 * The few parts of Claude Code's `$` the mod uses, typed here: the engine's own declarations are written by
 * Claude Code beside a mod it loads, not shipped to this repository.
 */
type Engine = {
  mcp: { call: (server: string, tool: string, args?: Record<string, unknown>) => Promise<{ content: { type: string; text?: string }[]; isError: boolean }> };
  session: { id: () => Promise<string>; usage: () => Promise<Pick<ViewInput, 'context' | 'rateLimits'>> };
  env: { get: (name: string) => Promise<string | undefined | null> };
  clock: { every: (ms: number, fn: () => void) => unknown };
  ui: { status: (text: string | undefined) => void };
};
type Hook = ($: Engine, e: never, next: (e: never) => Promise<unknown>) => Promise<unknown>;
type On = (event: 'session.start' | 'session.measure', hook: Hook) => unknown;

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

/** Reads the snapshot and Claude Code's figures, and draws the line, or clears it when the snapshot could not be read. Never throws. */
async function refresh($: Engine): Promise<void> {
  try {
    // `$.env.get` takes literal names, which `claude plugin validate` lists.
    const [snapshot, usage, lcAll, lang] = await Promise.all([readSnapshot($), $.session.usage(), $.env.get('LC_ALL'), $.env.get('LANG')]);
    const language = personLanguage({ LC_ALL: lcAll ?? undefined, LANG: lang ?? undefined });
    $.ui.status(view({ snapshot, context: usage.context, rateLimits: usage.rateLimits, language }).status);
  } catch {
    $.ui.status(undefined);
  }
}

// A function declaration: `claude plugin validate` reads `register` off the bundle's source and refuses an arrow bound to a name.
export function register(on: On): void {
  on('session.start', async ($, e, next) => {
    const started = await next(e);
    await refresh($);
    $.clock.every(REFRESH_MS, () => void refresh($));
    return started;
  });
  // After each turn: Claude Code measures the session and the snapshot may have moved with it.
  on('session.measure', async ($, e, next) => {
    await refresh($);
    return next(e);
  });
}
