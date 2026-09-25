import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startTestDaemon, type TestDaemon } from '@binnacle/daemon/testing';

const BINN = fileURLToPath(new URL('../../../apps/cli/src/bin.ts', import.meta.url));

type ToolResult = { isError?: boolean; content: { type: string; text: string }[] };

/**
 * The one MCP test: the real `binn mcp` as a subprocess, driven through the SDK's client
 * over stdio. It covers what the in-process seam cannot — the handshake, tool naming,
 * result encoding and the proxy path. Everything behind the tools is tested through
 * `@binnacle/daemon/testing`.
 */
test('binn mcp lists its tools, explains a stopped daemon, and proxies the snapshot and the task brief', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'binnacle-mcp-home-'));
  const project = realpathSync(mkdtempSync(join(tmpdir(), 'binnacle-mcp-project-')));
  mkdirSync(join(project, '.binnacle'));
  writeFileSync(
    join(project, '.binnacle', 'project.yaml'),
    'version: 1\n\nproject:\n  id: mcp-project\n\ntracker:\n  provider: local\n  local:\n    issues: docs/specs\n',
  );
  mkdirSync(join(project, 'docs', 'specs', 'epic', 'issues'), { recursive: true });
  writeFileSync(join(project, 'docs', 'specs', 'epic', 'issues', '01-first.md'), '# 01: First\n\nStatus: READY\nBlocked by: None\n');

  const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
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
  ]);

  const down = (await client.callTool({ name: 'project_status' })) as ToolResult;
  assert.equal(down.isError, true);
  const envelope = JSON.parse(down.content[0]!.text) as { error: { code: string; message: string } };
  assert.equal(envelope.error.code, 'daemon.unreachable');
  assert.match(envelope.error.message, /binn daemon start/);

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
  assert.deepEqual(JSON.parse(brief.content[0]!.text) as unknown, {
    id: 'epic/01',
    title: 'First',
    state: 'READY',
    triage: null,
    ticket: 'docs/specs/epic/issues/01-first.md',
    spec: null,
    dependencies: [],
    body: { text: '', truncated: false },
    branch: 'feat/first',
  });

  // A tool's own argument reaches its operation: the daemon, not the server, refuses this one.
  const refused = (await client.callTool({ name: 'daily_get', arguments: { since: 'not-a-commit' } })) as ToolResult;
  assert.equal(refused.isError, true);
  assert.equal((JSON.parse(refused.content[0]!.text) as { error: { code: string } }).error.code, 'request.invalid');
});
