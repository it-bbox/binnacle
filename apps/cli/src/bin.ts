#!/usr/bin/env node
import { resolveHome, packageVersion } from '@binnacle/daemon';
import { start, status, stop } from './daemon-commands.ts';
import { list, register, unregister } from './project-commands.ts';
import { EXIT, type ExitCode } from './exit.ts';

const VERSION = packageVersion(import.meta.url);

const USAGE = `binn — Binnacle, a local AI engineering control plane.

Usage:
  binn daemon start     Start the Binnacle daemon on loopback
  binn daemon status    Report whether a daemon is running, and where
  binn daemon stop      Stop the daemon and remove its runtime file

  binn project register [path]    Register a repository (default: the working directory)
  binn project list               List the projects this machine tracks
  binn project unregister [path]  Remove a registration, changing nothing in the repository

Options:
  -h, --help            Show this help
  -v, --version         Show the CLI version

Environment:
  BINNACLE_HOME         Binnacle home directory (default: ~/.binnacle)
  BINNACLE_PORT         Port the daemon binds on loopback (default: 7717; 0 takes an ephemeral port)

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

  if (first === 'project') {
    const home = resolveHome();
    const [path, ...extra] = rest;
    if (extra.length === 0) {
      if (second === 'register') return await register(home, path);
      if (second === 'unregister') return await unregister(home, path);
      if (second === 'list' && path === undefined) return await list(home);
    }
  }

  return usage(argv.join(' '));
}

function usage(command: string): ExitCode {
  console.error(`binn: unknown command ${JSON.stringify(command)}.\n`);
  console.error(USAGE);
  return EXIT.usage;
}
