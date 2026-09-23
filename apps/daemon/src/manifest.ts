import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MANIFEST_VERSION, validateManifest, type ManifestProblem, type ProjectManifest } from '@binnacle/core';
import { parse } from 'yaml';
import { OperationError, pathNotFound } from './errors.ts';

/**
 * The file side of the manifest: find it, read it, parse the YAML. Deciding whether
 * what came back is a usable manifest is `@binnacle/core`'s pure function, which is
 * where the field paths and the forward-compatible warnings come from.
 */
export const MANIFEST_RELATIVE = join('.binnacle', 'project.yaml');
export const MANIFEST_TEMPLATE = 'templates/project/project.yaml.example';

export const manifestPath = (root: string): string => join(root, MANIFEST_RELATIVE);

export type ReadManifest = {
  manifest: ProjectManifest;
  /** Unknown keys and the like: reported, never fatal. */
  warnings: ManifestProblem[];
};

export function readManifest(root: string): ReadManifest {
  const path = manifestPath(root);

  let contents: string;
  try {
    contents = readFileSync(path, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      // Only on the failure path, so a readable manifest costs no extra stat. A registered
      // repository that has disappeared is not one that lacks a manifest.
      if (!existsSync(root)) throw pathNotFound(root);
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
    throw new OperationError('manifest.invalid', `${path} is not valid YAML.`, 400, [
      { path: '(document)', message: (error as Error).message },
    ]);
  }

  const validation = validateManifest(document);

  // An unsupported version is its own answer rather than one problem among many: every
  // other field was read against rules that may simply not apply to that version. A
  // document that is not a mapping has no version at all, and `null` says so — reporting
  // one there would name a field the user never wrote instead of what is actually wrong.
  if (validation.versionSupported === false) {
    throw new OperationError(
      'manifest.unsupported_version',
      `${path} does not declare version ${MANIFEST_VERSION}, which is the version this Binnacle supports.`,
      400,
      validation.problems.filter((problem) => problem.path === 'version'),
    );
  }

  if (!validation.manifest) {
    throw new OperationError(
      'manifest.invalid',
      `${path} has ${validation.problems.length} problem${validation.problems.length === 1 ? '' : 's'}.`,
      400,
      validation.problems,
    );
  }

  return { manifest: validation.manifest, warnings: validation.warnings };
}
