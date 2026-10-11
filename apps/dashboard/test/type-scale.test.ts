import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * The dashboard's type scale (`docs/specs/dashboard-redesign/spec.md`, *The type scale*): body
 * 16 px, secondary 14 px, and no text below 13 px, Nuxt UI's components included. `main.css`
 * declares the scale once, on Tailwind's `xs`, `sm` and `base`; every page takes its sizes from
 * it. Whether a page reads well is the owner's check; this one holds the sources to the scale.
 */

const FLOOR = 13;
const app = new URL('../app/', import.meta.url);
const sources = readdirSync(app, { recursive: true, encoding: 'utf8' })
  .filter((path) => /\.(vue|ts|css)$/.test(path))
  .map((path) => ({ path, text: readFileSync(new URL(path, app), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));
const stylesheet = sources.find((source) => source.path.endsWith('main.css'))?.text ?? '';

/** A length in pixels; `rem` and `em` against the browser's 16 px. */
const pixels = (value: string, unit: string): number => (unit === 'px' ? Number(value) : Number(value) * 16);

/** Every literal text size written in the sources: Tailwind's arbitrary sizes, CSS `font-size` and the theme's `--text-*`. */
const sizes = sources.flatMap(({ path, text }) =>
  [
    ...text.matchAll(/text-\[(?:length:)?([\d.]+)(px|rem|em)\]/g),
    ...text.matchAll(/font-size:\s*([\d.]+)(px|rem|em)/g),
    ...text.matchAll(/--text-[a-z0-9]+:\s*([\d.]+)(px|rem|em)/g),
  ].map((match) => ({ path, written: match[0], px: pixels(match[1]!, match[2]!) })),
);

describe("the dashboard's type scale", () => {
  it('is declared once: 13 px at its floor, 14 px for secondary text and 16 px for the body', () => {
    const theme = /@theme\s*\{([^}]*)\}/.exec(stylesheet)?.[1] ?? '';
    const step = (name: string): number | undefined => {
      const match = new RegExp(`--text-${name}:\\s*([\\d.]+)(px|rem)`).exec(theme);
      return match ? pixels(match[1]!, match[2]!) : undefined;
    };
    assert.equal(step('xs'), 13, 'Tailwind would leave text-xs, its smallest step and Nuxt UI’s, at 12 px');
    assert.equal(step('sm'), 14);
    assert.equal(step('base'), 16);
    assert.match(stylesheet, /body\s*\{[^}]*font-size:\s*var\(--text-base\)/, 'the body reads at the scale’s base');
  });

  it('writes no text size below 13 px', () => {
    const small = sizes.filter((size) => size.px < FLOOR).map((size) => `${size.path}: ${size.written}`);
    assert.deepEqual(small, []);
  });

  it('writes every text size as a step of the scale, never an arbitrary one', () => {
    const arbitrary = sizes.filter((size) => !size.written.startsWith('--text-')).map((size) => `${size.path}: ${size.written}`);
    assert.deepEqual(arbitrary, []);
  });

  it("lifts Nuxt UI's small badges, 8 and 10 px of its own, to the floor", () => {
    const config = sources.find((source) => source.path === 'app.config.ts')?.text ?? '';
    const badge = /\bbadge:\s*\{([\s\S]*?)\n {4}\},/.exec(config)?.[1] ?? '';
    for (const size of ['xs', 'sm']) assert.match(badge, new RegExp(`\\b${size}:\\s*\\{\\s*base:\\s*'[^']*\\btext-xs\\b`), `badge size ${size}`);
  });
});
