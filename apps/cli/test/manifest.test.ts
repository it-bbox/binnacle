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

/**
 * Epic 24, ticket 14: the MCP Registry verifies an npm package by the `mcpName` of its published
 * `package.json`, which must equal the `name` of the `server.json` the listings prepare.
 */
test('the published manifest carries the MCP Registry name the listings submit', () => {
  const manifest = publishManifest({ version: '0.0.0', engines: {} });
  assert.equal(manifest.mcpName, 'io.github.it-bbox/binnacle');

  const json = /```json server\.json\n([\s\S]*?)\n```/.exec(docText('docs/showcase/listings.md'))?.[1];
  assert.ok(json, 'the listings prepare a server.json');
  const server = JSON.parse(json) as {
    name: string;
    description: string;
    packages: { registryType: string; identifier: string; runtimeHint: string; runtimeArguments: { value: string }[]; packageArguments: { value: string }[]; transport: { type: string } }[];
  };
  assert.equal(server.name, manifest.mcpName);
  assert.ok(server.description.length <= 100, "the registry schema's limit");
  const [npm] = server.packages;
  assert.ok(npm);
  assert.equal(npm.registryType, 'npm');
  assert.equal(npm.identifier, manifest.name);
  assert.equal(npm.transport.type, 'stdio');
  // A client runs `npx <runtimeArguments> <identifier>@<version> <packageArguments>`. The package has two
  // bins, so a bare `--package` takes the identifier, and `binn mcp` is the command that serves MCP.
  assert.equal(npm.runtimeHint, 'npx');
  assert.deepEqual(npm.runtimeArguments.map(({ value }) => value), ['-y', '--package']);
  assert.deepEqual(npm.packageArguments.map(({ value }) => value), ['binn', 'mcp']);
  assert.ok('binn' in manifest.bin);
});
