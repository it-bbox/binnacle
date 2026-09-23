import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The files of one version of a checkout, read-only: the working tree as it is now, or a
 * commit (`commitTree` in the Git adapter). Paths are relative to the project directory
 * and use `/`. A readable file is text; nothing here is binary.
 */
export type Tree = {
  /** The entries of a directory, or null when there is no directory there. */
  list(path: string): Promise<TreeEntry[] | null>;
  /** A file's text, or null when there is no file there. */
  read(path: string): Promise<string | null>;
};

export type TreeEntry = { name: string; directory: boolean };

/** Nothing at all: the version before the first commit. */
export const EMPTY_TREE: Tree = { list: async () => null, read: async () => null };

export function workingTree(root: string): Tree {
  return {
    list: async (path) =>
      absentAsNull(() => readdirSync(join(root, path), { withFileTypes: true }).map((entry) => ({ name: entry.name, directory: entry.isDirectory() }))),
    read: async (path) => absentAsNull(() => readFileSync(join(root, path), 'utf8')),
  };
}

/** Null for a file or directory that is not there; anything else is thrown. */
function absentAsNull<T>(read: () => T): T | null {
  try {
    return read();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR') return null;
    throw error;
  }
}
