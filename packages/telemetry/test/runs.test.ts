import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ACTIVE_WITHIN_MS, observedRuns, type RunRecord } from '../src/index.ts';

/**
 * A second seam, as in `packages/core`: the daemon's API shows attribution through the
 * snapshot's totals, and does not show a run's id, role or `active` until `usage.get`
 * (ticket 03). What a run is, and that its id survives more records arriving, is pinned here.
 */
const NOW = new Date('2026-09-25T12:00:00Z');
let ordinal = 0;
function record(minute: number, fields: Partial<RunRecord> = {}): RunRecord {
  return {
    harness: 'claude-code',
    naturalKey: `msg_${String(++ordinal).padStart(3, '0')}`,
    sessionId: 'session',
    subagentId: null,
    timestamp: new Date(NOW.getTime() - (60 - minute) * 60_000).toISOString(),
    cwd: '/repo',
    checkout: '/repo',
    branch: { name: 'main', source: 'harness' },
    provider: null,
    model: 'claude-opus-5-5',
    tokens: { input: 1, cachedInput: null, cacheCreation: null, output: 1, reasoning: null },
    provenance: 'provider_reported',
    ...fields,
  };
}

const tasks = [{ id: 'epic/01', title: 'First', ticket: 'docs/specs/epic/issues/01-first.md' }];
const attribution = { projectPath: '/repo', defaultBranch: 'main', tasks, remote: false, now: NOW };
const feat = { name: 'feat/first', source: 'harness' } as const;

test('a run is one stretch of one session in one checkout on one branch, with the id of its first record', () => {
  const records = [
    record(0),
    record(1, { branch: feat }),
    record(2, { branch: feat, cwd: '/repo/apps/cli' }),
    record(3, { branch: feat, checkout: '/repo/.claude/worktrees/x', cwd: '/repo/.claude/worktrees/x' }),
    record(4, { branch: { name: 'fix/other', source: 'harness' } }),
    record(5, { branch: null }),
    record(6, { sessionId: 'another' }),
  ];
  // Given in any order, they are read in time order.
  const runs = observedRuns([...records].reverse(), attribution);
  assert.deepEqual(
    runs.map((run) => [run.id, run.records.length, run.branch, run.taskId, run.role]),
    [
      ['claude-code:msg_001', 1, 'main', null, 'product'],
      ['claude-code:msg_002', 2, 'feat/first', 'epic/01', 'implementation'],
      ['claude-code:msg_004', 1, 'feat/first', 'epic/01', 'implementation'],
      ['claude-code:msg_005', 1, 'fix/other', null, 'unknown'],
      ['claude-code:msg_006', 1, null, null, 'unknown'],
      ['claude-code:msg_007', 1, 'main', null, 'product'],
    ],
  );

  // More records of a run keep its id.
  const later = observedRuns([...records.slice(0, 2), record(7, { branch: feat })], attribution);
  assert.deepEqual(later.map((run) => [run.id, run.records.length]), [['claude-code:msg_001', 1], ['claude-code:msg_002', 2]]);
});

test('a run is active while its latest record is recent, which is a calculated reading', () => {
  const [run] = observedRuns([record(0, { model: 'first' }), record(60 - ACTIVE_WITHIN_MS / 60_000, { model: 'latest', provider: 'anthropic' })], attribution);
  assert.deepEqual(
    { ...run, records: run!.records.length },
    {
      id: run!.id,
      projectPath: '/repo',
      taskId: null,
      role: 'product',
      harness: 'claude-code',
      provider: 'anthropic',
      model: 'latest',
      branch: 'main',
      branchSource: 'harness',
      parentRunId: null,
      startedAt: '2026-09-25T11:00:00.000Z',
      lastActivityAt: '2026-09-25T11:50:00.000Z',
      active: { value: true, provenance: 'calculated' },
      records: 2,
    },
  );
  const [idle] = observedRuns([record(59 - ACTIVE_WITHIN_MS / 60_000)], attribution);
  assert.deepEqual(idle!.active, { value: false, provenance: 'calculated' });
});
