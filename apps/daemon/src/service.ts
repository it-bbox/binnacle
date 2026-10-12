import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logPath, resolveHome } from './home.ts';

/**
 * Autostart (ADR-0043): the user's own service manager starting the daemon at login. This
 * module owns the service, for the CLI and the daemon alike: it renders the definition,
 * reads the installed one back, tells on, off or broken for a home, and runs the manager.
 */
export const SERVICE_NAME = 'binnacle';

export type ServicePlatform = 'linux' | 'darwin' | 'win32';
export type AutostartState = 'on' | 'off' | 'broken';

/** In a comment of every definition Binnacle writes: one without it, it did not. */
const SERVICE_MARK = 'Written by binn daemon autostart; it rewrites this file, so edit nothing here.';

/** The operating system's platform, unless `BINNACLE_SERVICE_PLATFORM` names another, so that tests exercise every platform anywhere. */
export function servicePlatform(env: NodeJS.ProcessEnv = process.env): ServicePlatform {
  const override = env.BINNACLE_SERVICE_PLATFORM?.trim();
  const value = override || process.platform;
  if (value === 'linux' || value === 'darwin' || value === 'win32') return value;
  throw new Error(
    override ? `BINNACLE_SERVICE_PLATFORM must be linux, darwin or win32, got ${JSON.stringify(override)}` : `autostart does not support ${value}`,
  );
}

/** The daemon's entry, the one `binn daemon start` spawns. */
export const daemonEntry = (): string => fileURLToPath(new URL('./bin.ts', import.meta.url));

/** What a definition is rendered from: this Node, the daemon's entry, the home, and the shell's PATH. */
export type ServiceInputs = { node: string; entry: string; home: string; path: string };

export const serviceInputs = (home: string, env: NodeJS.ProcessEnv = process.env): ServiceInputs => ({
  node: process.execPath,
  entry: daemonEntry(),
  home,
  path: env.PATH ?? '',
});

/** Where the definition lives, or null on a platform not supported yet. */
export function definitionPath(platform: ServicePlatform, env: NodeJS.ProcessEnv = process.env): string | null {
  if (platform === 'darwin') return join(homedir(), 'Library', 'LaunchAgents', `${SERVICE_NAME}.plist`);
  if (platform !== 'linux') return null;
  const config = env.XDG_CONFIG_HOME?.trim();
  return join(config ? config : join(homedir(), '.config'), 'systemd', 'user', `${SERVICE_NAME}.service`);
}

/** The definition for `platform`, rendered from the current inputs. */
export const renderDefinition = (platform: ServicePlatform, inputs: ServiceInputs): string =>
  platform === 'darwin' ? renderPlist(inputs) : renderUnit(inputs);

/** The systemd user unit: the daemon in the foreground, restarted when it fails, started with the user's manager. */
function renderUnit({ node, entry, home, path }: ServiceInputs): string {
  return [
    `# ${SERVICE_MARK}`,
    '[Unit]',
    'Description=Binnacle daemon',
    '',
    '[Service]',
    `ExecStart=${quote(node, true)} ${quote(entry, true)}`,
    `Environment=${quote(`BINNACLE_HOME=${home}`)}`,
    `Environment=${quote(`PATH=${path}`)}`,
    'Restart=on-failure',
    '',
    '[Install]',
    'WantedBy=default.target',
    '',
  ].join('\n');
}

/**
 * The LaunchAgent: the daemon run at load, kept alive when it exits unsuccessfully, its output in
 * the home's log, since launchd keeps none.
 */
function renderPlist({ node, entry, home, path }: ServiceInputs): string {
  const string = (value: string): string => `<string>${xml(value)}</string>`;
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    `<!-- ${SERVICE_MARK} -->`,
    '<plist version="1.0">',
    '<dict>',
    '  <key>Label</key>',
    `  ${string(SERVICE_NAME)}`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    `    ${string(node)}`,
    `    ${string(entry)}`,
    '  </array>',
    '  <key>EnvironmentVariables</key>',
    '  <dict>',
    '    <key>BINNACLE_HOME</key>',
    `    ${string(home)}`,
    '    <key>PATH</key>',
    `    ${string(path)}`,
    '  </dict>',
    '  <key>RunAtLoad</key>',
    '  <true/>',
    '  <key>KeepAlive</key>',
    '  <dict>',
    '    <key>SuccessfulExit</key>',
    '    <false/>',
    '  </dict>',
    '  <key>StandardOutPath</key>',
    `  ${string(logPath(home))}`,
    '  <key>StandardErrorPath</key>',
    `  ${string(logPath(home))}`,
    '</dict>',
    '</plist>',
    '',
  ].join('\n');
}

