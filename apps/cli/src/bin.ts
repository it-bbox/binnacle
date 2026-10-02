#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { type ImportWindow } from '@binnacle/core';
import { resolveHome, packageVersion } from '@binnacle/daemon';
import { start, status, stop } from './daemon-commands.ts';
import { list, register, status as projectStatus, unregister } from './project-commands.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { dashboard } from './dashboard.ts';
import { audit } from './audit.ts';
import { importWindow, init } from './init.ts';
import { mcp } from './mcp.ts';

const VERSION = packageVersion(import.meta.url);

const USAGE = `binn — Binnacle, a local AI engineering control plane.

Usage:
  binn init [--window <days|all>] [path]
                        Set up the Git repository containing path (default: the working directory):
                        show the whole plan and ask once before writing; it never overwrites a file
                        and never commits. --window sets the history import window without asking
  binn init --plan --json [--window <days|all>] [path]
                        Print that plan and its id as JSON, writing, running and asking nothing
  binn init --apply <id> [--window <days|all>] [path]
                        Write the plan whose id is <id>, as a confirmed run does, without asking;
                        if the plan is no longer that one, write nothing and exit 3 (init.plan_changed)

  binn audit [path] [--json]
                        Read-only findings on the Git repository containing path: what is in place,
                        what is missing and what cannot be told, each with a recommendation

  binn daemon start     Start the Binnacle daemon on loopback
  binn daemon status    Report whether a daemon is running, and where
  binn daemon stop      Stop the daemon and remove its runtime file

  binn project register [path]    Register a repository (default: the working directory)
  binn project list               List the projects this machine tracks
  binn project status [path]      Manifest facts and live Git facts for the project containing path
  binn project unregister [path]  Remove a registration, changing nothing in the repository

  binn dashboard        Open the dashboard in the default browser, already authorised
  binn dashboard --print  Print the dashboard's address, with the token, without opening it

  binn mcp              Serve Binnacle's MCP tools on stdio for the working directory

Options:
  -h, --help            Show this help
  -v, --version         Show the CLI version

Environment:
  BINNACLE_HOME         Binnacle home directory (default: ~/.binnacle)
  BINNACLE_PORT         Port the daemon binds on loopback (default: 7717; 0 takes an ephemeral port)
  BINNACLE_GIT_TIMEOUT_MS  Longest a single git call may take before Git facts are unavailable (default: 5000)

Exit codes:
  0  success
  2  usage error
  3  operation failed
  4  daemon unreachable
`;

process.exitCode = await run(process.argv.slice(2));

async function run(argv: string[]): Promise<ExitCode> {
  const [first, second, ...rest] = argv;

  if (first === undefined || first === '-h' || first === '--help' || first === 'help') {
    console.log(USAGE);
    return EXIT.ok;
  }
  if (first === '-v' || first === '--version') {
    console.log(VERSION);
    return EXIT.ok;
  }

  if (first === 'daemon' && rest.length === 0) {
    const home = resolveHome();
    if (second === 'start') return await start(home);
    if (second === 'status') return await status(home);
    if (second === 'stop') return await stop(home);
  }

  if (first === 'dashboard' && rest.length === 0 && (second === undefined || second === '--print')) {
    return await dashboard(resolveHome(), second === '--print');
  }

  if (first === 'init') {
    const options = initOptions(argv.slice(1));
    if (options) return await init(resolveHome(), options.path, { plan: options.plan, apply: options.apply, window: options.window });
  }

  if (first === 'audit') {
    const args = argv.slice(1).filter((arg) => arg !== '--json');
    if (args.length <= 1) return await audit(resolveHome(), args[0], argv.includes('--json'));
  }

  if (first === 'mcp' && second === undefined) {
    await mcp(resolveHome(), VERSION);
    return EXIT.ok;
  }

  if (first === 'project') {
    const home = resolveHome();
    const [path, ...extra] = rest;
    if (extra.length === 0) {
      if (second === 'register') return await register(home, path);
      if (second === 'unregister') return await unregister(home, path);
      if (second === 'status') return await projectStatus(home, path);
      if (second === 'list' && path === undefined) return await list(home);
    }
  }

  return usage(argv.join(' '));
}

/**
 * `binn init`'s arguments, or null when they are not its usage: `--plan` and `--json` only together,
 * `--apply` with an id and without them, and a window as the window question takes it, though not empty.
 */
function initOptions(args: string[]): { path: string | undefined; plan: boolean; apply: string | undefined; window: ImportWindow | undefined } | null {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: { plan: { type: 'boolean' }, json: { type: 'boolean' }, apply: { type: 'string' }, window: { type: 'string' } },
    });
    const plan = values.plan === true;
    const apply = values.apply?.trim();
    if (plan !== (values.json === true) || positionals.length > 1) return null;
    if (apply === '' || (plan && apply !== undefined)) return null;
    const window = values.window === undefined ? undefined : values.window.trim() === '' ? null : importWindow(values.window);
    return window === null ? null : { path: positionals[0], plan, apply, window };
  } catch {
    // An unknown option, or --window without its value.
    return null;
  }
}

function usage(command: string): ExitCode {
  console.error(`binn: unknown command ${JSON.stringify(command)}.\n`);
  console.error(USAGE);
  return EXIT.usage;
}
