/**
 * A fake `schtasks` that records its arguments and answers as the real one does, keeping the
 * registered task, a copy of its XML as Task Scheduler keeps one, in a file. A Node script by
 * this Node's absolute path, since the XML is UTF-16, so that its PATH holds nothing else: no
 * real service manager is reachable from these tests. It refuses XML that is not UTF-16 with
 * its byte order mark, as schtasks does. With the `runs` flag set, running the task runs what
 * its action's command line names, with the environment it sets and its output appended to the
 * file it names, and ending it signals that process and waits, as Task Scheduler would.
 */
export const fakeSchtasks = (log: string, state: string): string => `#!${process.execPath}
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const state = ${JSON.stringify(state)};
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(log)}, args.join(' ') + '\\n');
const file = (name) => state + '/' + name;
const flag = (name) => fs.existsSync(file(name)) && fs.readFileSync(file(name), 'utf8').trim() === 'yes';
const fail = (message) => { process.stderr.write(message + '\\n'); process.exit(1); };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const running = () => { const pid = Number(fs.existsSync(file('pid')) ? fs.readFileSync(file('pid'), 'utf8') : ''); return pid && alive(pid) ? pid : null; };
const task = file('task.xml');
const registered = fs.existsSync(task);
const unknown = () => fail('ERROR: The system cannot find the file specified.');
const unxml = (value) => value.replace(/&(lt|gt|amp);/g, (_, name) => ({ lt: '<', gt: '>', amp: '&' })[name]);

function run() {
  if (!flag('runs') || running()) return;
  const line = unxml(fs.readFileSync(task, 'utf16le').match(/<Arguments>([^<]*)<\\/Arguments>/)[1]);
  const env = { HOME: process.env.HOME, BINNACLE_PORT: process.env.BINNACLE_PORT };
  for (const [, key, value] of line.matchAll(/set "([^=]+)=([^"]*)"/g)) env[key] = value;
  const [, node, entry] = line.match(/&& "([^"]*)" "([^"]*)"/);
  const out = fs.openSync(line.match(/>> "([^"]*)"/)[1], 'a');
  const child = spawn(node, [entry], { env, detached: true, stdio: ['ignore', out, out] });
  child.unref();
  fs.writeFileSync(file('pid'), String(child.pid));
}

function halt() {
  const pid = running();
  if (!pid) return;
  process.kill(pid, 'SIGTERM');
  const deadline = Date.now() + 10000;
  while (alive(pid) && Date.now() < deadline) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
  if (alive(pid)) process.kill(pid, 'SIGKILL');
}

switch (args[0]) {
  case '/Query':
    if (flag('no-scheduler')) fail('ERROR: The Task Scheduler service is not available.');
    if (args.includes('/TN') && !registered) unknown();
    console.log('Folder: \\\\');
    break;
  case '/Create': {
    if (flag('refuse')) fail('ERROR: Access is denied.');
    const xml = fs.readFileSync(args[args.indexOf('/XML') + 1]);
    if (xml[0] !== 0xff || xml[1] !== 0xfe) fail('ERROR: The task XML is malformed.');
    if (registered && !args.includes('/F')) fail('ERROR: Cannot create a file when that file already exists.');
    fs.writeFileSync(task, xml);
    console.log('SUCCESS: The scheduled task "binnacle" has successfully been created.');
    break;
  }
  case '/Run':
    if (!registered) unknown();
    if (flag('refuse')) fail('ERROR: Access is denied.');
    run();
    console.log('SUCCESS: Attempted to run the scheduled task "binnacle".');
    break;
  case '/End':
    if (!registered) unknown();
    halt();
    console.log('SUCCESS: The scheduled task "binnacle" has been terminated successfully.');
    break;
  case '/Delete':
    if (!registered) unknown();
    fs.rmSync(task);
    console.log('SUCCESS: The scheduled task "binnacle" was successfully deleted.');
    break;
}
`;
