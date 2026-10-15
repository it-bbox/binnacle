import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
   * `prerequisite`: an executable the server runs through, needed even when the tool itself is found.
   */
  server?: { command(harness: string, root: string): string[]; project?: boolean; prerequisite?: Prerequisite };
  /**
   * Its Claude Code plugin, installed through Claude Code's plugin CLI at user scope: `id` as
   * `claude plugin list` names it, the `marketplace` to add first where it is not in Claude
   * Code's official one, and `source`, the repository the `skills` CLI installs it from into
   * every other harness (ADR-0039).
   */
  plugin?: { id: string; marketplace?: string; source: string };
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
      prerequisite: UV,
      command: (_harness, root) => ['uv', 'run', '--no-project', '--with', 'graphifyy[mcp]', 'python', '-m', 'graphify.serve', join(root, GRAPH_DIRECTORY, 'graph.json')],
    },
  },
  { name: 'context7', title: 'Context7', files: [], prerequisite: NPM, server: { command: () => ['npx', '-y', '@upstash/context7-mcp'] } },
  { name: 'ast_grep', title: 'ast-grep', files: [], executable: 'ast-grep', prerequisite: NPM, install: ['npm', 'i', '@ast-grep/cli', '-g', '--allow-scripts=@ast-grep/cli'] },
  // From each plugin's README, read on 2026-10-02: Matt Pocock Skills is in Claude Code's official marketplace, Ponytail is its own.
  {
    name: 'matt_pocock_skills',
    title: 'Matt Pocock Skills',
    files: [],
    plugin: { id: 'mattpocock-skills@claude-plugins-official', source: 'mattpocock/skills' },
  },
  {
    name: 'ponytail',
    title: 'Ponytail',
    files: [],
    plugin: { id: 'ponytail@ponytail', marketplace: 'DietrichGebert/ponytail', source: 'DietrichGebert/ponytail' },
  },
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

/** Where opencode, and VS Code on Linux, keep their user configuration. */
export const CONFIG_HOME = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');

/** Where VS Code keeps its user configuration on this platform. */
export const VSCODE_USER_DIRECTORY =
  process.platform === 'darwin'
    ? join(homedir(), 'Library', 'Application Support', 'Code')
    : process.platform === 'win32'
      ? join(homedir(), 'AppData', 'Roaming', 'Code')
      : join(CONFIG_HOME, 'Code');

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

/** This package's directory, which carries the plugin and the marketplace that lists it (ADR-0027). */
export const PACKAGE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

/** This package's `binnacle-<action>` copy of the plugin's skills, which the `skills` CLI installs into other harnesses (ADR-0039). */
export const SKILLS_COPY = join(PACKAGE_DIR, 'skills');

/** A path under the home directory written with `~`, as a person would say it. */
export const tilde = (path: string): string => (path.startsWith(`${homedir()}/`) ? `~${path.slice(homedir().length)}` : path);

/** Where the `skills` CLI keeps its canonical user-scope copies, which every harness's install points at. */
export const INSTALLED_SKILLS = join(homedir(), '.agents', 'skills');

/**
 * The `version` under a SKILL.md's `metadata`, or null when it has none or cannot be read.
 * ponytail: a textual read that takes `version` as the first key under `metadata`, as the package's build writes it; a YAML parser if another writer reorders it.
 */
function skillVersion(file: string): string | null {
  try {
    return /^metadata:\s*\n\s+version:\s*["']?([^"'\s]+)/m.exec(readFileSync(file, 'utf8'))?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Binnacle's skills as installed in `~/.agents/skills`, against this package's copy: `none` when
 * none of the copy's skills is there, `current` when each is at the copy's version, and `stale`
 * otherwise, with which skills differ or are missing. A `binnacle-*` skill the copy no longer has
 * is not judged.
 */
export function binnacleSkills(): { state: 'none' | 'current' } | { state: 'stale'; reason: string } {
  let skills: string[];
  try {
    skills = readdirSync(SKILLS_COPY).sort();
  } catch {
    return { state: 'none' };
  }
  const differ: string[] = [];
  const missing: string[] = [];
  for (const skill of skills) {
    const file = join(INSTALLED_SKILLS, skill, 'SKILL.md');
    const installed = skillVersion(file);
    if (!existsSync(file)) missing.push(skill);
    else if (installed !== skillVersion(join(SKILLS_COPY, skill, 'SKILL.md'))) differ.push(`${skill} (${installed === null ? 'no version' : `version ${installed}`})`);
  }
  if (missing.length === skills.length) return { state: 'none' };
  if (differ.length === 0 && missing.length === 0) return { state: 'current' };
  // The build gives every skill of the copy the plugin's one version.
  const version = skillVersion(join(SKILLS_COPY, skills[0]!, 'SKILL.md'));
  const parts = [differ.length > 0 ? `${differ.join(', ')} differ from this package's version ${version}` : '', missing.length > 0 ? `${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} missing` : ''];
  return { state: 'stale', reason: parts.filter(Boolean).join(', and ') };
}
