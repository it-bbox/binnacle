import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readOpencode, type OpencodeStep } from '../src/index.ts';

/**
 * opencode's steps as its database holds them, built from its source (v1.18.35,
 * `packages/core/src/session/sql.ts` and `packages/schema/src/v1/session.ts`): a
 * `step-finish` part per model call, with the assistant message it belongs to. opencode
 * writes input without what was read from or written to cache, and output without reasoning.
 * No opencode install was at hand; the exit demonstration confirms it against the owner's.
 */
const MESSAGE = {
  role: 'assistant',
  time: { created: 1_791_363_600_000, completed: 1_791_363_620_000 },
  parentID: 'msg_user',
  modelID: 'claude-sonnet-4-5',
  providerID: 'anthropic',
  mode: 'build',
  agent: 'build',
  path: { cwd: '/repo/apps', root: '/repo' },
  cost: 0.12,
  tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
  structured: 'MUST-NOT-BE-STORED',
};

const step = (id: string, time: number, tokens: unknown, message: object = MESSAGE): OpencodeStep => ({
  id,
  sessionId: 'ses_main',
  directory: '/repo',
  parentSession: null,
  time,
  part: JSON.stringify({ type: 'step-finish', reason: 'tool-calls', snapshot: 'MUST-NOT-BE-STORED', cost: 0.01, tokens }),
  message: JSON.stringify(message),
});

const STEPS: OpencodeStep[] = [
  step('prt_1', 1_791_363_605_000, { total: 15_552, input: 2_400, output: 320, reasoning: 64, cache: { read: 12_288, write: 540 } }),
  step('prt_2', 1_791_363_619_000, { input: 180, output: 96, reasoning: 0, cache: { read: 14_000, write: 0 } }, { ...MESSAGE, modelID: 'gpt-5', providerID: 'openrouter' }),
  // A step written without its counts: each null, never zero.
  step('prt_3', 1_791_363_640_000, {}),
];

describe('opencode steps', () => {
  it('gives a record per step, with the input opencode writes, reasoning within output, and the provider it names', () => {
    const reading = readOpencode(STEPS);
    assert.deepEqual(reading.failures, []);
    assert.deepEqual(
      reading.records.map(({ naturalKey, provider, model, timestamp, tokens }) => ({ naturalKey, provider, model, timestamp, tokens })),
      [
        {
          naturalKey: 'prt_1',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          timestamp: '2026-10-07T09:00:05.000Z',
          tokens: { input: 2_400, cachedInput: 12_288, cacheCreation: 540, output: 320 + 64, reasoning: 64 },
        },
        {
          naturalKey: 'prt_2',
          provider: 'openrouter',
          model: 'gpt-5',
          timestamp: '2026-10-07T09:00:19.000Z',
          tokens: { input: 180, cachedInput: 14_000, cacheCreation: 0, output: 96, reasoning: 0 },
        },
        {
          naturalKey: 'prt_3',
          provider: 'anthropic',
          model: 'claude-sonnet-4-5',
          timestamp: '2026-10-07T09:00:40.000Z',
          tokens: { input: null, cachedInput: null, cacheCreation: null, output: null, reasoning: null },
        },
      ],
    );
    const [first] = reading.records;
    assert.deepEqual(
      { harness: first!.harness, requestId: first!.requestId, sessionId: first!.sessionId, subagentId: first!.subagentId, parentSession: first!.parentSession, cwd: first!.cwd, branch: first!.branch, provenance: first!.provenance },
      { harness: 'opencode', requestId: null, sessionId: 'ses_main', subagentId: null, parentSession: null, cwd: '/repo/apps', branch: null, provenance: 'calculated' },
    );
    assert.doesNotMatch(JSON.stringify(reading.records), /MUST-NOT-BE-STORED/);
  });

  it('names a subagent’s step after the session that started it', () => {
    const [record] = readOpencode([{ ...STEPS[0]!, sessionId: 'ses_child', parentSession: 'ses_main' }]).records;
    assert.deepEqual([record!.sessionId, record!.subagentId, record!.parentSession], ['ses_main', 'ses_child', 'ses_main']);
  });

  it('gives no record for a part that is no step-finish', () => {
    assert.deepEqual(readOpencode([{ ...STEPS[0]!, part: JSON.stringify({ type: 'text', text: 'MUST-NOT-BE-STORED' }) }]), { records: [], failures: [] });
  });

  it('stops a session at a step it cannot read, with the reason, keeping what came before it and the other sessions', () => {
    const other = { ...STEPS[2]!, id: 'prt_other', sessionId: 'ses_other', directory: '/elsewhere' };
    const broken = (changed: Partial<OpencodeStep>) => readOpencode([STEPS[0]!, { ...STEPS[1]!, ...changed }, STEPS[2]!, other]);
    const failure = (reason: string) => [{ step: 'prt_2', sessionId: 'ses_main', directory: '/repo', reason }];

    const notJson = broken({ part: '{"type": "step-fin' });
    assert.deepEqual(notJson.failures, failure('a part that is not JSON'));
    assert.deepEqual(notJson.records.map((record) => record.naturalKey), ['prt_1', 'prt_other']);

    assert.deepEqual(broken({ message: '[]' }).failures, failure('a message that is not a JSON object'));
    assert.deepEqual(broken({ message: JSON.stringify({ ...MESSAGE, role: 'user' }) }).failures, failure('a step of no assistant message'));
    assert.deepEqual(broken({ message: JSON.stringify({ ...MESSAGE, path: undefined }) }).failures, failure('an assistant message without its directory'));
    assert.deepEqual(broken({ time: Number.NaN }).failures, failure('a step without the time it was written'));
  });
});
