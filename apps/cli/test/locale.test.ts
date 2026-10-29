import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type TestContext } from 'node:test';
import { WORDED_CODES } from '@binnacle/core';
import { isAlive, readRuntime } from '@binnacle/daemon';

const BINN = fileURLToPath(new URL('../src/bin.ts', import.meta.url));

/** The locales a person may run `binn` under, and the language each gives: `LC_ALL` over `LANG`, `ru` for any `ru` value. */
const LOCALES: [string, { LC_ALL?: string; LANG?: string }, 'en' | 'ru'][] = [
  ['ru_RU.UTF-8', { LANG: 'ru_RU.UTF-8' }, 'ru'],
  ['C', { LANG: 'C' }, 'en'],
  ['unset', {}, 'en'],
  ['en_US.UTF-8', { LANG: 'en_US.UTF-8' }, 'en'],
  ['LC_ALL=C over LANG=ru_RU.UTF-8', { LC_ALL: 'C', LANG: 'ru_RU.UTF-8' }, 'en'],
  ['LC_ALL=ru_RU.UTF-8 over LANG=C', { LC_ALL: 'ru_RU.UTF-8', LANG: 'C' }, 'ru'],
];

const RU = { LANG: 'ru_RU.UTF-8' };
const EN = { LANG: 'C' };

/** No code a person could be shown: the daemon's, core's and the CLI's own. */
const CODES = [...WORDED_CODES, 'daemon.unreachable'];

function assertNoCode(text: string, what: string): void {
  for (const code of CODES) assert.ok(!text.includes(code), `${what} shows ${code}:\n${text}`);
}

/** A temporary home and project, with `binn` run in them under a locale, offline and away from this machine's own settings. */
function setup(t: TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-locale-')));
  const home = join(root, 'home');
  const project = join(root, 'project');
  mkdirSync(home);
  mkdirSync(join(project, '.binnacle'), { recursive: true });
  writeFileSync(join(project, '.binnacle', 'project.yaml'), 'version: 1\n\nproject:\n  id: locale-project\n  name: Locale Project\n\norchestration:\n  autopilot: true\n');
  writeFileSync(join(project, 'README.md'), '# Locale Project\n\nAn English README, so that the proposed language does not follow the locale.\n');
  const base = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key !== 'LC_ALL' && key !== 'LANG' && !key.startsWith('GIT_') && !/^BINNACLE_(GITHUB|GITLAB)_TOKEN$/.test(key)),
  );
  const env = (locale: { LC_ALL?: string; LANG?: string }): NodeJS.ProcessEnv => ({
    ...base,
    ...locale,
    HOME: home,
    BINNACLE_HOME: join(home, '.binnacle'),
    BINNACLE_PORT: '0',
    CLAUDE_CONFIG_DIR: join(home, 'claude-config'),
    CODEX_HOME: join(home, 'codex-home'),
    XDG_CONFIG_HOME: join(home, 'xdg'),
    NODE_USE_ENV_PROXY: '1',
    HTTPS_PROXY: 'http://127.0.0.1:9',
    HTTP_PROXY: 'http://127.0.0.1:9',
    NO_PROXY: '127.0.0.1,localhost',
  });
  const binn = (locale: { LC_ALL?: string; LANG?: string }, cwd: string, ...args: string[]) =>
    spawnSync(process.execPath, [BINN, ...args], { cwd, encoding: 'utf8', env: env(locale) });
  t.after(() => {
    const leftover = readRuntime(join(home, '.binnacle'));
    if (leftover && isAlive(leftover.pid)) process.kill(leftover.pid, 'SIGKILL');
    rmSync(root, { recursive: true, force: true });
  });
  return { root, home, project, binn };
}

