import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readZcode, type ZcodeCall } from '../src/index.ts';

/**
 * ZCode's model calls as its database holds them, from ticket 06's sample (ZCode 3.14.4,
 * `~/.zcode/cli/db/db.sqlite`): a `model_usage` row per call, with the session it belongs to.
 * ZCode's input includes the input read from cache: 24 244 = 4 788 uncached + 19 456 cached.
 */
const call = (id: string, completedAt: number, changed: Partial<ZcodeCall> = {}): ZcodeCall => ({
  id,
  sessionId: 'sess_main',
  directory: '/repo/apps',
  parentSession: null,
  time: completedAt,
  provider: 'account:zai-individual-coding-plan',
  model: 'GLM-5.3',
  input: 24_244,
  output: 59,
  reasoning: 0,
  cacheCreation: 0,
  cacheRead: 19_456,
  ...changed,
});

const CALLS: ZcodeCall[] = [
  call('usage_model_main_turn_msg_1_0', 1_791_463_531_195),
  call('usage_model_session_title_msg_1_0', 1_791_463_533_000, { model: 'GLM-5.3-air', input: 900, output: 12, reasoning: 8, cacheCreation: 100, cacheRead: 0 }),
  // A call written without its counts: each null, never zero.
  call('usage_model_main_turn_msg_2_0', 1_791_463_540_000, { input: null, output: null, reasoning: null, cacheCreation: null, cacheRead: null }),
];

describe('ZCode calls', () => {
  it('gives a record per call, with input less what was read from or written to cache, reasoning within output, and the provider and model apart', () => {
    const reading = readZcode(CALLS);
    assert.deepEqual(reading.failures, []);
    assert.deepEqual(
      reading.records.map(({ naturalKey, provider, model, timestamp, tokens }) => ({ naturalKey, provider, model, timestamp, tokens })),
      [
        {
          naturalKey: 'usage_model_main_turn_msg_1_0',
          provider: 'account:zai-individual-coding-plan',
          model: 'GLM-5.3',
          timestamp: '2026-10-08T12:45:31.195Z',
          tokens: { input: 4_788, cachedInput: 19_456, cacheCreation: 0, output: 59, reasoning: 0 },
        },
        {
          naturalKey: 'usage_model_session_title_msg_1_0',
          provider: 'account:zai-individual-coding-plan',
          model: 'GLM-5.3-air',
          timestamp: '2026-10-08T12:45:33.000Z',
          tokens: { input: 800, cachedInput: 0, cacheCreation: 100, output: 12, reasoning: 8 },
        },
        {
          naturalKey: 'usage_model_main_turn_msg_2_0',
          provider: 'account:zai-individual-coding-plan',
          model: 'GLM-5.3',
          timestamp: '2026-10-08T12:45:40.000Z',
          tokens: { input: null, cachedInput: null, cacheCreation: null, output: null, reasoning: null },
        },
      ],
    );
    const [first] = reading.records;
    assert.deepEqual(
      { harness: first!.harness, requestId: first!.requestId, sessionId: first!.sessionId, subagentId: first!.subagentId, parentSession: first!.parentSession, cwd: first!.cwd, branch: first!.branch, provenance: first!.provenance },
      { harness: 'zcode', requestId: null, sessionId: 'sess_main', subagentId: null, parentSession: null, cwd: '/repo/apps', branch: null, provenance: 'calculated' },
    );
  });

  it('names a subagent’s call after the session that started it', () => {
    const [record] = readZcode([call('usage_1', 1_791_463_531_195, { sessionId: 'sess_child', parentSession: 'sess_main' })]).records;
    assert.deepEqual([record!.sessionId, record!.subagentId, record!.parentSession], ['sess_main', 'sess_child', 'sess_main']);
  });

  it('leaves input null when its cached part is unknown or larger than it, and a provider or model it did not write null', () => {
    const [unknown, larger] = readZcode([
      call('usage_1', 1_791_463_531_195, { cacheRead: null, provider: null, model: null }),
      call('usage_2', 1_791_463_531_195, { input: 10, cacheRead: 20 }),
    ]).records;
    assert.deepEqual([unknown!.tokens.input, unknown!.provider, unknown!.model], [null, null, null]);
    assert.equal(larger!.tokens.input, null);
  });

  it('stops a session at a call it cannot read, with the reason, keeping what came before it and the other sessions', () => {
    const other = call('usage_other', 1_791_463_550_000, { sessionId: 'sess_other', directory: '/elsewhere' });
    const broken = (changed: Partial<ZcodeCall>) => readZcode([CALLS[0]!, { ...CALLS[1]!, ...changed }, CALLS[2]!, other]);
    const failure = (reason: string, directory = '/repo/apps') => [{ id: 'usage_model_session_title_msg_1_0', sessionId: 'sess_main', directory, reason }];

    const noDirectory = broken({ directory: '' });
    assert.deepEqual(noDirectory.failures, failure('a call of a session without its directory', ''));
    assert.deepEqual(noDirectory.records.map((record) => record.naturalKey), ['usage_model_main_turn_msg_1_0', 'usage_other']);
    assert.deepEqual(broken({ time: Number.NaN }).failures, failure('a call without the time it completed'));
  });
});
