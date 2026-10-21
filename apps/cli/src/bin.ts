#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { type ImportWindow, type Language } from '@binnacle/core';
import { resolveHome, packageVersion } from '@binnacle/daemon';
import { autostart, start, status, stop } from './daemon-commands.ts';
import { list, register, status as projectStatus, unregister } from './project-commands.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { dashboard } from './dashboard.ts';
import { audit } from './audit.ts';
import { importWindow, init } from './init.ts';
import { parseLanguage } from './language.ts';
import { toolsHelp } from '@binnacle/mcp';
import { call, mcp } from './mcp.ts';
import { T } from './text.ts';

const VERSION = packageVersion(import.meta.url);

process.exitCode = await run(process.argv.slice(2));

async function run(argv: string[]): Promise<ExitCode> {
  const [first, second, ...rest] = argv;

  if (first === undefined || first === '-h' || first === '--help' || first === 'help') {
    console.log(T.usage);
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
    console.log(T.callUsage(toolsHelp()));
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
    const language = values.language === undefined ? undefined : parseLanguage(values.language);
    if (language === null) return null;
    return window === null ? null : { path: positionals[0], plan, apply, window, language, autostart, skipHarness };
  } catch {
    // An unknown option, or --window without its value.
    return null;
  }
}

function usage(command: string): ExitCode {
  console.error(`binn: ${T.unknownCommand(JSON.stringify(command))}\n`);
  console.error(T.usage);
  return EXIT.usage;
}
