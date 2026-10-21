import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { WORDED_CODES } from '@binnacle/core';

/**
 * Every code a person can be shown has a Russian wording (spec `human-output`, *Core's wording*).
 * The daemon gives its messages from its own sources, core's and the adapters' it reads the
 * tracker and Git with; this reads those sources, as the dashboard's type-scale test reads its
 * own, and finds every code they emit: a diagnostic's `code:`, the first argument of an error,
 * of a remote tracker's or Git's failure, a forge's refusal, and a detail's `expected.*`.
 */

const SOURCES = ['../src/', '../../../packages/core/src/', '../../../packages/adapters/src/'].map((path) => new URL(path, import.meta.url));

const CODE = String.raw`'([a-z_]+\.[a-z_]+)'`;
const EMITTED = [
  new RegExp(String.raw`\bcode: ${CODE}`, 'g'),
  new RegExp(String.raw`\b(?:OperationError|super|failed|unavailable)\(\s*${CODE}`, 'g'),
  new RegExp(String.raw`return \[${CODE},\s*\``, 'g'),
  new RegExp(String.raw`'(expected\.[a-z_]+)'`, 'g'),
];

const emitted = new Map<string, string>();
for (const source of SOURCES) {
  for (const name of readdirSync(source).filter((file) => file.endsWith('.ts'))) {
    const text = readFileSync(new URL(name, source), 'utf8');
    for (const pattern of EMITTED) for (const match of text.matchAll(pattern)) if (!emitted.has(match[1]!)) emitted.set(match[1]!, name);
  }
}

describe("the daemon's codes", () => {
  it('are found in its sources, the known ones among them', () => {
    for (const code of ['next_action.stale', 'request.invalid', 'tracker.unreachable', 'tracker.rate_limited', 'git.timeout', 'registry.unreadable', 'expected.hash', 'manifest.unknown_key']) {
      assert.ok(emitted.has(code), `${code} is not found: a pattern no longer matches how the sources emit it`);
    }
  });

  it('each have a Russian wording in core', () => {
    const missing = [...emitted].filter(([code]) => !WORDED_CODES.includes(code)).map(([code, file]) => `${code} (${file})`);
    assert.deepEqual(missing, []);
  });

  it('are the codes core words, none of which is left over', () => {
    assert.deepEqual(WORDED_CODES.filter((code) => !emitted.has(code)), []);
  });
});
