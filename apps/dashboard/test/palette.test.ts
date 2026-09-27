import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * The dashboard's colours are the mockup's tokens, in light and in dark (ticket 08 of
 * `docs/specs/dashboard-design-and-languages`). Whether a page looks like the mockup is the
 * owner's check; this one holds the stylesheet's values to the mockup's.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const mockup = read('../../../docs/specs/dashboard-design-and-languages/design/Binnacle Dashboard.dc.html');
const stylesheet = read('../app/assets/css/main.css');

const declarations = (source: string, block: RegExp): Map<string, string> => {
  const body = block.exec(source)?.[1];
  assert.ok(body !== undefined, `no block matches ${block}`);
  return new Map(
    body
      .split(';')
      .map((declaration) => declaration.split(/:(.*)/s).map((part) => part.trim()))
      .filter((pair): pair is [string, string] => pair[0]?.startsWith('--') === true && pair[1] !== undefined),
  );
};

const TOKENS = [
  'bg', 'rail', 'sidebar', 'panel', 'code-bg', 'hover', 'chip', 'border', 'border-strong', 'text', 'muted', 'faint',
  'accent', 'on-accent', 'warn', 'warn-soft', 'warn-line', 'warn-text', 'ok', 'err-text', 'err-soft',
].map((name) => `--${name}`);

const themes = [
  { theme: 'light', mockup: /^:root\{(--sans[^}]*)\}/m, stylesheet: /:root,\s*\.light\s*\{([^}]*)\}/ },
  { theme: 'dark', mockup: /prefers-color-scheme:dark\)\{:root\{([^}]*)\}/, stylesheet: /\.dark\s*\{([^}]*)\}/ },
];

describe("the dashboard's palette", () => {
  for (const theme of themes) {
    it(`declares the mockup's tokens with the mockup's values, in ${theme.theme}`, () => {
      const expected = declarations(mockup, theme.mockup);
      const actual = declarations(stylesheet, theme.stylesheet);
      for (const token of TOKENS) {
        assert.ok(expected.has(token), `the mockup has no ${token} in ${theme.theme}`);
        assert.equal(actual.get(token), expected.get(token), `${token} in ${theme.theme}`);
      }
    });
  }

  it("takes none of Tailwind's zinc", () => {
    assert.doesNotMatch(stylesheet, /zinc/);
  });
});
