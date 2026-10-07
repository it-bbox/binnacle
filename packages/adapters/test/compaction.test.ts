import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readClaudeCode, readCodex } from '../src/index.ts';

/**
 * The compaction markers of Claude Code and Codex, read beside their records. The lines are
 * cut from real sessions on this machine, with their ids, times and directories changed and
 * their content replaced by `CONTENT`, which no marker may carry.
 */
const CONTENT = 'CONTENT-MUST-NOT-BE-KEPT';
const bytes = (lines: Record<string, unknown>[]): Buffer => Buffer.from(lines.map((line) => `${JSON.stringify(line)}\n`).join(''));

const SESSION = '1d1778ac-def7-4c12-a2b5-92bcc8426608';
const CWD = '/repo';

function assistant(id: string, timestamp: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'assistant',
    isSidechain: false,
    timestamp,
    cwd: CWD,
    sessionId: SESSION,
    message: { id, model: 'claude-opus-5-5', usage: { input_tokens: 2, cache_read_input_tokens: 39225, cache_creation_input_tokens: 29831, output_tokens: 137 }, content: [{ type: 'text', text: CONTENT }] },
    ...extra,
  };
}

/** A compaction boundary as Claude Code 2.1 writes it, its preserved segment and tool list cut short. */
function boundary(uuid: string, timestamp: string, trigger: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    parentUuid: null,
    logicalParentUuid: 'a580e28b-95ff-487e-9334-81cebb89a3e8',
    isSidechain: false,
    type: 'system',
    subtype: 'compact_boundary',
    content: CONTENT,
    level: 'info',
    uuid,
    timestamp,
    cwd: CWD,
    sessionId: SESSION,
    gitBranch: 'main',
    compactMetadata: { trigger, preTokens: 996850, postTokens: 23587, preCompactDiscoveredTools: [CONTENT], preservedMessages: { uuids: [CONTENT] } },
    ...extra,
  };
}

describe('Claude Code compaction markers', () => {
  it('gives a marker per compaction boundary, with its trigger, beside the records, and never its content', () => {
    const file = bytes([
      assistant('msg_1', '2026-10-07T09:00:00.000Z'),
      boundary('b9151d72-35ae-462a-bf26-5ccb7807569f', '2026-10-07T09:10:00.000Z', 'auto'),
      assistant('msg_2', '2026-10-07T09:11:00.000Z'),
      boundary('c0151d72-35ae-462a-bf26-5ccb7807569f', '2026-10-07T09:20:00.000Z', 'manual'),
    ]);
    const reading = readClaudeCode(file, { offset: 0, line: 0 }, true);
    assert.equal(reading.failure, null);
    assert.deepEqual(reading.records.map((record) => record.naturalKey), ['msg_1', 'msg_2']);
    assert.deepEqual(reading.markers, [
      {
        harness: 'claude-code',
        naturalKey: 'b9151d72-35ae-462a-bf26-5ccb7807569f',
        sessionId: SESSION,
        subagentId: null,
        timestamp: '2026-10-07T09:10:00.000Z',
        cwd: CWD,
        trigger: 'auto',
        provenance: 'provider_reported',
      },
      {
        harness: 'claude-code',
        naturalKey: 'c0151d72-35ae-462a-bf26-5ccb7807569f',
        sessionId: SESSION,
        subagentId: null,
        timestamp: '2026-10-07T09:20:00.000Z',
        cwd: CWD,
        trigger: 'manual',
        provenance: 'provider_reported',
      },
    ]);
    assert.doesNotMatch(JSON.stringify(reading.markers), new RegExp(CONTENT));
  });

  it('names the subagent whose session compacted, and gives a trigger it does not know as null', () => {
    const file = bytes([boundary('d0151d72-35ae-462a-bf26-5ccb7807569f', '2026-10-07T09:10:00.000Z', 'auto', { isSidechain: true, agentId: 'aa8633a64ffc4a92a', compactMetadata: {} })]);
    const [marker] = readClaudeCode(file, { offset: 0, line: 0 }, true).markers;
    assert.deepEqual({ subagentId: marker?.subagentId, trigger: marker?.trigger }, { subagentId: 'aa8633a64ffc4a92a', trigger: null });
  });

  it('stops at a compaction boundary without a timestamp, with the reason, and keeps what came before it', () => {
    const file = bytes([assistant('msg_1', '2026-10-07T09:00:00.000Z'), { ...boundary('e0151d72-35ae-462a-bf26-5ccb7807569f', '', 'auto'), timestamp: undefined }]);
    const reading = readClaudeCode(file, { offset: 0, line: 0 }, true);
    assert.deepEqual(reading.failure, { line: 2, reason: 'a compaction boundary without a timestamp' });
    assert.deepEqual(reading.records.map((record) => record.naturalKey), ['msg_1']);
    assert.deepEqual(reading.markers, []);
  });
});

