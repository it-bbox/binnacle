import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * Widgets laid out without gaps (`docs/specs/dashboard-redesign/issues/13-widgets-without-gaps.md`):
 * a row of widgets is at most two columns, each a stack whose widgets follow one another, so no
 * widget waits under a taller neighbour's row; and nothing follows the row on its page, so the
 * shorter column leaves no hole above it. Down each column, then across, the widgets keep the
 * order `docs/04-telemetry-dashboard.md` lists them in. Whether the page reads well is the
 * owner's check in a browser; this one holds the sources to the layout.
 */

const page = (name: string): string => readFileSync(new URL(`../app/pages/${name}.vue`, import.meta.url), 'utf8');
const widgets = (source: string): string[] => [...source.matchAll(/<Widget\b[^>]*\swidget="([^"]+)"/g)].map((match) => match[1]!);
const indent = (line: string): number => line.length - line.trimStart().length;

/** Each grid whose first child is a widget or a column of widgets: its direct children and the line after it closes. */
function rows(source: string): { line: string; children: string[]; after: string }[] {
  const lines = source.split('\n');
  const open = (line: string): boolean => line.trim() !== '' && !line.trim().startsWith('<!--');
  return lines.flatMap((line, index) => {
    const first = lines.slice(index + 1).find(open)?.trim() ?? '';
    if (!/^<div\b[^>]*\bclass="grid\b/.test(line.trim()) || !/^<(Widget\b|div class="flex min-w-0 flex-col)/.test(first)) return [];
    const end = lines.findIndex((candidate, at) => at > index && indent(candidate) === indent(line) && candidate.trim() === '</div>');
    const children = lines.slice(index + 1, end).filter((child) => indent(child) === indent(line) + 2 && /^<[A-Za-z]/.test(child.trim()));
    return [{ line: line.trim(), children: children.map((child) => child.trim()), after: lines.slice(end + 1).find(open)?.trim() ?? '' }];
  });
}

const PAGES = {
  index: ['epics', 'ready', 'running', 'attention'],
  usage: ['kinds', 'models', 'tasks', 'derived', 'harnesses'],
  project: ['waiting', 'board', 'epics', 'usage', 'checkout', 'graph', 'decisions', 'ci'],
} as const;

describe('rows of widgets', () => {
  for (const [name, order] of Object.entries(PAGES)) {
    // The board and the epics beside it are ticket 12's.
    const own = (): ReturnType<typeof rows> => rows(page(name)).filter((row) => !row.children[0]!.includes('widget="board"'));

    it(`keep the documented order on ${name}.vue`, () => {
      assert.deepEqual(widgets(page(name)), order);
    });

    it(`are at most two columns, never wrapping into a second row, on ${name}.vue`, () => {
      assert.ok(own().length > 0);
      for (const row of own()) assert.ok(row.children.length <= 2, `${row.line}: ${row.children.length} children`);
    });

    it(`leave nothing under them on ${name}.vue`, () => {
      for (const row of own()) assert.match(row.after, /^<\//, `${row.line} is followed by ${row.after}`);
    });
  }

  it('keep the Usage line last on the Overview, under Attention', () => {
    const source = page('index');
    assert.ok(source.indexOf("path: '/usage'") > source.indexOf('widget="attention"'));
  });

  it('keep the cost last on the Usage page, after the harnesses', () => {
    const source = page('usage');
    assert.ok(source.indexOf('t.cost') > source.indexOf('widget="harnesses"'));
  });
});
