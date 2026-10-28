import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runtimePath, tokenPath } from '@binnacle/daemon';
import { startTestDaemon, type TestDaemon } from '@binnacle/daemon/testing';
import { toolRequest } from '../src/index.ts';

const BINN = fileURLToPath(new URL('../../../apps/cli/src/bin.ts', import.meta.url));

type ToolResult = { isError?: boolean; content: { type: string; text: string }[] };

/** The variables a harness names its session in, which a test run inside that harness inherits. */
const SESSION_VARIABLES = ['CLAUDE_CODE_SESSION_ID', 'CODEX_THREAD_ID'];

/** This process's environment, less any harness's session. */
const withoutSession = (): Record<string, string> =>
  Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined && !SESSION_VARIABLES.includes(entry[0])));

/** `binn` as a process, asynchronously: the test daemon runs in this process and must keep answering. */
const binn = (cwd: string, home: string, ...args: string[]): Promise<{ status: number; stdout: string; stderr: string }> => binnWith({}, cwd, home, ...args);

/** `binn` with `env` over this process's own, and a harness's session variable only where `env` sets it. */
const binnWith = (env: NodeJS.ProcessEnv, cwd: string, home: string, ...args: string[]): Promise<{ status: number; stdout: string; stderr: string }> =>
  new Promise((resolve) => {
    execFile(process.execPath, [BINN, ...args], { cwd, env: { ...withoutSession(), ...env, BINNACLE_HOME: home } }, (error, stdout, stderr) => {
      resolve({ status: error ? Number(error.code) : 0, stdout, stderr });
    });
  });

/**
 * The one MCP test: the real `binn mcp` as a subprocess, driven through the SDK's client
 * over stdio. It covers what the in-process seam cannot — the handshake, tool naming,
 * result encoding and the proxy path. Everything behind the tools is tested through
 * `@binnacle/daemon/testing`.
 */
