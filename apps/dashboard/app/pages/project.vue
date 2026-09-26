<script setup lang="ts">
import RoleUsage from '~/components/RoleUsage.vue';
import { call, usePolling, type Failure } from '~/composables/daemon';
import { ago, checkout, projectName, RUNNING_READING, type Epic, type ProjectRow, type Snapshot, type Unavailable } from '~/composables/projects';
import { IMPORTING, windowLabel, type ProjectUsage } from '~/composables/usage';

type Section<T> = { items: T[]; remainder: number };
type ProjectSnapshot = Snapshot & {
  project: ProjectRow;
  decisions: Section<{ title: string | null; path: string }> | null;
  pendingDecisions: Unavailable;
  ci: Unavailable;
};

/** `task.list`'s board, as the page renders it. */
type LatestRun = { harness: string; model: string | null; role: string; lastActivityAt: string; active: { value: boolean } };
type Card = { id: string; title: string | null; state: string | null; source: 'state' | 'runs' | null; unmetDependencies: string[]; review: boolean | null; latestRun: LatestRun | null };
type Board = {
  epic: Epic | null;
  spec: string | null;
  columns: Record<'backlog' | 'ready' | 'inProgress' | 'done', Section<Card>>;
  unknown: Section<Card & { diagnostic: Failure | null }>;
  cancelled: number;
  withoutSpec: number;
};

const COLUMNS = [
  ['backlog', 'Backlog'],
  ['ready', 'Ready'],
  ['inProgress', 'In progress'],
  ['done', 'Done'],
] as const;

const route = useRoute();
const project = typeof route.query.project === 'string' ? route.query.project : null;
/** The board's group: an epic's spec, the Tasks without one, or, by default, the current epic. */
const group = (): { spec?: string | null } => {
  if (route.query.withoutSpec !== undefined) return { spec: null };
  return typeof route.query.spec === 'string' ? { spec: route.query.spec } : {};
};

const snapshot = usePolling(async () => (project === null ? null : call<ProjectSnapshot>('project.snapshot', { path: project })));
const board = usePolling(async () => (project === null ? null : call<Board>('task.list', { path: project, ...group() })));
watch(() => route.query, board.refresh);
const usage = usePolling(async () => (project === null ? null : call<ProjectUsage>('usage.get', { path: project })));

const count = (section: Section<unknown>): number => section.items.length + section.remainder;
const who = (run: LatestRun): string => `${run.harness}, ${run.model ?? 'model not reported'}, ${run.role}, last active ${ago(run.lastActivityAt)}`;
</script>

