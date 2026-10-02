import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { type Finding } from '@binnacle/core';
import { MANIFEST_RELATIVE, readManifest, resolveArtifactRoots } from '@binnacle/daemon';
import { sessionHistory } from './history.ts';

/**
 * The capabilities and telemetry-readiness areas of `binn audit`. They read configuration
 * files and count session files, and nothing else: no process, no network, no write, no
 * message content.
 */

const TOOLS = [
  { name: 'serena', title: 'Serena', files: ['.serena/project.yml'] },
  { name: 'graphify', title: 'Graphify', files: [] },
  { name: 'context7', title: 'Context7', files: [] },
];

/** Where an MCP server is registered, and how its name is found: a JSON `mcpServers` key, a TOML `[mcp_servers.<name>]` table, or the name as a key in opencode's file. */
type Source = { file: string; names(text: string, root: string): string[] };

const jsonServers = (text: string, root: string): string[] => {
  const json = JSON.parse(text) as { mcpServers?: object; projects?: Record<string, { mcpServers?: object }> };
  return [...Object.keys(json.mcpServers ?? {}), ...Object.keys(json.projects?.[root]?.mcpServers ?? {})];
};
const tomlServers = (text: string): string[] => [...text.matchAll(/^\s*\[mcp_servers\.["']?([^\]."']+)/gm)].map((match) => match[1]!);
// ponytail: opencode's file may be JSONC, so its keys are read from the text after `"mcp"` and not parsed; a parser if that misreads a real file.
const opencodeServers = (text: string): string[] => [...text.slice(Math.max(text.indexOf('"mcp"'), 0)).matchAll(/"([^"]+)"\s*:/g)].map((match) => match[1]!);

/** A path under the home directory written with `~`, as a person would say it. */
const tilde = (path: string): string => (path.startsWith(`${homedir()}/`) ? `~${path.slice(homedir().length)}` : path);

/** The user-scope files only where a harness defines one: Claude Code's `.claude.json` and Codex's `config.toml`. */
function sources(): { repository: Source[]; user: Source[] } {
  const claude = process.env.CLAUDE_CONFIG_DIR?.trim() || homedir();
  const codex = process.env.CODEX_HOME?.trim() || join(homedir(), '.codex');
  return {
    repository: [
      { file: '.mcp.json', names: jsonServers },
      { file: '.codex/config.toml', names: tomlServers },
      { file: 'opencode.json', names: opencodeServers },
      { file: 'opencode.jsonc', names: opencodeServers },
    ],
    user: [
      { file: join(claude, '.claude.json'), names: jsonServers },
      { file: join(codex, 'config.toml'), names: tomlServers },
    ],
  };
}

/** The file in `places` that registers `name`, or null. A file that cannot be read or parsed registers nothing. */
function registeredIn(places: Source[], base: string | null, root: string, name: string): string | null {
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

/** Serena, Graphify and Context7: the repository's declaration first, then its configuration files, then the user-scope ones. Nothing found is `unknown`: the tool may be configured elsewhere. */
export function capabilities(root: string): Finding[] {
  const area = 'capabilities';
  let declared: Record<string, boolean | 'optional'> = {};
  try {
    declared = readManifest(root).manifest.capabilities;
  } catch {
    // No usable manifest: nothing is declared.
  }
  const { repository, user } = sources();

  return TOOLS.map(({ name, title, files }): Finding => {
    const code = `capabilities.${name}`;
    const declaration = declared[name];
    if (declaration !== undefined) {
      const what = declaration === true ? 'is installed' : declaration === 'optional' ? 'is optional' : 'is not used';
      return { code, area, status: 'ok', reason: `${MANIFEST_RELATIVE} declares that ${title} ${what}. The declaration is taken as it stands.` };
    }
    const found = files.find((file) => existsSync(join(root, file))) ?? registeredIn(repository, root, root, name) ?? registeredIn(user, null, root, name);
    if (found) return { code, area, status: 'ok', reason: `${title} looks configured: found in ${found}.` };
    const looked = [MANIFEST_RELATIVE, ...files, ...repository.map(({ file }) => file)].join(', ');
    return {
      code,
      area,
      status: 'unknown',
      reason: `No ${title} configuration found in ${looked} (repository), or ${user.map(({ file }) => tilde(file)).join(', ')} (user scope). It may be configured somewhere else.`,
      recommendation: `If an agent here should reach ${title}, declare it under capabilities in ${MANIFEST_RELATIVE}.`,
    };
  });
}

/** Whether the session artifacts Binnacle reads exist for this repository, by counting the sessions; no message is read for anything but where and when a session started. */
export async function telemetry(root: string): Promise<Finding[]> {
  const area = 'telemetry';
  const roots = resolveArtifactRoots();
  const where: Record<string, { code: string; root: string; env: string }> = {
    'Claude Code': { code: 'telemetry.claude_code', root: roots.claudeCode, env: 'CLAUDE_CONFIG_DIR' },
    Codex: { code: 'telemetry.codex', root: roots.codex, env: 'CODEX_HOME' },
  };
  return (await sessionHistory(root)).map(({ name, sessions }): Finding => {
    const { code, root: looked, env } = where[name]!;
    if (sessions > 0) return { code, area, status: 'ok', reason: `${sessions} ${name} session${sessions === 1 ? '' : 's'} for this repository under ${tilde(looked)}, so usage could be attributed.` };
    return {
      code,
      area,
      status: 'unknown',
      reason: `No sessions for this repository under ${tilde(looked)}. No work has been recorded yet, or ${name} keeps its sessions elsewhere.`,
      recommendation: `Nothing to do for a new project. If ${name} keeps its sessions elsewhere, point ${env} at them.`,
    };
  });
}