test('binn --help is Russian under a Russian locale and English otherwise, LC_ALL over LANG', (t) => {
  const { root, binn } = setup(t);
  for (const [name, locale, language] of LOCALES) {
    const help = binn(locale, root, '--help');
    assert.equal(help.status, 0, name);
    const callHelp = binn(locale, root, 'call', '--help');
    assert.equal(callHelp.status, 0, name);
    const unknown = binn(locale, root, 'no-such-command');
    assert.equal(unknown.status, 2, name);
    if (language === 'ru') {
      assert.match(help.stdout, /^Использование:$/m, name);
      assert.match(help.stdout, /binn daemon start {5}Запустить демон Binnacle/, name);
      assert.match(help.stdout, /^ {2}BINNACLE_HOST {9}Адрес, на котором слушает демон/m, name);
      assert.match(help.stdout, /^ {2}BINNACLE_ALLOWED_HOSTS {2}Значения host:port через запятую/m, name);
      assert.match(callHelp.stdout, /^Использование: binn call <tool> \[json\]$/m, name);
      assert.match(callHelp.stdout, /^Инструменты:$/m, name);
      assert.match(unknown.stderr, /^binn: неизвестная команда "no-such-command"\./, name);
    } else {
      assert.match(help.stdout, /^Usage:$/m, name);
      assert.match(help.stdout, /binn daemon start {5}Start the Binnacle daemon/, name);
      assert.match(help.stdout, /^ {2}BINNACLE_HOST {9}Address the daemon binds/m, name);
      assert.match(help.stdout, /^ {2}BINNACLE_ALLOWED_HOSTS {2}Comma-separated host:port values/m, name);
      assert.match(callHelp.stdout, /^Usage: binn call <tool> \[json\]$/m, name);
      assert.match(unknown.stderr, /^binn: unknown command "no-such-command"\./, name);
    }
    // The commands themselves are never translated.
    assert.match(help.stdout, /binn init \[--window <days\|all>\] \[--language <en\|ru>\]/, name);
    assert.match(callHelp.stdout, /^ {2}task_get\b/m, name);
    assertNoCode(help.stdout + callHelp.stdout, name);
  }
});

