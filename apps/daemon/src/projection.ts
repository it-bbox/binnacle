import { createHash } from 'node:crypto';
import type { ManifestProblem, ProjectManifest } from '@binnacle/core';
import { OperationError } from './errors.ts';
import { readManifest } from './manifest.ts';
import { readRegistry, type RegistryEntry } from './registry.ts';
import type { ProjectRow, Store } from './store.ts';

/**
 * Re-derives the `project` projection from the registry file and each repository's
 * own manifest. This is the ADR-0015 rule executed: the projection is something the
 * daemon can throw away and rebuild, and the registry file is what it rebuilds from.
 */
export function projectRegistry(home: string, store: Store): Projected[] {
  const entries = readRegistry(home);
  const projected = entries.map((entry) => reproject(store, entry));
  store.dropProjectsExcept(entries.map((entry) => entry.path));
  return projected;
}

/**
 * Re-reads one repository's manifest into the projection, and records a change when the
 * facts moved. A first projection is not a change — there was nothing to differ from —
 * and neither is a re-read that came back identical, so the history stays worth reading.
 */
export function reproject(store: Store, entry: RegistryEntry): Projected {
  const before = store.project(entry.path);
  const projected = deriveProject(entry);
  const { row } = projected;
  store.putProject(row);

  if (before && differs(before, row)) {
    // The payload carries facts, never manifest text. A failure reason can quote the
    // file it came from, and the event table is the tier that is never dropped.
    store.appendEvent({
      type: 'project.manifest_changed',
      projectPath: entry.path,
      payload: { id: row.id, name: row.name, available: row.unavailable === null },
    });
  }
  return projected;
}

/**
 * Compares everything the projection derives from the manifest, by name-independent
 * means: a column added later is compared too, rather than silently stopping the event.
 * The registry owns `path` and `registeredAt`, so neither is a manifest change.
 */
function differs(before: ProjectRow, after: ProjectRow): boolean {
  const facts = ({ path, registeredAt, ...rest }: ProjectRow): string => JSON.stringify(rest);
  return facts(before) !== facts(after);
}

/** The row that is stored, and the manifest it was read from with its warnings, which are not. */
export type Projected = { row: ProjectRow; manifest: ProjectManifest | null; warnings: ManifestProblem[] };

/**
 * A registered repository whose manifest cannot be read stays registered and says why.
 * Its id is null rather than guessed from the directory name — an id is read from the
 * manifest or it is not known. One whose directory is gone says so apart, so that the
 * dashboard can leave it off its pages; the registry keeps it either way.
 */
function deriveProject(entry: RegistryEntry): Projected {
  try {
    const { manifest, warnings } = readManifest(entry.path);
    return {
      row: {
        path: entry.path,
        id: manifest.project.id,
        name: manifest.project.name,
        registeredAt: entry.registeredAt,
        unavailable: null,
        gone: false,
        manifestDigest: digest(manifest),
      },
      manifest,
      warnings,
    };
  } catch (error) {
    return {
      row: {
        path: entry.path,
        id: null,
        name: null,
        registeredAt: entry.registeredAt,
        unavailable: (error as Error).message,
        gone: error instanceof OperationError && error.code === 'project.path_not_found',
        manifestDigest: null,
      },
      manifest: null,
      warnings: [],
    };
  }
}

/**
 * A stable fingerprint of the validated manifest. It is built field by field in a fixed
 * order, so serialising it is deterministic, and it is a hash rather than the content so
 * that nothing from the file is stored where it does not belong.
 */
const digest = (manifest: ProjectManifest): string =>
  createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
