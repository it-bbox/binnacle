import { accessSync, constants, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { type ProjectManifest } from '@binnacle/core';
import { readManifest } from '@binnacle/daemon';

/**
 * The Standard setup's tools (ADR-0035), as `binn init` and `binn audit` both read them.
 * Supporting another tool is adding a row; another way to detect or install one is a column.
 */
export type Tool = {
  /** The tool's key under `capabilities` in the manifest. */
  name: string;
  title: string;
  /** Repository files whose presence shows the tool configured, for the audit. */
  files: string[];
  /** The executable that shows it installed, and is the only name taken for it. */
  executable?: string;
  /** How init installs it: an executable it needs first, and the command, run only after the plan's yes. */
  install?: { prerequisite: Prerequisite; command: string[] };
};

/** An executable an install runs through, which init never installs itself: it says `how` instead. */
type Prerequisite = { executable: string; how: string };

// From each tool's own installation docs, read through Context7 on 2026-10-02. No installer script: package managers only.
const UV: Prerequisite = {
  executable: 'uv',
  how: '`pipx install uv`, `brew install uv` or `winget install --id=astral-sh.uv -e` (https://docs.astral.sh/uv/getting-started/installation/)',
};
const NPM: Prerequisite = { executable: 'npm', how: 'installing Node.js, which ships npm (https://nodejs.org)' };

export const TOOLS: Tool[] = [
  { name: 'serena', title: 'Serena', files: ['.serena/project.yml'], executable: 'serena', install: { prerequisite: UV, command: ['uv', 'tool', 'install', '-p', '3.13', 'serena-agent'] } },
  { name: 'graphify', title: 'Graphify', files: [], executable: 'graphify', install: { prerequisite: UV, command: ['uv', 'tool', 'install', 'graphifyy'] } },
  { name: 'context7', title: 'Context7', files: [] },
  { name: 'ast_grep', title: 'ast-grep', files: [], executable: 'ast-grep', install: { prerequisite: NPM, command: ['npm', 'i', '@ast-grep/cli', '-g'] } },
];

/** What the manifest declares under `capabilities`; nothing when there is no usable manifest. */
export function declaredCapabilities(root: string): ProjectManifest['capabilities'] {
  try {
    return readManifest(root).manifest.capabilities;
  } catch {
    return {};
  }
}

/** Whether an executable file `name` is on PATH, with Windows' extensions. Nothing is run. */
export function onPath(name: string): boolean {
  const extensions = process.platform === 'win32' ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';') : [''];
  return (process.env.PATH ?? '')
    .split(delimiter)
    .filter(Boolean)
    .some((dir) =>
      extensions.some((extension) => {
        const path = join(dir, name + extension);
        try {
          accessSync(path, constants.X_OK);
          return statSync(path).isFile();
        } catch {
          return false;
        }
      }),
    );
}
