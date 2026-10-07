import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { readGeminiCli } from '../src/index.ts';

/**
 * A Gemini CLI session file, built from its `ChatRecordingService`'s format: the session's
 * metadata, a prompt, one call written first without tokens and again with them, a patch, a
 * notice, a second call on another model with tool-use prompt tokens, a metadata update, a
 * rewind and a last call with no tokens. No Gemini CLI install was at hand; the exit
 * demonstration confirms it against the owner's.
 */
const SESSION = readFileSync(join(import.meta.dirname, 'fixtures', 'gemini-cli', 'session.jsonl'));
const ID = '3f6d2c1a-8b47-4e0f-9a35-0c7e5b9d1f42';
const CWD = '/repo';
const main = { cwd: CWD, parentSession: null };

describe('Gemini CLI session files', () => {
  it('gives a record per call, its last line, with what was not read from cache as input and thoughts within output', () => {
    const reading = readGeminiCli(SESSION, main, true);
    assert.equal(reading.failure, null);
    assert.deepEqual(reading.stop, { offset: SESSION.length, line: 10 });
    assert.deepEqual(
      reading.records.map(({ naturalKey, model, timestamp, tokens }) => ({ naturalKey, model, timestamp, tokens })),
      [
        {
          naturalKey: 'c0ffee01-2b3c-4d5e-8f90-1a2b3c4d5e6f',
          model: 'gemini-2.5-pro',
          timestamp: '2026-10-07T09:00:09.000Z',
          tokens: { input: 12480 - 8192, cachedInput: 8192, cacheCreation: null, output: 312 + 120, reasoning: 120 },
        },
        {
          naturalKey: 'd1e2f3a4-b5c6-4d7e-8f90-a1b2c3d4e5f6',
          model: 'gemini-2.5-flash',
          timestamp: '2026-10-07T09:00:21.000Z',
          // The tool-use prompt is input too, outside the prompt's count.
          tokens: { input: 13050 - 12288 + 40, cachedInput: 12288, cacheCreation: null, output: 96, reasoning: 0 },
        },
        // A call whose tokens Gemini CLI never recorded: every count null, never zero.
        {
          naturalKey: 'e9f8a7b6-c5d4-4e3f-a2b1-c0d9e8f7a6b5',
          model: 'gemini-2.5-pro',
          timestamp: '2026-10-07T09:00:40.000Z',
          tokens: { input: null, cachedInput: null, cacheCreation: null, output: null, reasoning: null },
        },
      ],
    );
    const [first] = reading.records;
    assert.deepEqual(
      { ...first, tokens: undefined, naturalKey: undefined, model: undefined, timestamp: undefined },
      {
        harness: 'gemini-cli',
        requestId: null,
        sessionId: ID,
        subagentId: null,
        parentSession: null,
        cwd: CWD,
        branch: null,
        provider: null,
        provenance: 'calculated',
        tokens: undefined,
        naturalKey: undefined,
        model: undefined,
        timestamp: undefined,
      },
    );
    assert.doesNotMatch(JSON.stringify(reading.records), /MUST-NOT-BE-STORED/);
  });

  it('leaves the last call for a later reading until the file has settled', () => {
    const reading = readGeminiCli(SESSION, main, false);
    assert.deepEqual(reading.records.map((record) => record.naturalKey), ['c0ffee01-2b3c-4d5e-8f90-1a2b3c4d5e6f', 'd1e2f3a4-b5c6-4d7e-8f90-a1b2c3d4e5f6']);
    assert.equal(reading.stop.line, 9);
    assert.equal(reading.failure, null);
  });

  it('names a subagent’s file after the session that started it', () => {
    const [record] = readGeminiCli(SESSION, { cwd: CWD, parentSession: 'parent' }, true).records;
    assert.deepEqual([record!.sessionId, record!.subagentId, record!.parentSession], ['parent', ID, 'parent']);
  });

  it('stops at a line it cannot read, with the reason, keeping what came before it', () => {
    const lines = SESSION.toString('utf8').split('\n');
    const broken = (at: number, line: string): Buffer => Buffer.from([...lines.slice(0, at), line, ...lines.slice(at)].join('\n'));

    const notJson = readGeminiCli(broken(6, '{"id": "cut'), main, true);
    assert.deepEqual(notJson.failure, { line: 7, reason: 'not a JSON line' });
    assert.equal(notJson.records.length, 1);

    const noTimestamp = readGeminiCli(broken(6, '{"id":"x","type":"gemini","tokens":null}'), main, true);
    assert.deepEqual(noTimestamp.failure, { line: 7, reason: 'a gemini message without a timestamp' });

    const noId = readGeminiCli(broken(6, '{"timestamp":"2026-10-07T09:00:11.000Z","type":"gemini","tokens":null}'), main, true);
    assert.deepEqual(noId.failure, { line: 7, reason: 'a gemini message without an id' });

    const cachedOverInput = readGeminiCli(broken(6, '{"id":"x","timestamp":"2026-10-07T09:00:11.000Z","type":"gemini","tokens":{"input":1,"cached":2,"output":0,"thoughts":0,"tool":0}}'), main, true);
    assert.deepEqual(cachedOverInput.failure, { line: 7, reason: 'more input read from cache than input' });

    const beforeMetadata = readGeminiCli(Buffer.from(lines.slice(2).join('\n')), main, true);
    assert.deepEqual(beforeMetadata.failure, { line: 1, reason: 'a gemini message before the session metadata' });
    assert.deepEqual(beforeMetadata.records, []);
  });
});