<template>
  <p v-if="project === null" class="warn">This address names no project. Open one from the Overview.</p>
  <template v-else>
    <p v-if="snapshot.error.value" class="warn"><code>{{ snapshot.error.value.code }}</code> {{ snapshot.error.value.message }}</p>
    <p v-else-if="snapshot.data.value === null" class="muted">Loading…</p>
    <template v-else>
      <h1>{{ projectName(snapshot.data.value.project) }}</h1>

      <h2>Roadmap</h2>
      <p v-if="snapshot.data.value.roadmap === null" class="muted">No roadmap to read; the Overview's attention says why.</p>
      <table v-else>
        <tbody>
          <tr v-for="epic in snapshot.data.value.roadmap.epics" :key="epic.number" :class="{ shown: board.data.value?.epic?.number === epic.number }">
            <td>{{ epic.number }}</td>
            <td>
              <NuxtLink v-if="epic.spec !== null" :to="{ query: { project, spec: epic.spec } }">{{ epic.title }}</NuxtLink>
              <span v-else>{{ epic.title }}</span>
            </td>
            <td>{{ epic.status }}</td>
          </tr>
        </tbody>
      </table>
      <p v-if="board.data.value && board.data.value.withoutSpec > 0">
        <NuxtLink :to="{ query: { project, withoutSpec: null } }">Tasks without a spec</NuxtLink> ({{ board.data.value.withoutSpec }})
      </p>
    </template>

    <p v-if="board.error.value" class="warn"><code>{{ board.error.value.code }}</code> {{ board.error.value.message }}</p>
    <template v-else-if="board.data.value">
      <h2 v-if="board.data.value.epic">Board: Epic {{ board.data.value.epic.number }}, {{ board.data.value.epic.title }}</h2>
      <h2 v-else-if="board.data.value.spec !== null">Board: {{ board.data.value.spec }}</h2>
      <h2 v-else-if="route.query.withoutSpec !== undefined">Board: Tasks without a spec</h2>
      <h2 v-else>Board</h2>
      <p v-if="board.data.value.epic === null && board.data.value.spec === null && route.query.withoutSpec === undefined" class="muted">
        No epic is current: every epic on the roadmap is done, or there is no roadmap to read.
      </p>
      <div class="board">
        <section v-for="[key, label] in COLUMNS" :key="key" class="column">
          <h3>{{ label }} ({{ count(board.data.value.columns[key]) }})</h3>
          <p v-if="key === 'done' && board.data.value.columns.done.items.length > 0" class="muted">The latest:</p>
          <ul>
            <li v-for="card in board.data.value.columns[key].items" :key="card.id" class="card">
              <NuxtLink :to="{ path: '/task', query: { project, id: card.id } }">{{ card.id }}</NuxtLink>
              {{ card.title ?? '(untitled)' }}
              <div>
                <code>{{ card.state }}</code>
                <span v-if="card.source === 'runs'" class="label" title="Binnacle's reading: the ticket says READY, and AgentRuns are attributed to it (ADR-0032)">runs</span>
              </div>
              <div v-if="card.unmetDependencies.length > 0" class="warn">Waits on {{ card.unmetDependencies.join(', ') }}</div>
              <div v-if="card.state === 'DONE' && card.review === false" class="warn">No Review recorded</div>
              <div v-if="card.latestRun" class="muted">
                {{ who(card.latestRun) }}:
                <strong v-if="card.latestRun.active.value" :title="RUNNING_READING">running now</strong>
                <span v-else :title="RUNNING_READING">not running now</span>
              </div>
            </li>
            <li v-if="board.data.value.columns[key].remainder > 0" class="muted">and {{ board.data.value.columns[key].remainder }} more</li>
          </ul>
        </section>
      </div>
      <p v-if="board.data.value.cancelled > 0" class="muted">{{ board.data.value.cancelled }} cancelled, not listed.</p>
      <template v-if="count(board.data.value.unknown) > 0">
        <h3>Unknown state</h3>
        <ul>
          <li v-for="card in board.data.value.unknown.items" :key="card.id">
            <NuxtLink :to="{ path: '/task', query: { project, id: card.id } }">{{ card.id }}</NuxtLink>
            {{ card.title ?? '(untitled)' }}
            <span v-if="card.diagnostic" class="warn"><code>{{ card.diagnostic.code }}</code> {{ card.diagnostic.message }}</span>
          </li>
          <li v-if="board.data.value.unknown.remainder > 0" class="muted">and {{ board.data.value.unknown.remainder }} more</li>
        </ul>
      </template>
    </template>

    <h2>Usage by role, {{ usage.data.value === null ? 'over the import window' : windowLabel(usage.data.value.importing) }}</h2>
    <p v-if="usage.error.value" class="warn"><code>{{ usage.error.value.code }}</code> {{ usage.error.value.message }}</p>
    <p v-else-if="usage.data.value === null" class="muted">Loading…</p>
    <template v-else>
      <p v-if="usage.data.value.importing.incomplete" class="warn">{{ IMPORTING }}</p>
      <RoleUsage :usage="usage.data.value" />
      <p><NuxtLink :to="{ path: '/usage', query: { project } }">Usage page</NuxtLink></p>
    </template>

    <template v-if="snapshot.data.value">
      <h2>Registered checkout</h2>
      <p>{{ checkout(snapshot.data.value.git) }}</p>
      <h2>Recent decisions</h2>
      <p v-if="snapshot.data.value.decisions === null" class="muted">No ADR directory to read.</p>
      <ul v-else>
        <li v-for="item in snapshot.data.value.decisions.items" :key="item.path">
          {{ item.title ?? '(untitled)' }} <code class="muted">{{ item.path }}</code>
        </li>
        <li v-if="snapshot.data.value.decisions.remainder > 0" class="muted">and {{ snapshot.data.value.decisions.remainder }} more</li>
      </ul>
      <h2>Pending decisions</h2>
      <p class="muted">{{ snapshot.data.value.pendingDecisions.reason }}</p>
      <h2>CI</h2>
      <p class="muted">{{ snapshot.data.value.ci.reason }}</p>
    </template>
  </template>
</template>

<style scoped>
h2 {
  font-size: 1rem;
  margin-top: 1.5rem;
}
h3 {
  font-size: 0.9rem;
  color: var(--muted);
  margin: 0 0 0.5rem;
}
table {
  border-collapse: collapse;
}
td {
  padding: 0.2rem 0.75rem 0.2rem 0;
}
tr.shown td {
  font-weight: 600;
}
.board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem;
}
.column {
  padding: 0.5rem 0.75rem;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
}
ul {
  margin: 0;
  padding-left: 1.25rem;
}
.column ul {
  padding: 0;
  list-style: none;
}
.card {
  padding: 0.4rem 0;
  border-top: 1px solid var(--line);
  overflow-wrap: anywhere;
}
.label {
  margin-left: 0.4rem;
  padding: 0 0.3rem;
  font-size: 0.8em;
  border: 1px solid var(--line);
  border-radius: 3px;
}
</style>
