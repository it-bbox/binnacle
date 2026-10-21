#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { LANGUAGES, type ImportWindow, type Language } from '@binnacle/core';
import { resolveHome, packageVersion } from '@binnacle/daemon';
import { autostart, start, status, stop } from './daemon-commands.ts';
import { list, register, status as projectStatus, unregister } from './project-commands.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { dashboard } from './dashboard.ts';
import { audit } from './audit.ts';
import { importWindow, init } from './init.ts';
import { toolsHelp } from '@binnacle/mcp';
import { call, mcp } from './mcp.ts';

const VERSION = packageVersion(import.meta.url);

const USAGE = `binn — Binnacle, a local AI engineering control plane.

Usage:
  binn init [--window <days|all>] [--language <en|ru>] [--autostart <yes|no>] [--skip-harness <id>]... [path]
                        Set up the Git repository containing path (default: the working directory):
                        show the whole plan and ask once before writing; it never overwrites a file
                        and never commits. --window sets the history import window without asking;
                        --language answers the repository's documentation language, en or ru;
                        --autostart answers whether the daemon starts at login, where it is asked;
                        --skip-harness keeps Binnacle's skills out of that skills CLI harness id
  binn init --plan --json [--window <days|all>] [--language <en|ru>] [--autostart <yes|no>] [--skip-harness <id>]... [path]
                        Print that plan and its id as JSON, writing, running and asking nothing
  binn init --apply <id> [--window <days|all>] [--language <en|ru>] [--autostart <yes|no>] [--skip-harness <id>]... [path]
                        Write the plan whose id is <id>, as a confirmed run does, without asking;
                        if the plan is no longer that one, write nothing and exit 3 (init.plan_changed)

  binn audit [path] [--json]
                        Read-only findings on the Git repository containing path: what is in place,
                        what is missing and what cannot be told, each with a recommendation

  binn daemon start     Start the Binnacle daemon on loopback
  binn daemon status    Report whether a daemon is running, and where
  binn daemon stop      Stop the daemon and remove its runtime file
  binn daemon autostart [on|off]
                        Turn on or off the daemon's start at login, through your own service manager
                        (a systemd user unit on Linux), or say whether it is on, off or broken

  binn project register [path]    Register a repository (default: the working directory)
  binn project list               List the projects this machine tracks
  binn project status [path]      Manifest facts and live Git facts for the project containing path
  binn project unregister [path]  Remove a registration, changing nothing in the repository

  binn dashboard        Open the dashboard in the default browser, already authorised, and print
                        its address without the token
  binn dashboard --print  Print the dashboard's address, with the token, without opening it

  binn mcp              Serve Binnacle's MCP tools on stdio for the working directory
  binn call <tool> [json]
                        Call one of those tools for the working directory, with its arguments as one
                        JSON object, and print what it returns as JSON: for a harness without
                        Binnacle's MCP server. binn call --help lists the tools and their arguments

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

const CALL_USAGE = `Usage: binn call <tool> [json]

Call one of Binnacle's MCP tools for the Binnacle project containing the working directory, as
\`binn mcp\` serves them, and print what the tool returns as JSON on stdout. Arguments, if the tool
takes any, are one JSON object, such as '{"id":"<task id>"}'.

Exit codes: 0 with the result; 3 with the daemon's error envelope on stdout; 4 with daemon.unreachable
on stdout when the daemon is not running; 2 with a message on stderr for an unknown tool, or arguments
that are not JSON or that the tool does not take.

Tools:
${toolsHelp()}
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
  if (first === 'daemon' && second === 'autostart' && rest.length <= 1 && (rest[0] === undefined || rest[0] === 'on' || rest[0] === 'off')) {
    return await autostart(resolveHome(), rest[0]);
  }

  if (first === 'dashboard' && rest.length === 0 && (second === undefined || second === '--print')) {
    return await dashboard(resolveHome(), second === '--print');
  }

  if (first === 'init') {
    const options = initOptions(argv.slice(1));
    if (options) return await init(resolveHome(), options.path, options);
  }

  if (first === 'audit') {
    const args = argv.slice(1).filter((arg) => arg !== '--json');
    if (args.length <= 1) return await audit(resolveHome(), args[0], argv.includes('--json'));
  }

  if (first === 'mcp' && second === undefined) {
    await mcp(resolveHome(), VERSION);
    return EXIT.ok;
  }

  if (first === 'call' && rest.length === 0 && (second === '-h' || second === '--help')) {
    console.log(CALL_USAGE);
    return EXIT.ok;
  }
  if (first === 'call' && second !== undefined && !second.startsWith('-') && rest.length <= 1) {
    return await call(resolveHome(), second, rest[0]);
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
 * `--apply` with an id and without them, a window as the window question takes it, though not empty,
 * `--language` `en` or `ru`, `--autostart` `yes` or `no`, and any number of `--skip-harness` ids, none empty.
 */
function initOptions(
  args: string[],
): {
  path: string | undefined;
  plan: boolean;
  apply: string | undefined;
  window: ImportWindow | undefined;
  language: Language | undefined;
  autostart: boolean | undefined;
  skipHarness: string[];
} | null {
  try {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        plan: { type: 'boolean' },
        json: { type: 'boolean' },
        apply: { type: 'string' },
        window: { type: 'string' },
        language: { type: 'string' },
        autostart: { type: 'string' },
        'skip-harness': { type: 'string', multiple: true },
      },
    });
    const answer = values.autostart?.trim();
    if (answer !== undefined && answer !== 'yes' && answer !== 'no') return null;
    const autostart = answer === undefined ? undefined : answer === 'yes';
    const plan = values.plan === true;
    const apply = values.apply?.trim();
    if (plan !== (values.json === true) || positionals.length > 1) return null;
    if (apply === '' || (plan && apply !== undefined)) return null;
    const skipHarness = (values['skip-harness'] ?? []).map((id) => id.trim());
    if (skipHarness.includes('')) return null;
    const window = values.window === undefined ? undefined : values.window.trim() === '' ? null : importWindow(values.window);
    const language = values.language?.trim() as Language | undefined;
    if (language !== undefined && !LANGUAGES.includes(language)) return null;
    return window === null ? null : { path: positionals[0], plan, apply, window, language, autostart, skipHarness };
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
