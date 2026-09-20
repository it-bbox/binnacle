import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { OperationError } from './errors.ts';
import { OWNER_ONLY_FILE, registryPath } from './home.ts';

/**
 * The project registry: the list of repository paths registered on this machine.
 *
 * It is a file rather than a table, and deliberately so (ADR-0019). Nothing outside
 * Binnacle records that a user chose to register a path — not Git, not the tracker,
 * not the repository's own manifest — so it cannot be re-derived, and a projection
 * that gets dropped on a schema change is the wrong home for it. The `project` table
 * is a projection of this file and never the record of what is registered.
 */
export const REGISTRY_VERSION = 1;

export type RegistryEntry = {
  path: string;
  registeredAt: string;
};

/**
  * Thrown rather than answered with an empty list: silently losing registrations is the
  * failure to avoid. It carries a code and a repair instruction because the registry is
  * the one canonical file here, and a generic 500 would tell its owner nothing.
  */
export class RegistryUnreadableError extends OperationError {
  constructor(path: string, reason: string) {
    super(
      'registry.unreadable',
      `The Binnacle project registry at ${path} is unreadable (${reason}). Repair or remove the file.`,
      500,
    );
    this.name = 'RegistryUnreadableError';
  }
}

export function readRegistry(home: string): RegistryEntry[] {
  const path = registryPath(home);
  let contents: string;
  try {
    contents = readFileSync(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(contents);
  } catch (error) {
    throw new RegistryUnreadableError(path, (error as Error).message);
  }

  const entries = (parsed as { projects?: unknown })?.projects;
  if (!Array.isArray(entries)) throw new RegistryUnreadableError(path, 'no "projects" array');
  return entries.map((entry) => {
    if (!isEntry(entry)) throw new RegistryUnreadableError(path, 'an entry has no "path"');
    return { path: entry.path, registeredAt: entry.registeredAt };
  });
}

/** Written through a temporary file so that a crash mid-write cannot leave a torn registry. */
export function writeRegistry(home: string, entries: RegistryEntry[]): void {
  const path = registryPath(home);
  const temporary = `${path}.tmp`;
  const document = { version: REGISTRY_VERSION, projects: entries };
  writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, { mode: OWNER_ONLY_FILE });
  renameSync(temporary, path);
}

function isEntry(value: unknown): value is RegistryEntry {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.path === 'string' && typeof candidate.registeredAt === 'string';
}