const ROLLOUT = '01a0e491-e764-7952-8750-428ac9879bca';

const meta = (window: string | null): Record<string, unknown> => ({
  timestamp: '2026-10-07T09:00:00.000Z',
  ordinal: 0,
  type: 'session_meta',
  payload: { id: ROLLOUT, cwd: CWD, model_provider: 'openai', base_instructions: CONTENT, ...(window === null ? {} : { context_window: { window_id: window } }) },
});
const compacted = (ordinal: number, timestamp: string, window: string | null): Record<string, unknown> => ({
  timestamp,
  ordinal,
  type: 'compacted',
  payload: { message: CONTENT, replacement_history: [{ type: 'message', content: CONTENT }], ...(window === null ? {} : { window_id: window }) },
});

describe('Codex compaction markers', () => {
  it('gives a marker where a compaction changes the context-window identifier, calculated and without a trigger, and never its content', () => {
    const file = bytes([
      meta('01a0e491-e764-7952-8750-42953a91f830'),
      compacted(7, '2026-10-07T10:00:00.000Z', '01a0e853-d89d-74a2-b2f9-c515cccbe704'),
      // The identifier in force again is no rotation.
      compacted(9, '2026-10-07T10:30:00.000Z', '01a0e853-d89d-74a2-b2f9-c515cccbe704'),
      compacted(12, '2026-10-07T11:00:00.000Z', '01a0ec2f-be6e-78a2-8ffe-7f2591454817'),
    ]);
    const reading = readCodex(file);
    assert.equal(reading.failure, null);
    assert.deepEqual(reading.markers, [
      { harness: 'codex', naturalKey: `${ROLLOUT}:7`, sessionId: ROLLOUT, subagentId: null, timestamp: '2026-10-07T10:00:00.000Z', cwd: CWD, trigger: null, provenance: 'calculated' },
      { harness: 'codex', naturalKey: `${ROLLOUT}:12`, sessionId: ROLLOUT, subagentId: null, timestamp: '2026-10-07T11:00:00.000Z', cwd: CWD, trigger: null, provenance: 'calculated' },
    ]);
    assert.doesNotMatch(JSON.stringify(reading.markers), new RegExp(CONTENT));
  });

  it('takes the first identifier a compaction names as a change when the session meta names none, and gives none for a compaction that names none', () => {
    const reading = readCodex(bytes([meta(null), compacted(3, '2026-10-07T10:00:00.000Z', null), compacted(5, '2026-10-07T10:10:00.000Z', '01a0e853-d89d-74a2-b2f9-c515cccbe704')]));
    assert.deepEqual(reading.markers.map((marker) => marker.naturalKey), [`${ROLLOUT}:5`]);
  });

  it('stops at a compaction before the session meta, with the reason', () => {
    const reading = readCodex(bytes([compacted(3, '2026-10-07T10:00:00.000Z', '01a0e853-d89d-74a2-b2f9-c515cccbe704')]));
    assert.deepEqual(reading.failure, { line: 1, reason: 'a compaction before the session meta' });
    assert.deepEqual(reading.markers, []);
  });
});
