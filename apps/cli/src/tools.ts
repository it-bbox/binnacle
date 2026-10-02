import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { type ProjectManifest } from '@binnacle/core';
import { GRAPH_DIRECTORY, readManifest } from '@binnacle/daemon';

/**
 * The Standard setup's tools (ADR-0035), as `binn init` and `binn audit` both read them.
 * Supporting another tool is adding a row; another way to detect or install one is a column.
 */
export type Tool = {
  /** The tool's key under `capabilities` in the manifest, and the name its MCP server is registered under. */
  name: string;
  title: string;
  /** Repository files whose presence shows the tool configured, for the audit. */
  files: string[];
  /** The executable that shows it installed, and is the only name taken for it. */
  executable?: string;
  /** An executable its install or its server runs through, which init never installs itself: it says `how` instead. */
  prerequisite?: Prerequisite;
  /** The command init installs it with, run only after the plan's yes. */
  install?: string[];
  /**
   * Its MCP server: the command that starts it, for the harness whose executable is given
   * (ADR-0035). `project`: it serves this project only, so it is registered per project.
   */
  server?: { command(harness: string, root: string): string[]; project?: boolean };
};

type Prerequisite = { executable: string; how: string };

// From each tool's own installation docs, read through Context7 on 2026-10-02. No installer script: package managers only.
const UV: Prerequisite = {
  executable: 'uv',
  how: '`pipx install uv`, `brew install uv` or `winget install --id=astral-sh.uv -e` (https://docs.astral.sh/uv/getting-started/installation/)',
};
const NPM: Prerequisite = { executable: 'npm', how: 'installing Node.js, which ships npm (https://nodejs.org)' };

/** Serena's context per harness, from its client docs; a harness it documents none for gets the project from the working directory only. */
const SERENA_CONTEXT: Record<string, string[]> = {
  claude: ['--context', 'claude-code', '--project-from-cwd'],
  codex: ['--context=codex', '--project-from-cwd'],
  code: ['--context=vscode'],
};

export const TOOLS: Tool[] = [
  {
    name: 'serena',
    title: 'Serena',
    files: ['.serena/project.yml'],
    executable: 'serena',
    prerequisite: UV,
    install: ['uv', 'tool', 'install', '-p', '3.13', 'serena-agent'],
    server: { command: (harness) => ['serena', 'start-mcp-server', ...(SERENA_CONTEXT[harness] ?? ['--project-from-cwd'])] },
  },
  {
    name: 'graphify',
    title: 'Graphify',
    files: [],
    executable: 'graphify',
    prerequisite: UV,
    install: ['uv', 'tool', 'install', 'graphifyy'],
    // Its server needs the `mcp` extra, which the installed tool lacks; `uv run` provides it, outside any project's Python environment.
    server: {
      project: true,
      command: (_harness, root) => ['uv', 'run', '--no-project', '--with', 'graphifyy[mcp]', 'python', '-m', 'graphify.serve', join(root, GRAPH_DIRECTORY, 'graph.json')],
    },
  },
  { name: 'context7', title: 'Context7', files: [], prerequisite: NPM, server: { command: () => ['npx', '-y', '@upstash/context7-mcp'] } },
  { name: 'ast_grep', title: 'ast-grep', files: [], executable: 'ast-grep', prerequisite: NPM, install: ['npm', 'i', '@ast-grep/cli', '-g'] },
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

/**
 * Where a harness registers an MCP server, and how its name is found: a JSON `mcpServers` or
 * `servers` key (top level, or under this project in Claude Code's user file), a TOML
 * `[mcp_servers.<name>]` table, or the name as a key in opencode's file. `harness` is the
 * harness's executable.
 */
export type Source = { harness: string; file: string; names(text: string, root: string): string[] };

const jsonServers = (text: string, root: string): string[] => {
  const json = JSON.parse(text) as { mcpServers?: object; servers?: object; projects?: Record<string, { mcpServers?: object }> };
  return [...Object.keys(json.mcpServers ?? {}), ...Object.keys(json.servers ?? {}), ...Object.keys(json.projects?.[root]?.mcpServers ?? {})];
};
const tomlServers = (text: string): string[] => [...text.matchAll(/^\s*\[mcp_servers\.["']?([^\]."']+)/gm)].map((match) => match[1]!);
// ponytail: opencode's file may be JSONC, so its keys are read from the text after `"mcp"` and not parsed; a parser if that misreads a real file.
const opencodeServers = (text: string): string[] => [...text.slice(Math.max(text.indexOf('"mcp"'), 0)).matchAll(/"([^"]+)"\s*:/g)].map((match) => match[1]!);

/** Where VS Code keeps its user configuration on this platform. */
export const VSCODE_USER_DIRECTORY =
  process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Application Support', 'Code')
    : process.platform === 'win32'
      ? join(homedir(), 'AppData', 'Roaming', 'Code')
      : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'Code');

/**
 * The files the harnesses register MCP servers in: the repository's, relative to it, and the
 * user-scope ones only where a harness defines one: Claude Code's `.claude.json`, Codex's
 * `config.toml` and VS Code's default profile's `mcp.json`.
 * ponytail: VS Code's default profile only; a profile of its own keeps its `mcp.json` elsewhere.
 */
export function mcpSources(): { repository: Source[]; user: Source[] } {
  const claude = process.env.CLAUDE_CONFIG_DIR?.trim() || homedir();
  const codex = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex');
  return {
    repository: [
      { harness: 'claude', file: '.mcp.json', names: jsonServers },
      { harness: 'codex', file: '.codex/config.toml', names: tomlServers },
      { harness: 'opencode', file: 'opencode.json', names: opencodeServers },
      { harness: 'opencode', file: 'opencode.jsonc', names: opencodeServers },
      { harness: 'code', file: '.vscode/mcp.json', names: jsonServers },
    ],
    user: [
      { harness: 'claude', file: join(claude, '.claude.json'), names: jsonServers },
      { harness: 'codex', file: join(codex, 'config.toml'), names: tomlServers },
      { harness: 'code', file: join(VSCODE_USER_DIRECTORY, 'User', 'mcp.json'), names: jsonServers },
    ],
  };
}

/** The file in `places` that registers `name`, or null; `base` is the directory relative files are in. A file that cannot be read or parsed registers nothing. */
export function registeredIn(places: Source[], base: string | null, root: string, name: string): string | null {
  for (const { file, names } of places) {
    try {
      const text = readFileSync(base === null ? file : join(base, file), 'utf8');
      if (names(text, root).some((registered) => registered.toLowerCase() === name)) return file;
    } catch {
      // Absent, unreadable or not what it should be: no registration there.
    }
  }
  return null;
}

/** The file, in any scope the audit reads, that registers `name` with the harness whose executable is `harness`, or null. */
export function registeredWith(harness: string, root: string, name: string): string | null {
  const { repository, user } = mcpSources();
  const mine = ({ harness: owner }: Source): boolean => owner === harness;
  return registeredIn(repository.filter(mine), root, root, name) ?? registeredIn(user.filter(mine), null, root, name);
}
