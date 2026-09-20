import { readFileSync } from 'node:fs';

/** Reads the version of the package a module belongs to. Both `src/` and a future `dist/` sit one level below it. */
export function packageVersion(moduleUrl: string | URL): string {
  const manifest: unknown = JSON.parse(readFileSync(new URL('../package.json', moduleUrl), 'utf8'));
  const version = (manifest as { version?: unknown }).version;
  return typeof version === 'string' ? version : '0.0.0';
}

export const VERSION = packageVersion(import.meta.url);
