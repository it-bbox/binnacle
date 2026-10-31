import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { publishManifest } from '../src/manifest.ts';

/** A file of the repository, by its path from the root. */
const docText = (path: string): string => readFileSync(fileURLToPath(new URL(`../../../${path}`, import.meta.url)), 'utf8');
/** The two `text` blocks of the identity file: the description, then the topics. */
const blocks = (): string[] => [...docText('docs/showcase/identity.md').matchAll(/```text\n([\s\S]*?)\n```/g)].map(([, block = '']) => block);

/** Epic 24, ticket 04: the npm package is found, and its page says what the repository says. */
test('the published manifest carries the repository description and its topics as keywords', () => {
  const [description = '', topics = ''] = blocks();
  const keywords = topics.split('\n').map((line) => line.trim()).filter(Boolean);
  assert.ok(description && keywords.length > 0, 'the identity strings');

  const manifest = publishManifest({ version: '0.0.0', engines: {} });
  assert.doesNotMatch(description, /\n/, 'a one-line description');
  assert.equal(manifest.description, description);
  assert.deepEqual(manifest.keywords, keywords);
  // GitHub's topic rules: lowercase, digits and single hyphens; at most 20, no duplicates.
  for (const keyword of keywords) assert.match(keyword, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, keyword);
  assert.ok(keywords.length <= 20);
  assert.equal(new Set(keywords).size, keywords.length);
});
