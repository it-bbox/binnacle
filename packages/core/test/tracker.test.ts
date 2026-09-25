import assert from 'node:assert/strict';
import { test } from 'node:test';
import { branchTask, parseTicketHeader, roadmapAttention, taskBranch, type Epic, type TrackerTask } from '../src/index.ts';

/**
 * The ticket header is read by one pure function for every tracker (ADR-0024), so its rule
 * is pinned here, on the function itself: the remote adapters that also call it land in
 * later tickets, and the daemon seam alone cannot show that a Markdown ticket and an issue
 * body are read the same way.
 */
test('reads the header block after one leading heading', () => {
  const text = [
    '# 03: Build the thing',
    '',
    'Status: READY',
    'Triage: ready-for-agent',
    'Blocked by: 01, 02',
    'Spec: `docs/specs/epic/spec.md`',
    '',
    'Status: DONE',
    '',
    '## Comments',
  ].join('\n');

  assert.deepEqual(parseTicketHeader(text), {
    heading: '03: Build the thing',
    status: 'READY',
    triage: 'ready-for-agent',
    blockedBy: '01, 02',
    spec: '`docs/specs/epic/spec.md`',
  });
});

test('reads an issue body with no heading from its first line, the same way', () => {
  const body = 'Status: ACTIVE\r\nBlocked by: #4\r\nSpec: docs/specs/epic/spec.md\r\n\r\nStatus: DONE\r\n';

  assert.deepEqual(parseTicketHeader(body), {
    heading: null,
    status: 'ACTIVE',
    triage: null,
    blockedBy: '#4',
    spec: 'docs/specs/epic/spec.md',
  });
});

test('reads nothing from a body whose first paragraph is not a header, and keeps the first of a repeated line', () => {
  const none = parseTicketHeader('\n\nSomething is broken.\n\nStatus: READY\n');
  assert.deepEqual(none, { heading: null, status: null, triage: null, blockedBy: null, spec: null });

  const repeated = parseTicketHeader('## A heading of any level\n\nStatus: READY\nStatus: DONE\nTriage:\n');
  assert.equal(repeated.heading, 'A heading of any level');
  assert.equal(repeated.status, 'READY');
  // Written but empty is not the same as not written.
  assert.equal(repeated.triage, '');
});

test('only one leading heading is skipped: a second one ends the search', () => {
  assert.deepEqual(parseTicketHeader('# Title\n\n## Section\n\nStatus: READY\n').status, null);
});

const task = (id: string, specSlug: string | null, state: TrackerTask['state']): TrackerTask => ({
  id,
  title: null,
  state,
  blockedBy: [],
  spec: null,
  specSlug,
  triage: null,
  ticket: id,
  body: '',
});

/**
 * Also on the function, deliberately: on the local tracker a Task's identity starts with its
 * spec slug, so through the daemon linking by slug and by identity prefix look the same, and
 * a Task whose identity is not shaped that way only arrives with the remote adapters.
 */
test('the roadmap checks reach an epic’s Tasks by spec slug, whatever their identity looks like', () => {
  const epics: Epic[] = [
    { number: 1, title: 'Remote', status: 'done', spec: 'remote' },
    { number: 2, title: 'Not yet', status: 'not started', spec: 'later' },
  ];
  const tasks = [
    task('#7', 'remote', 'ACTIVE'),
    task('#8', 'remote', 'DONE'),
    // An identity that starts with the slug is not what links a Task to its epic.
    task('later/01', null, 'READY'),
  ];

  const attention = roadmapAttention(epics, tasks);
  assert.deepEqual(attention.map((item) => item.code), ['roadmap.status_mismatch']);
  assert.match(attention[0]!.message, /Epic 1 .*#7/);
});

/**
 * The branch convention and its inverse live side by side, and this is what keeps them one
 * convention: every Task's branch maps back to that Task, on either kind of tracker. The
 * daemon seam shows attribution; only here are all the shapes of a name checked.
 */
test('a Task’s branch maps back to that Task, and a branch naming none or several maps to none', () => {
  const local = (id: string, ticket: string): Pick<TrackerTask, 'id' | 'title' | 'ticket'> => ({ id, title: null, ticket });
  const tickets = [
    local('telemetry/02', 'docs/specs/telemetry/issues/02-runs-and-task-attribution.md'),
    local('odd/03', 'docs/specs/odd/issues/03-Mixed Case_and.dots.md'),
    local('odd/04', 'docs/specs/odd/issues/04-.md'),
    local('one/01', 'docs/specs/one/issues/01-shared.md'),
    local('two/01', 'docs/specs/two/issues/01-shared.md'),
  ];
  for (const task of tickets.slice(0, 3)) assert.equal(branchTask(taskBranch(task, false), tickets, false), task, taskBranch(task, false));
  assert.equal(taskBranch(tickets[0]!, false), 'feat/runs-and-task-attribution');
  assert.equal(branchTask('feat/shared', tickets, false), null);
  assert.equal(branchTask('feat/nothing', tickets, false), null);
  assert.equal(branchTask('main', tickets, false), null);

  const issues = [
    { id: '#7', title: 'Read the runs, and attribute them!', ticket: 'https://example.invalid/7' },
    { id: '#12', title: 'x'.repeat(80), ticket: 'https://example.invalid/12' },
    { id: '#30', title: '***', ticket: 'https://example.invalid/30' },
    { id: '#31', title: null, ticket: 'https://example.invalid/31' },
  ];
  for (const task of issues) assert.equal(branchTask(taskBranch(task, true), issues, true), task, taskBranch(task, true));
  // By number alone: a branch whose slug no longer matches its issue's title keeps its Task.
  assert.equal(branchTask('feat/7-something-else', issues, true), issues[0]);
  assert.equal(branchTask('feat/8-no-such-issue', issues, true), null);
  assert.equal(branchTask('feat/7x', issues, true), null);
  assert.equal(branchTask('fix/7-not-the-convention', issues, true), null);
  assert.equal(branchTask('feat/runs-and-task-attribution', issues, true), null);
});