test('binn mcp lists its tools, explains a stopped daemon, and proxies the snapshot, the task brief and usage', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'binnacle-mcp-home-'));
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-mcp-project-')));
  mkdirSync(join(project, '.binnacle'));
  writeFileSync(
    join(project, '.binnacle', 'project.yaml'),
    'version: 1\n\nproject:\n  id: mcp-project\n\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n',
  );
  mkdirSync(join(project, 'docs', 'specs', 'epic', 'issues'), { recursive: true });
  writeFileSync(join(project, 'docs', 'specs', 'epic', 'issues', '01-first.md'), '# 01: First\n\nStatus: READY\nBlocked by: None\n');

  const env = withoutSession();
  const client = new Client({ name: 'smoke', version: '0' });
  // The harness starts the server in the project; that directory is the path of every call.
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [BINN, 'mcp'], cwd: project, env: { ...env, BINNACLE_HOME: home } }));

  let daemon: TestDaemon | undefined;
  t.after(async () => {
    await client.close();
    await daemon?.stop();
    rmSync(home, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
  });

  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
    'checkpoint_prepare',
    'checkpoint_record',
    'daily_get',
    'project_detect',
    'project_snapshot',
    'project_status',
    'task_get',
    'usage_get',
  ]);

  const down = (await client.callTool({ name: 'project_status' })) as ToolResult;
  assert.equal(down.isError, true);
  const envelope = JSON.parse(down.content[0]!.text) as { error: { code: string; message: string } };
  assert.equal(envelope.error.code, 'daemon.unreachable');
  assert.match(envelope.error.message, /binn daemon start/);

  // binn call, for a harness without the MCP server: the same envelope, and binn's exit code for a stopped daemon.
  const stopped = await binn(project, home, 'call', 'project_status');
  assert.equal(stopped.status, 4, stopped.stderr);
  assert.equal(stopped.stdout.trim(), down.content[0]!.text);

  // Started after the server connected: the runtime file is read on every call.
  daemon = await startTestDaemon({ home });
  assert.equal((await daemon.call('project.register', { path: project })).status, 200);

  const up = (await client.callTool({ name: 'project_snapshot' })) as ToolResult;
  assert.equal(up.isError, undefined, up.content[0]?.text);
  const text = up.content[0]!.text;
  assert.ok(!text.includes('\n'), 'compact JSON');
  const snapshot = JSON.parse(text) as { project: { id: string }; tasks: { readyToStart: { items: { id: string }[] } } };
  assert.equal(snapshot.project.id, 'mcp-project');
  assert.deepEqual(snapshot.tasks.readyToStart.items.map((task) => task.id), ['epic/01']);

  const brief = (await client.callTool({ name: 'task_get', arguments: { id: 'epic/01' } })) as ToolResult;
  assert.equal(brief.isError, undefined, brief.content[0]?.text);
  const { byRole, ...fields } = JSON.parse(brief.content[0]!.text) as { byRole: Record<string, { records: number }> };
  assert.deepEqual(
    Object.entries(byRole).map(([role, totals]) => [role, totals.records]),
    [
      ['implementation', 0],
      ['review', 0],
      ['rework', 0],
    ],
  );
  assert.deepEqual(fields, {
    id: 'epic/01',
    title: 'First',
    state: 'READY',
    triage: null,
    ticket: 'docs/specs/epic/issues/01-first.md',
    spec: null,
    dependencies: [],
    body: { text: '', truncated: false },
    branch: 'feat/first',
    start: '/binnacle:task run docs/specs/epic/issues/01-first.md',
    review: null,
    questions: { branch: null, items: [] },
    roles: { required: ['Developer', 'Reviewer'], source: 'default', suggested: [] },
    diagnostics: [],
    reworkUnread: null,
    request: { available: false, reason: 'There is no forge to read CI from: the tracker is not GitHub or GitLab, and there is no Git remote on GitHub or GitLab.', code: 'ci.no_forge' },
  });

  // binn call prints exactly what the tools return, for the working directory.
  const snapshotCall = await binn(project, home, 'call', 'project_snapshot');
  assert.equal(snapshotCall.status, 0, snapshotCall.stderr);
  assert.equal(snapshotCall.stdout.trim(), text);
  const briefCall = await binn(project, home, 'call', 'task_get', '{"id":"epic/01"}');
  assert.equal(briefCall.status, 0, briefCall.stderr);
  assert.equal(briefCall.stdout.trim(), brief.content[0]!.text);

  const usage = (await client.callTool({ name: 'usage_get', arguments: { task: 'epic/01' } })) as ToolResult;
  assert.equal(usage.isError, undefined, usage.content[0]?.text);
  const task = JSON.parse(usage.content[0]!.text) as { task: { id: string }; totals: { records: number }; runs: { items: unknown[]; remainder: number } };
  assert.deepEqual([task.task.id, task.totals.records, task.runs], ['epic/01', 0, { items: [], remainder: 0 }]);
  // Its epic reaches the operation too, which reads it on a roadmap this project does not have.
  const byEpic = (await client.callTool({ name: 'usage_get', arguments: { epic: 1 } })) as ToolResult;
  assert.equal(byEpic.isError, true);
  assert.equal((JSON.parse(byEpic.content[0]!.text) as { error: { code: string } }).error.code, 'roadmap.missing');

  // A tool's own argument reaches its operation: the daemon, not the server, refuses this one.
  const refused = (await client.callTool({ name: 'daily_get', arguments: { since: 'not-a-commit' } })) as ToolResult;
  assert.equal(refused.isError, true);
  assert.equal((JSON.parse(refused.content[0]!.text) as { error: { code: string } }).error.code, 'request.invalid');
  const refusedCall = await binn(project, home, 'call', 'daily_get', '{"since":"not-a-commit"}');
  assert.equal(refusedCall.status, 3, refusedCall.stderr);
  assert.equal(refusedCall.stdout.trim(), refused.content[0]!.text);

  // What binn call refuses itself: a message on stderr, the usage exit code, nothing on stdout.
  for (const args of [['no_such_tool'], ['task_get', '{"id":'], ['task_get', '["epic/01"]'], ['task_get', '{"id":1}'], ['task_get']]) {
    const wrong = await binn(project, home, 'call', ...args);
    assert.equal(wrong.status, 2, args.join(' '));
    assert.equal(wrong.stdout, '', args.join(' '));
    assert.match(wrong.stderr, /^binn: (unknown tool "no_such_tool"|the arguments are not JSON|task_get does not take these arguments)/, args.join(' '));
  }

  // binn --help names binn call, and binn call --help every tool the server lists, with its arguments.
  assert.match((await binn(project, home, '--help')).stdout, /binn call <tool> \[json\]/);
  const help = await binn(project, home, 'call', '--help');
  assert.equal(help.status, 0, help.stderr);
  for (const tool of tools) {
    assert.match(help.stdout, new RegExp(`^  ${tool.name}\\b`, 'm'), tool.name);
    for (const argument of Object.keys(tool.inputSchema.properties ?? {})) assert.match(help.stdout, new RegExp(`^      ${argument}\\b`, 'm'), `${tool.name} ${argument}`);
  }
});

