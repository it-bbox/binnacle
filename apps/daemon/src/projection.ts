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
  for (const entry of entries) reproject(store, entry);
  store.dropProjectsExcept(entries.map((entry) => entry.path));
}

/**
 * Re-reads one repository's manifest into the projection, and records a change when the
 * facts moved. A first projection is not a change — there was nothing to differ from —
 * and neither is a re-read that came back identical, so the history stays worth reading.
 */
export function reproject(store: Store, entry: RegistryEntry): ProjectRow {
  const before = store.project(entry.path);
  const row = deriveProject(entry);
  store.putProject(row);

  if (before && differs(before, row)) {
    store.appendEvent({
      type: 'project.manifest_changed',
      projectPath: entry.path,
      payload: { id: row.id, name: row.name, unavailable: row.unavailable },
    });
  }
  return row;
}

const differs = (before: ProjectRow, after: ProjectRow): boolean =>
  before.id !== after.id || before.name !== after.name || before.unavailable !== after.unavailable;

/**
 * A registered repository whose manifest cannot be read stays registered and says why.
 * Its id is null rather than guessed from the directory name — an id is read from the
 * manifest or it is not known.
 */
export function deriveProject(entry: RegistryEntry): ProjectRow {
  try {
    const { manifest } = readManifest(entry.path);
    return {
      path: entry.path,
      id: manifest.project.id,
      name: manifest.project.name,
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
