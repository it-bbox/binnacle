import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { OperationError } from './errors.ts';

/**
 * Reads `.binnacle/project.yaml` as far as registration needs it: the manifest version
 * and the project's identity. The full validation surface — every problem reported in
 * one pass, with field paths and forward-compatible warnings — is ticket 03, and it
 * takes this over rather than sitting beside it.
 */
export const MANIFEST_VERSION = 1;
export const MANIFEST_RELATIVE = join('.binnacle', 'project.yaml');
export const MANIFEST_TEMPLATE = 'templates/project/project.yaml.example';

export const manifestPath = (root: string): string => join(root, MANIFEST_RELATIVE);

export type ManifestIdentity = {
  version: number;
  id: string;
  name: string | null;
};

export function readManifest(root: string): ManifestIdentity {
  const path = manifestPath(root);

  let contents: string;
  try {
    contents = readFileSync(path, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      throw new OperationError(
        'manifest.missing',
        `No ${MANIFEST_RELATIVE} in ${root}. Start one from ${MANIFEST_TEMPLATE}.`,
        400,
      );
    }
    throw error;
  }

  let document: unknown;
  try {
    document = parse(contents);
  } catch (error) {
    throw new OperationError('manifest.invalid', `${path} is not valid YAML: ${(error as Error).message}`, 400);
  }
  if (typeof document !== 'object' || document === null || Array.isArray(document)) {
    throw new OperationError('manifest.invalid', `${path} must be a YAML mapping.`, 400);
  }

  const version = (document as { version?: unknown }).version;
  if (version !== MANIFEST_VERSION) {
    throw new OperationError(
      'manifest.unsupported_version',
      `${path} declares version ${JSON.stringify(version ?? null)}; this Binnacle supports version ${MANIFEST_VERSION}.`,
      400,
      [{ path: 'version', message: `expected ${MANIFEST_VERSION}` }],
    );
  }

  const project = (document as { project?: unknown }).project;
  const id = typeof project === 'object' && project !== null ? (project as { id?: unknown }).id : undefined;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new OperationError('manifest.invalid', `${path} declares no project id.`, 400, [
      { path: 'project.id', message: 'expected a non-empty string' },
    ]);
  }

  const name = (project as { name?: unknown }).name;
  return { version, id: id.trim(), name: typeof name === 'string' && name.trim() ? name.trim() : null };
}
