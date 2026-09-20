import { readManifest } from './manifest.ts';
import { readRegistry, type RegistryEntry } from './registry.ts';
import type { ProjectRow, Store } from './store.ts';

/**
 * Re-derives the `project` projection from the registry file and each repository's
 * own manifest. This is the ADR-0015 rule executed: the projection is something the
 * daemon can throw away and rebuild, and the registry file is what it rebuilds from.
 */
export function projectRegistry(home: string, store: Store): void {
  const entries = readRegistry(home);
  for (const entry of entries) store.putProject(deriveProject(entry));
  store.dropProjectsExcept(entries.map((entry) => entry.path));
}

/**
 * A registered repository whose manifest cannot be read stays registered and says why.
 * Its id is null rather than guessed from the directory name — an id is read from the
 * manifest or it is not known.
 */
export function deriveProject(entry: RegistryEntry): ProjectRow {
  try {
    const manifest = readManifest(entry.path);
    return {
      path: entry.path,
      id: manifest.id,
      name: manifest.name,
      registeredAt: entry.registeredAt,
      unavailable: null,
    };
  } catch (error) {
    return {
      path: entry.path,
      id: null,
      name: null,
      registeredAt: entry.registeredAt,
      unavailable: (error as Error).message,
    };
  }
}