test('binn daemon, project and dashboard speak the locale, with no code in their text and the exit codes as before', async (t) => {
  const { root, home, project, binn } = setup(t);
  const both = (cwd: string, ...args: string[]) => {
    const ru = binn(RU, cwd, ...args);
    const en = binn(EN, cwd, ...args);
    assert.equal(ru.status, en.status, `${args.join(' ')}: the exit code is the same under either locale`);
    assertNoCode(ru.stdout + ru.stderr, `${args.join(' ')} in Russian`);
    assertNoCode(en.stdout + en.stderr, `${args.join(' ')} in English`);
    return { ru, en };
  };

  // No daemon yet.
  let { ru, en } = both(root, 'daemon', 'status');
  assert.equal(ru.status, 4);
  assert.match(ru.stdout, /^Демон Binnacle не запущен\.$/m);
  assert.match(ru.stdout, /^Автозапуск для .* выключен/m);
  assert.match(en.stdout, /^Binnacle daemon is not running\.$/m);
  assert.match(en.stdout, /^Autostart is off for /m);

  ({ ru, en } = both(project, 'project', 'register'));
  assert.equal(ru.status, 4);
  assert.match(ru.stderr, /^binn: демон Binnacle не запущен\. Запустите его командой `binn daemon start`\.$/m);
  assert.match(en.stderr, /^binn: the Binnacle daemon is not running\./m);

  ({ ru, en } = both(root, 'dashboard', '--print'));
  assert.equal(ru.status, 4);
  assert.match(ru.stderr, /^binn: демон Binnacle не отвечает\. Запустите его командой `binn daemon start`\.$/m);
  assert.match(en.stderr, /^binn: no Binnacle daemon is answering\./m);

  // A daemon, started in Russian.
  const start = binn(RU, root, 'daemon', 'start');
  assert.equal(start.status, 0, start.stderr);
  assert.match(start.stdout, /^Демон Binnacle запущен\.$/m);
  assert.match(start.stdout, /^ {2}адрес {9}http:\/\/127\.0\.0\.1:\d+$/m);
  assert.match(binn(EN, root, 'daemon', 'start').stdout, /^Binnacle daemon is already running\.$/m);

  ({ ru, en } = both(root, 'daemon', 'status'));
  assert.equal(ru.status, 0, ru.stderr);
  assert.match(ru.stdout, /^Демон Binnacle работает\.$/m);
  assert.match(en.stdout, /^Binnacle daemon is running\.$/m);
  assert.match(en.stdout, /^ {2}address {2}http:\/\/127\.0\.0\.1:\d+$/m);
  assert.match(en.stdout, /^ {2}bound {4}127\.0\.0\.1$/m);
  assert.match(en.stdout, /^ {2}accepts {2}127\.0\.0\.1:\d+$/m);
  assert.match(ru.stdout, /^ {2}слушает {7}127\.0\.0\.1$/m);
  assert.match(ru.stdout, /^ {2}принимает {5}127\.0\.0\.1:\d+$/m);

  // A registration with a warning: worded in Russian from its code and params, on stderr.
  ({ ru, en } = both(project, 'project', 'register'));
  assert.equal(ru.status, 0, ru.stderr);
  assert.match(ru.stdout, /^locale-project зарегистрирован\.$/m);
  assert.match(ru.stderr, /^binn: orchestration: неизвестный ключ, пропущен/m);
  assert.match(en.stdout, /^Registered locale-project\.$/m);
  assert.match(en.stderr, /^binn: orchestration: /m);

  ({ ru, en } = both(project, 'project', 'list'));
  assert.match(ru.stdout, /^Проекты Binnacle \(1\):$/m);
  assert.match(en.stdout, /^Binnacle projects \(1\):$/m);

  // Outside Git: the Git facts are unavailable, said in the locale's words without their code.
  ({ ru, en } = both(project, 'project', 'status'));
  assert.equal(ru.status, 0, ru.stderr);
  assert.match(ru.stdout, /^ {2}git +недоступен: .* — не внутри Git-репозитория\.$/m);
  assert.match(en.stdout, /^ {2}git +unavailable: .*not inside a Git repository/m);

  // An operation failure: the daemon's error worded from its code, the exit code 3.
  const bare = join(root, 'bare');
  mkdirSync(bare);
  ({ ru, en } = both(bare, 'project', 'register'));
  assert.equal(ru.status, 3);
  assert.match(ru.stderr, /^binn: В .*bare нет \.binnacle\/project\.yaml\. Его пишет `binn init`\.$/m);
  assert.match(en.stderr, /^binn: No \.binnacle\/project\.yaml in /m);

  ru = binn(RU, project, 'project', 'unregister');
  assert.equal(ru.status, 0, ru.stderr);
  assert.match(ru.stdout, /^Регистрация .*project снята\. В репозитории ничего не изменено\.$/m);
  // Unregistered now: both fail as before, each in its words.
  ({ ru, en } = both(project, 'project', 'unregister'));
  assert.equal(ru.status, 3);
  assert.match(ru.stderr, /^binn: .*project — не зарегистрированный проект Binnacle\.$/m);
  assert.match(en.stderr, /^binn: .*project is not a registered Binnacle project/m);

  ({ ru, en } = both(root, 'daemon', 'stop'));
  assert.equal(ru.status, 0, ru.stderr);
  assert.match(ru.stdout, /^Демон Binnacle остановлен \(pid \d+\)\.$/m);
  assert.match(en.stdout, /^Binnacle daemon is not running\.$/m);
  assert.equal(readRuntime(join(home, '.binnacle')), null);
});

test('binn call and every --json are byte-for-byte the same under either locale', (t) => {
  const { root, project, binn } = setup(t);
  const same = (cwd: string, ...args: string[]) => {
    const ru = binn(RU, cwd, ...args);
    const en = binn(EN, cwd, ...args);
    assert.equal(ru.status, en.status, args.join(' '));
    assert.equal(ru.stdout, en.stdout, args.join(' '));
    assert.ok(ru.stdout.length > 0, args.join(' '));
    return ru;
  };

  // The daemon's error envelope, then its results.
  assert.equal(same(project, 'call', 'project_detect').status, 4);
  assert.equal(binn(EN, root, 'daemon', 'start').status, 0);
  t.after(() => binn(EN, root, 'daemon', 'stop'));
  assert.equal(same(project, 'call', 'project_detect').status, 3);
  assert.equal(binn(EN, project, 'project', 'register').status, 0);
  assert.equal(same(project, 'call', 'project_detect').status, 0);
  assert.equal(same(project, 'call', 'project_status').status, 0);

  // A Git repository for audit and init, documented in English.
  for (const args of [['init', '-q', '-b', 'main'], ['add', '-A'], ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'Start']]) {
    const result = spawnSync('git', args, { cwd: project, encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } });
    assert.equal(result.status, 0, result.stderr);
  }
  assert.equal(same(project, 'audit', '--json').status, 0);
  assert.equal(same(project, 'init', '--plan', '--json', '--autostart', 'no').status, 0);
});
