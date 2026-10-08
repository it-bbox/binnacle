import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readAntigravity } from '../src/index.ts';
import { trajectory, trajectorySummaries } from './fixtures/antigravity.ts';

/**
 * Antigravity's sessions, from ticket 06's sample: the conversations' ids and times, from
 * their encrypted `.pb` files, and each one's workspace, from the window state's summaries.
 */
const MAIN = '7d0c3f0e-3c1b-4a8e-9d4e-2f6b8a1c5e01';
const NESTED = '7d0c3f0e-3c1b-4a8e-9d4e-2f6b8a1c5e02';
const PLAYGROUND = '7d0c3f0e-3c1b-4a8e-9d4e-2f6b8a1c5e03';
const UNSUMMARISED = '7d0c3f0e-3c1b-4a8e-9d4e-2f6b8a1c5e04';
const AT = 1_791_463_527_894;

const CONVERSATIONS = [
  { id: MAIN, time: AT },
  { id: NESTED, time: AT + 60_000 },
  { id: PLAYGROUND, time: AT + 120_000 },
  { id: UNSUMMARISED, time: AT + 180_000 },
];

const SUMMARIES = trajectorySummaries([
  trajectory(MAIN, 'file:///repo'),
  // VS Code writes a URI percent-encoded.
  trajectory(NESTED, 'file:///repo/my%20apps'),
  // A conversation with no workspace is no project's.
  trajectory(PLAYGROUND, null),
  // A summary of a conversation whose file is gone has no time.
  trajectory('7d0c3f0e-3c1b-4a8e-9d4e-2f6b8a1c5e05', 'file:///repo'),
]);

const NONE = { input: null, cachedInput: null, cacheCreation: null, output: null, reasoning: null };

describe('readAntigravity', () => {
  it('gives a record per conversation with its workspace, at its time, with no model and no counts', () => {
    assert.deepEqual(readAntigravity(SUMMARIES, CONVERSATIONS), {
      records: [MAIN, NESTED].map((id, index) => ({
        harness: 'antigravity',
        naturalKey: id,
        requestId: null,
        sessionId: id,
        subagentId: null,
        parentSession: null,
        timestamp: new Date(AT + index * 60_000).toISOString(),
        cwd: index === 0 ? '/repo' : '/repo/my apps',
        branch: null,
        provider: null,
        model: null,
        tokens: NONE,
        provenance: 'calculated',
      })),
      failure: null,
    });
  });

  it('keeps nothing of a summary but the id and the workspace', () => {
    assert.doesNotMatch(JSON.stringify(readAntigravity(SUMMARIES, CONVERSATIONS)), /MUST-NOT-BE-STORED/);
  });

  it('gives nothing when the window state holds no summaries', () => {
    assert.deepEqual(readAntigravity(null, CONVERSATIONS), { records: [], failure: null });
  });

  it('says why when the summaries are not base64 of a protobuf', () => {
    assert.deepEqual(readAntigravity('not base64!', CONVERSATIONS), { records: [], failure: 'its trajectory summaries are not base64 of a protobuf' });
    assert.deepEqual(readAntigravity(Buffer.from([0x0a, 0x05, 0x01]).toString('base64'), CONVERSATIONS), {
      records: [],
      failure: 'its trajectory summaries are not base64 of a protobuf',
    });
    assert.deepEqual(readAntigravity('"unterminated', CONVERSATIONS), { records: [], failure: 'its trajectory summaries are not base64 of a protobuf' });
  });

  it('reads the summaries VS Code wrote as a JSON string', () => {
    assert.equal(readAntigravity(JSON.stringify(SUMMARIES), CONVERSATIONS).records.length, 2);
  });
});
