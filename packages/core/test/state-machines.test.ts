import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transitionAgentRun, transitionReview, transitionTask } from '../src/index.ts';

/**
 * Each machine is pinned edge by edge against `docs/workflow/03-state-machines.md`: every
 * ordered pair of states is tried, and exactly the listed ones may pass. A missing edge and
 * an extra one fail alike.
 */
type Machine = {
  name: string;
  transition: (from: string, to: string) => { ok: true; state: string } | { ok: false; code: string; message: string };
  states: string[];
  edges: string[];
};

const PRE_MERGE = ['BACKLOG', 'READY', 'ACTIVE', 'BLOCKED', 'READY_FOR_REVIEW', 'APPROVED', 'MERGE_READY'];
const RUN_LIVE = ['PLANNED', 'RUNNING', 'WAITING_INPUT'];

const machines: Machine[] = [
  {
    name: 'Task',
    transition: transitionTask as Machine['transition'],
    states: [...PRE_MERGE, 'MERGED', 'DONE', 'CANCELLED'],
    edges: [
      'BACKLOG→READY',
      'READY→ACTIVE',
      'ACTIVE→BLOCKED',
      'BLOCKED→ACTIVE',
      'ACTIVE→READY_FOR_REVIEW',
      'READY_FOR_REVIEW→ACTIVE',
      'READY_FOR_REVIEW→APPROVED',
      'APPROVED→MERGE_READY',
      'MERGE_READY→MERGED',
      'MERGED→DONE',
      ...PRE_MERGE.map((state) => `${state}→CANCELLED`),
    ],
  },
  {
    name: 'AgentRun',
    transition: transitionAgentRun as Machine['transition'],
    states: [...RUN_LIVE, 'COMPLETED', 'FAILED', 'ABORTED', 'BUDGET_EXCEEDED'],
    edges: [
      'PLANNED→RUNNING',
      'RUNNING→WAITING_INPUT',
      'WAITING_INPUT→RUNNING',
      'RUNNING→COMPLETED',
      ...RUN_LIVE.flatMap((state) => [`${state}→FAILED`, `${state}→ABORTED`, `${state}→BUDGET_EXCEEDED`]),
    ],
  },
  {
    name: 'Review',
    transition: transitionReview as Machine['transition'],
    states: ['PENDING', 'IN_REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'RESOLVED'],
    edges: [
      'PENDING→IN_REVIEW',
      'IN_REVIEW→APPROVED',
      'IN_REVIEW→CHANGES_REQUESTED',
      'CHANGES_REQUESTED→RESOLVED',
      'RESOLVED→IN_REVIEW',
    ],
  },
];

for (const machine of machines) {
  test(`${machine.name}: exactly the documented transitions pass`, () => {
    const terminal = machine.states.filter((from) => !machine.edges.some((edge) => edge.startsWith(`${from}→`)));

    for (const from of machine.states) {
      for (const to of machine.states) {
        const result = machine.transition(from, to);
        if (machine.edges.includes(`${from}→${to}`)) {
          assert.deepEqual(result, { ok: true, state: to }, `${from}→${to} should pass`);
        } else {
          assert.equal(result.ok, false, `${from}→${to} should be rejected`);
          assert.ok(!result.ok);
          assert.equal(result.code, terminal.includes(from) ? 'transition.terminal' : 'transition.not_allowed');
          assert.match(result.message, new RegExp(`${machine.name}.*${from}.*${to}`));
        }
      }
    }
  });

  test(`${machine.name}: a value that is not one of its states is rejected, not thrown`, () => {
    const known = machine.states[0]!;
    // `toString` sits on every plain object's prototype; `approved` differs from a state only by case.
    for (const stranger of ['BOGUS', 'toString', '', 'approved', undefined, null, 42]) {
      for (const [from, to] of [
        [stranger, known],
        [known, stranger],
      ]) {
        const result = machine.transition(from as string, to as string);
        assert.equal(result.ok, false);
        assert.ok(!result.ok);
        assert.equal(result.code, 'transition.unknown_state', `${String(from)}→${String(to)}`);
      }
    }
  });
}

test('the machines do not share states: a Task cannot move into a Review state', () => {
  const result = transitionTask('ACTIVE', 'CHANGES_REQUESTED' as never);
  assert.ok(!result.ok);
  assert.equal(result.code, 'transition.unknown_state');

  const run = transitionAgentRun('RUNNING', 'DONE' as never);
  assert.ok(!run.ok);
  assert.equal(run.code, 'transition.unknown_state');
});
