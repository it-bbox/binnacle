import { readFileSync } from 'node:fs';

/** Reads the version in the `package.json` one level above `moduleUrl`'s directory: `src/` and the installed package's `bin/` both sit there. */
export function packageVersion(moduleUrl: string | URL): string {
  const manifest: unknown = JSON.parse(readFileSync(new URL('../package.json', moduleUrl), 'utf8'));
  const version = (manifest as { version?: unknown }).version;
  return typeof version === 'string' ? version : '0.0.0';
}

/**
 * The Binnacle that runs: in the bundle, the published package's (one level above `bin/`); in a source
 * checkout, the CLI package's, the one version the release bumps (ADR-0044), never this workspace package's.
 */
export const VERSION = packageVersion(import.meta.url.endsWith('.ts') ? new URL('../../cli/src/', import.meta.url) : import.meta.url);
