import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * Widgets laid out without gaps (`docs/specs/dashboard-redesign/issues/13-widgets-without-gaps.md`):
 * a row of widgets is a grid of columns, each a stack whose widgets follow one another, and the
 * columns stretch to the row's height, so no widget leaves a hole under it. Down each column, then
 * across, the widgets keep the order `docs/04-telemetry-dashboard.md` lists them in. Whether the
 * page reads well is the owner's check in a browser; this one holds the sources to the layout.
 */

const page = (name: string): string => readFileSync(new URL(`../app/pages/${name}.vue`, import.meta.url), 'utf8');
const widgets = (source: string): string[] => [...source.matchAll(/<Widget\b[^>]*\swidget="([^"]+)"/g)].map((match) => match[1]!);

/** Each grid whose first child is a widget or a column of widgets, with its classes. */
function rows(source: string): { line: string; first: string }[] {
  const lines = source.split('\n').map((line) => line.trim());
  return lines.flatMap((line, index) => {
    const next = lines.slice(index + 1).find((candidate) => candidate !== '' && !candidate.startsWith('<!--')) ?? '';
    return /^<div\b[^>]*\bclass="grid\b/.test(line) && /^<(Widget\b|div class="flex min-w-0 flex-col)/.test(next) ? [{ line, first: next }] : [];
  });
}

const PAGES = {
  index: ['epics', 'ready', 'running', 'attention'],
  usage: ['kinds', 'models', 'tasks', 'derived', 'harnesses'],
  project: ['waiting', 'board', 'epics', 'usage', 'checkout', 'graph', 'decisions', 'ci'],
} as const;

describe('rows of widgets', () => {
  for (const [name, order] of Object.entries(PAGES)) {
    it(`keep the documented order on ${name}.vue`, () => {
      assert.deepEqual(widgets(page(name)), order);
    });

    it(`stretch their columns to the row's height on ${name}.vue`, () => {
      // The board and the epics beside it are ticket 12's, each taking the height its content needs.
      const aligned = rows(page(name)).filter((row) => /\bitems-start\b/.test(row.line) && !row.first.includes('widget="board"'));
      assert.deepEqual(aligned.map((row) => row.line), []);
    });

    it(`stretch the last widget of each column on ${name}.vue`, () => {
      const lines = page(name).split('\n').map((line) => line.trim());
      const columns = lines.filter((line, index) => line.startsWith('<div class="flex min-w-0 flex-col') && /^<(Widget|UCard)\b/.test(lines[index + 1] ?? ''));
      assert.deepEqual(columns.filter((line) => !line.includes('*:last:flex-1')), []);
    });
  }

  it('keep the cost after the harnesses on usage.vue', () => {
    const source = page('usage');
    assert.ok(source.indexOf('t.cost') > source.indexOf('widget="harnesses"'));
  });

  it('let a stretched widget fill its column, its footer at the bottom', () => {
    const frame = readFileSync(new URL('../app/components/Widget.vue', import.meta.url), 'utf8');
    assert.match(frame, /root:\s*'[^']*\bflex flex-col\b/);
    assert.match(frame, /body:\s*'[^']*\bflex-1\b/);
  });
});
