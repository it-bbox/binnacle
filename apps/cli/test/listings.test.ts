import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const LISTINGS = 'docs/showcase/listings.md';
const doc = (path: string): string => readFileSync(join(ROOT, path), 'utf8');
/** The `text` blocks of a showcase file, in order. */
const blocks = (path: string): string[] => [...doc(path).matchAll(/```text\n([\s\S]*?)\n```/g)].map(([, block = '']) => block);

/** Ticket 06 of showcase-and-launch: the submission texts are ready, and say what the repository says. */
test('the listings open with the identity strings the manifest publishes', () => {
  const [description = '', topics = ''] = blocks(LISTINGS);
  assert.deepEqual(blocks('docs/showcase/identity.md').slice(0, 2), [description, topics], 'the identity strings differ');
  assert.ok(doc(LISTINGS).includes('https://github.com/it-bbox/binnacle'), 'no repository URL');
  assert.ok(doc(LISTINGS).includes('https://www.npmjs.com/package/@it-bbox/binnacle'), 'no npm URL');
});

/** The listings are public: no local path, worktree, session or ticket. */
test('the listings name no local path, worktree, session or ticket', () => {
  const text = doc(LISTINGS);
  const private_ = [
    /\/home\//,
    /\/Users\//,
    /[A-Za-z]:\\/,
    /mikhail/,
    /worktrees?\//,
    /\.claude\//,
    /\.scratch\b/,
    /file:\/\//,
    /agent-[0-9a-f]{6,}/,
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
    /showcase-and-launch/,
    /docs\/specs/,
  ];
  for (const pattern of private_) assert.doesNotMatch(text, pattern);
});

/** Every relative link resolves from the file's own directory. */
test('every relative link in the listings resolves', () => {
  const text = doc(LISTINGS);
  const targets = [...text.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '').matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1]!)
    .filter((target) => !/^[a-z]+:/i.test(target) && !target.startsWith('#'));
  assert.ok(targets.length > 0, 'no relative link names the identity strings');
  for (const target of targets) {
    const resolved = posix.normalize(posix.join(posix.dirname(LISTINGS), target.split('#')[0]!));
    assert.ok(existsSync(join(ROOT, resolved)), `broken link ${target}`);
  }
});
