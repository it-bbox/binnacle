import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { prepareMod } from '../src/prepare.ts';

/**
 * Claude Code's own checks on the built mod (ADR-0047), where `claude` is installed: CI does not install it, and
 * `pnpm test` does not run this. `claude plugin validate` reads the bundle as the engine will, and `claude plugin test`
 * runs a hooks test against the engine's own `$`, which drives `session.start`, the refreshes after it and the band.
 */

const skip = spawnSync('claude', ['--version']).error !== undefined && '`claude` is not on PATH.';

/** The hooks test `claude plugin test` runs, beneath the mod: the test's hooks stand for the engine and the `binnacle` server. */
const HOOKS_TEST = `import { expect, mock, test } from 'claude-code/testing'

const NOTHING = { items: [], remainder: 0 }
const OWN = { taskId: 'claude-code-mod/02', taskTitle: 'The mod', role: 'implementation', totals: { records: 1, input: { tokens: 1000 }, cachedInput: { tokens: null }, cacheCreation: { tokens: null }, output: { tokens: 500 }, reasoning: { tokens: null } } }

test('the status line at the session start, cleared without the daemon, and back at the next refreshes', async ($, on) => {
  mock.env(on, { LANG: 'C' })
  const clock = mock.clock(on)
  const lines: (string | undefined)[] = []
  let snapshot: unknown = null
  on('session.id', () => ({ value: 'session-1' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000, tokens: 84000, percent: 42 }, rateLimits: [{ kind: 'five_hour', percentUsed: 23 }] } }))
  on('mcp.call', (_, e) => {
    expect(e).toEqual({ server: 'binnacle', tool: 'project_snapshot', args: { session: 'session-1' } })
    const text = JSON.stringify(snapshot ?? { error: { code: 'daemon.unreachable', message: 'The daemon is not running.' } })
    return { value: { content: [{ type: 'text', text }], isError: snapshot === null } }
  })
  on('ui.status', (_, e) => (lines.push(e.text), { value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(lines).toEqual([undefined])

  snapshot = { activity: { running: { items: [], remainder: 0 }, recent: [], own: OWN }, checkout: { taskId: 'claude-code-mod/02' }, roadmap: null, next: { action: null, alternatives: [] }, pendingDecisions: { questions: NOTHING, approvals: NOTHING, owner: NOTHING }, attention: [] }
  await clock.advance(60000)
  expect(lines.at(-1)).toBe('claude-code-mod/02 implementation · 500 output tokens (from activity) · context 42% · 5h 23%')

  snapshot = null
  await $.session.measure({ context: { window: 200000 }, rateLimits: [], changed: ['context'] })
  await clock.settle()
  expect(lines.at(-1)).toBe(undefined)
})

const BAND = { plugin: 'binnacle-mod', component: 'AbovePrompt', requestId: 'band', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} } } as const

test('the band with a question waiting, on every surface, and nothing without one', async ($, on) => {
  mock.env(on, { LANG: 'C' })
  const clock = mock.clock(on)
  let questions: unknown = NOTHING
  on('session.id', () => ({ value: 'session-1' }))
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200000 }, rateLimits: [] } }))
  on('mcp.call', () => {
    const snapshot = { activity: { running: { items: [], remainder: 0 }, recent: [] }, checkout: { taskId: 'claude-code-mod/03' }, roadmap: null, next: { action: null, alternatives: [] }, pendingDecisions: { questions, approvals: NOTHING, owner: NOTHING }, attention: [] }
    return { value: { content: [{ type: 'text', text: JSON.stringify(snapshot) }], isError: false } }
  })
  on('ui.status', () => ({ value: undefined }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  // The engine draws an empty band beneath the mod.
  on('ui.render', ($, e) => {
    const { Box } = $.ui.resolve(e)
    return h(Box, { key: 'engine' })
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /Waiting for you/ })).toBe(undefined)
    await ui.unmount()
  }

  questions = { items: [{ id: 'claude-code-mod/03', title: 'The band', ticket: 't.md', question: 'Which?', branch: null }], remainder: 0 }
  await clock.advance(60000)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /Waiting for you/ }))?.text).toBe('Waiting for you')
    expect((await ui.find({ type: 'Text', text: /Unanswered/ }))?.text).toBe('Unanswered questions: 1 (claude-code-mod/03)')
    await ui.unmount()
  }
})
`;

test('Claude Code validates the built mod and runs its hooks test', { skip, timeout: 5 * 60_000 }, (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'binnacle-mod-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const mod = join(dir, 'binnacle-mod');
  prepareMod(mod);

  const validate = spawnSync('claude', ['plugin', 'validate', mod], { encoding: 'utf8' });
  assert.equal(validate.status, 0, validate.stdout + validate.stderr);
  assert.match(validate.stdout, /✔ Validation passed/, validate.stdout);
  // What the engine reads: the manifest and the hooks module. The plugin directory's checks after it are a catalog's
  // submission rules (a README, a licence beside the plugin), which the result does not depend on.
  const engine = validate.stdout.split('Plugin directory checks')[0]!;
  assert.doesNotMatch(engine, /✘/, validate.stdout);
  assert.match(engine, /hooks: session\.start, session\.measure, ui\.render\{component=AbovePrompt\}, prompt\.context/, validate.stdout);

  writeFileSync(join(mod, 'hooks.test.ts'), HOOKS_TEST);
  const run = spawnSync('claude', ['plugin', 'test', mod], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout + run.stderr, /2 pass/);
});
