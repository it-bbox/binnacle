import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { readPi } from '../src/index.ts';

/**
 * A pi session file, built from the owner's (pi 1.1.0, `@earendil-works/pi-coding-agent`),
 * its content replaced: the session header, a call that failed before its provider reported
 * anything, two OpenAI calls, an Anthropic call with cache writes and no reasoning breakdown,
 * a cache-warming call, a compaction with the usage of its summary and one without.
 */
const SESSION = readFileSync(join(import.meta.dirname, 'fixtures', 'pi', 'session.jsonl'));
const ID = '01a11b90-b3e2-709a-b95f-bc851152d76d';
const NONE = { input: null, cachedInput: null, cacheCreation: null, output: null, reasoning: null };

describe('pi session files', () => {
  it('gives a record per call with its tokens, null where pi has no count', () => {
    const reading = readPi(SESSION);
    assert.equal(reading.failure, null);
    assert.deepEqual(reading.stop, { offset: SESSION.length, line: 17 });
    assert.deepEqual(
      reading.records.map(({ naturalKey, requestId, provider, model, timestamp, tokens }) => ({ naturalKey, requestId, provider, model, timestamp, tokens })),
      [
        // Failed before its provider said anything: pi's zeros are no counts.
        { naturalKey: '71ba8ddb@2026-10-08T12:51:20.416Z', requestId: null, provider: 'anthropic', model: 'claude-opus-4-8', timestamp: '2026-10-08T12:51:20.416Z', tokens: NONE },
        {
          naturalKey: '11b1ec87@2026-10-08T12:53:16.703Z',
          requestId: 'resp_008b79c8832f2601016ac79239559887d28dbb6c02503bb1c4',
          provider: 'openai',
          model: 'gpt-6.1-sol',
          timestamp: '2026-10-08T12:53:16.703Z',
          tokens: { input: 3143, cachedInput: 0, cacheCreation: 0, output: 11, reasoning: 0 },
        },
        {
          naturalKey: '8d3f0b91@2026-10-08T12:53:52.120Z',
          requestId: 'resp_0b2c',
          provider: 'openai',
          model: 'gpt-6.1-sol',
          timestamp: '2026-10-08T12:53:52.120Z',
          tokens: { input: 412, cachedInput: 3072, cacheCreation: 0, output: 208, reasoning: 64 },
        },
        // No reasoning breakdown from this provider: null, not 0.
        {
          naturalKey: 'e1f2a3b4@2026-10-08T12:54:09.500Z',
          requestId: 'msg_01AbCd',
          provider: 'anthropic',
          model: 'claude-sonnet-5',
          timestamp: '2026-10-08T12:54:09.500Z',
          tokens: { input: 96, cachedInput: 2048, cacheCreation: 1210, output: 140, reasoning: null },
        },
        {
          naturalKey: 'a7b8c9d0@2026-10-08T12:54:40.000Z',
          requestId: null,
          provider: 'anthropic',
          model: 'claude-sonnet-5',
          timestamp: '2026-10-08T12:54:40.000Z',
          tokens: { input: 4, cachedInput: 3354, cacheCreation: 0, output: 1, reasoning: null },
        },
        // The compaction's summary was a call too; pi does not say on which model.
        {
          naturalKey: 'f0e1d2c3@2026-10-08T12:55:00.000Z',
          requestId: null,
          provider: null,
          model: null,
          timestamp: '2026-10-08T12:55:00.000Z',
          tokens: { input: 3300, cachedInput: 0, cacheCreation: 0, output: 420, reasoning: null },
        },
      ],
    );
    for (const record of reading.records) {
      assert.deepEqual(
        { harness: record.harness, sessionId: record.sessionId, subagentId: record.subagentId, parentSession: record.parentSession, cwd: record.cwd, branch: record.branch, provenance: record.provenance },
        { harness: 'pi', sessionId: ID, subagentId: null, parentSession: null, cwd: '/repo', branch: null, provenance: 'calculated' },
      );
    }
    assert.deepEqual(reading.markers, []);
    assert.doesNotMatch(JSON.stringify(reading.records), /MUST-NOT-BE-STORED/);
  });

  it('leaves a line still being written for the next reading', () => {
    const partial = SESSION.subarray(0, SESSION.length - 20);
    const reading = readPi(partial);
    assert.equal(reading.failure, null);
    assert.equal(reading.stop.line, 16);
    assert.equal(reading.records.length, 6);
  });

  it('stops at a line it cannot read, with the reason, keeping the records before it', () => {
    const lines = SESSION.toString('utf8').split('\n');
    const at = (index: number, line: string): Buffer => Buffer.from([...lines.slice(0, index), line, ...lines.slice(index + 1)].join('\n'));
    const call = JSON.parse(lines[8]!) as Record<string, unknown>;

    const notJson = readPi(at(10, '{"type":"message"'));
    assert.deepEqual(notJson.failure, { line: 11, reason: 'not a JSON line' });
    assert.equal(notJson.records.length, 2);
    assert.deepEqual(notJson.stop, { offset: lines.slice(0, 10).join('\n').length + 1, line: 10 });

    assert.deepEqual(readPi(at(8, JSON.stringify({ ...call, id: undefined }))).failure, { line: 9, reason: 'a pi entry with usage but without an id' });
    assert.deepEqual(readPi(at(8, JSON.stringify({ ...call, timestamp: 'never' }))).failure, { line: 9, reason: 'a pi entry with usage but without a timestamp' });
    assert.deepEqual(readPi(Buffer.from(lines.slice(1).join('\n'))).failure, { line: 5, reason: 'a pi entry with usage before the session header' });
  });
});
