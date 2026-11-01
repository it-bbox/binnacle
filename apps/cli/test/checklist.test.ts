import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const CHECKLIST = 'docs/showcase/launch-checklist.md';
const doc = (): string => readFileSync(join(ROOT, CHECKLIST), 'utf8');

/** The level-two sections, by their heading text. */
const sections = (): { title: string; body: string }[] =>
  doc()
    .split(/^## /m)
    .slice(1)
    .map((block) => {
      const [title = '', ...rest] = block.split('\n');
      return { title: title.trim(), body: rest.join('\n') };
    });
const section = (needle: RegExp): { title: string; body: string } => {
  const found = sections().find(({ title }) => needle.test(title));
  assert.ok(found, `no section matching ${needle}`);
  return found;
};

/** Ticket 07 of showcase-and-launch: the launch runs README, site, listings, posts, in that order. */
test('the checklist orders the steps: README, site, listings, posts', () => {
  assert.deepEqual(
    sections().map(({ title }) => title),
    ['1. The README', '2. The site', '3. The listings', '4. The posts'],
  );
});

/** Ticket 07: the posts are the owner's, never the epic's. */
test("the posts section is marked as the owner's", () => {
  const posts = section(/posts/i);
  assert.match(posts.body, /owner/i, "the posts are not marked as the owner's");
  assert.match(posts.body, /not part of the epic|outside the epic|the epic does not/i, 'the posts are not set apart from the epic');
});

/** Ticket 07: each step names where its artifact lives and what done looks like. */
test('every step names where its artifact lives and what done looks like', () => {
  const paths: { step: RegExp; named: string[] }[] = [
    {
      step: /README/,
      named: [
        'README.md',
        'README.ru.md',
        'assets/demo.gif',
        'assets/overview.png',
        'assets/tasks.png',
        'assets/usage.png',
        'assets/attention.png',
      ],
    },
    {
      step: /site/,
      named: ['.vitepress/config.mts', '.github/workflows/pages.yml', 'docs/showcase/write-up.md', 'docs/showcase/write-up.ru.md'],
    },
    { step: /listings/, named: ['docs/showcase/listings.md', 'docs/showcase/identity.md'] },
    { step: /posts/i, named: ['Reddit', 'Hacker News', 'X', 'Habr', 'Telegram'] },
  ];
  for (const { step, named } of paths) {
    const { body } = section(step);
    for (const artifact of named) assert.ok(body.includes(artifact), `${step}: no ${artifact}`);
    assert.match(body, /Done looks like/, `${step}: no done line`);
    assert.match(body, /^- \[ \]/m, `${step}: no checkbox to tick`);
  }
});

/** The spec says the launch checklist turns on GitHub Discussions, where questions go. */
test('the checklist turns on GitHub Discussions before the posts', () => {
  assert.match(section(/posts/i).body, /GitHub Discussions/);
});

/** The checklist points the owner at the two canonical URLs, as the README, the site and the listings do. */
test('the checklist names the repository and the site', () => {
  const text = doc();
  assert.ok(text.includes('https://github.com/it-bbox/binnacle'), 'no repository URL');
  assert.ok(text.includes('https://it-bbox.github.io/binnacle/'), 'no site URL');
});

/** Every relative link resolves from the file's own directory. */
test('every relative link in the checklist resolves', () => {
  const text = doc();
  const targets = [...text.replace(/^```[\s\S]*?^```/gm, '').replace(/`[^`\n]*`/g, '').matchAll(/\]\(([^)\s]+)\)/g)]
    .map((match) => match[1]!)
    .filter((target) => !/^[a-z]+:/i.test(target) && !target.startsWith('#'));
  assert.ok(targets.length > 0, 'no relative link to the other showcase files');
  for (const target of targets) {
    const resolved = posix.normalize(posix.join(posix.dirname(CHECKLIST), target.split('#')[0]!));
    assert.ok(existsSync(join(ROOT, resolved)), `broken link ${target}`);
  }
});

/** The checklist is public: no local path, worktree, session or ticket. */
test('the checklist names no local path, worktree, session or ticket', () => {
  const text = doc();
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