/**
 * The caller's session, the one Claude Code sets in `CLAUDE_CODE_SESSION_ID` for its shell's commands
 * and Codex in `CODEX_THREAD_ID`: in every daemon call `binn call` makes, as `session` beside `path`,
 * and absent without it. `binn mcp` sends none, even with the variable set: Claude Code keeps an MCP
 * server across `/clear` and `--continue`, so the id it was started with can name another session.
 * The daemon here answers each call with the body it was sent.
 */
test('toolRequest and binn call send the session the harness names, none without it, and binn mcp never', async (t) => {
  assert.deepEqual(toolRequest('project_snapshot', {}, '/work', 'a-session'), { operation: 'project.snapshot', body: { path: '/work', session: 'a-session' } });
  assert.deepEqual(toolRequest('task_get', { id: 'epic/01' }, '/work', 'a-session'), { operation: 'task.get', body: { id: 'epic/01', path: '/work', session: 'a-session' } });
  assert.deepEqual(toolRequest('project_snapshot', {}, '/work', undefined), { operation: 'project.snapshot', body: { path: '/work' } });
  assert.deepEqual(toolRequest('task_get', { id: 'epic/01' }, '/work', undefined), { operation: 'task.get', body: { id: 'epic/01', path: '/work' } });

  const home = mkdtempSync(join(tmpdir(), 'binnacle-session-home-'));
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-session-project-')));
  const echo = createServer((request, response) => {
    let body = '';
    request.on('data', (chunk: Buffer) => (body += chunk.toString()));
    request.on('end', () => response.writeHead(200, { 'content-type': 'application/json' }).end(body));
  });
  await new Promise<void>((resolve) => echo.listen(0, '127.0.0.1', resolve));
  const { port } = echo.address() as AddressInfo;
  writeFileSync(runtimePath(home), JSON.stringify({ pid: process.pid, host: '127.0.0.1', port, startedAt: new Date().toISOString(), version: '0' }));
  writeFileSync(tokenPath(home), 'token');
  const clients: Client[] = [];
  t.after(async () => {
    for (const client of clients) await client.close();
    echo.close();
    rmSync(home, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
  });

  const named = await binnWith({ CLAUDE_CODE_SESSION_ID: 'a-session' }, project, home, 'call', 'task_get', '{"id":"epic/01"}');
  assert.equal(named.status, 0, named.stderr);
  assert.deepEqual(JSON.parse(named.stdout), { id: 'epic/01', path: project, session: 'a-session' });
  const codex = await binnWith({ CODEX_THREAD_ID: 'a-thread' }, project, home, 'call', 'project_snapshot');
  assert.equal(codex.status, 0, codex.stderr);
  assert.deepEqual(JSON.parse(codex.stdout), { path: project, session: 'a-thread' });
  const unnamed = await binnWith({}, project, home, 'call', 'task_get', '{"id":"epic/01"}');
  assert.equal(unnamed.status, 0, unnamed.stderr);
  assert.deepEqual(JSON.parse(unnamed.stdout), { id: 'epic/01', path: project });

  for (const session of ['a-session', undefined]) {
    const client = new Client({ name: 'session', version: '0' });
    clients.push(client);
    const env = { ...withoutSession(), BINNACLE_HOME: home, ...(session && { CLAUDE_CODE_SESSION_ID: session }) };
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [BINN, 'mcp'], cwd: project, env }));
    const result = (await client.callTool({ name: 'project_snapshot' })) as ToolResult;
    assert.equal(result.isError, undefined, result.content[0]?.text);
    assert.deepEqual(JSON.parse(result.content[0]!.text), { path: project });
  }
});