/** The installed definition, read back: whether Binnacle wrote it, what it starts, and for which home. */
export type InstalledService = { text: string; ours: boolean; node: string | null; entry: string | null; home: string };

export function readInstalled(platform: ServicePlatform, path: string): InstalledService | null {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  const { node, entry, named } = platform === 'darwin' ? readPlist(text) : readUnit(text);
  // A definition written by hand may name no home: the daemon then serves the default one.
  const home = named ? resolve(named) : resolveHome({});
  return { text, ours: text.includes(SERVICE_MARK), node, entry, home };
}

type Read = { node: string | null; entry: string | null; named: string | undefined };

function readUnit(text: string): Read {
  const [node = null, entry = null] = words(text.match(/^ExecStart=(.*)$/m)?.[1] ?? '', true);
  const environment = [...text.matchAll(/^Environment=(.*)$/gm)].flatMap(([, line]) => words(line ?? ''));
  const named = environment.find((pair) => pair.startsWith('BINNACLE_HOME='))?.slice('BINNACLE_HOME='.length);
  return { node, entry, named };
}

function readPlist(text: string): Read {
  const args = text.match(/<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ?? '';
  const [node = null, entry = null] = [...args.matchAll(/<string>([^<]*)<\/string>/g)].map(([, value]) => unxml(value ?? ''));
  const named = text.match(/<key>BINNACLE_HOME<\/key>\s*<string>([^<]*)<\/string>/)?.[1];
  return { node, entry, named: named === undefined ? undefined : unxml(named) };
}

export type Autostart = {
  state: AutostartState;
  platform: ServicePlatform;
  /** The home asked about. */
  home: string;
  /** The definition's path, null on a platform not supported yet. */
  path: string | null;
  /** The home the installed service serves, when one is installed, whichever home that is. */
  serves: string | null;
  /** What a broken service points at that no longer exists. */
  missing: string[];
};

/** On, off or broken for `home`: a service installed for another home is off for this one. */
export function readAutostart(home: string, env: NodeJS.ProcessEnv = process.env): Autostart {
  const platform = servicePlatform(env);
  const path = definitionPath(platform, env);
  const installed = path ? readInstalled(platform, path) : null;
  const off: Autostart = { state: 'off', platform, home, path, serves: installed?.home ?? null, missing: [] };
  if (!installed || installed.home !== home) return off;
  const missing = [installed.node, installed.entry].map((file) => file ?? '(no command)').filter((file) => !existsSync(file));
  return { ...off, state: missing.length > 0 ? 'broken' : 'on', missing };
}

/** The command that changes autostart from `state`: off when on, on when off, and on again to repair a broken one. */
export const autostartCommand = (state: AutostartState): string => `binn daemon autostart ${state === 'on' ? 'off' : 'on'}`;

export type ManagerResult = { ok: true } | { ok: false; message: string };

/** Runs the service manager once, synchronously; a refusal carries what it printed. */
export function runManager(command: string, args: string[]): ManagerResult {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.error) {
    const missing = (result.error as NodeJS.ErrnoException).code === 'ENOENT';
    return { ok: false, message: missing ? `${command} was not found on PATH` : result.error.message };
  }
  if (result.status === 0) return { ok: true };
  return { ok: false, message: result.stderr.trim() || result.stdout.trim() || `exit ${result.status ?? result.signal}` };
}

/**
 * One systemd value, double-quoted: backslashes and quotes escaped, `%` specifiers escaped,
 * and, on a command line, `$` too, which systemd would expand there.
 */
function quote(value: string, command = false): string {
  let escaped = value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('%', '%%');
  if (command) escaped = escaped.replaceAll('$', '$$$$');
  return `"${escaped}"`;
}

const xml = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const unxml = (value: string): string =>
  value.replace(/&(lt|gt|quot|apos|amp);/g, (_, name: string) => ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[name] ?? '');

/** A systemd line's words, as `quote` writes them or as a human writes them unquoted. */
function words(line: string, command = false): string[] {
  return [...line.matchAll(/"((?:[^"\\]|\\.)*)"|(\S+)/g)].map(([, quoted, bare]) => {
    const word = (quoted ?? bare ?? '').replace(/\\(.)/g, '$1').replaceAll('%%', '%');
    return command ? word.replaceAll('$$', '$') : word;
  });
}
