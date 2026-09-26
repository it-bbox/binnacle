<script setup lang="ts">
import { call, usePolling, type Failure } from '~/composables/daemon';

/** `task.get`'s brief, as the Task page renders it. */
type Brief = {
  id: string;
  title: string | null;
  state: string | null;
  triage: string | null;
  ticket: string;
  spec: string | null;
  dependencies: { id: string; title: string | null; state: string | null; met: boolean | null; dangling: boolean }[];
  body: { text: string; truncated: boolean };
  branch: string;
  start: string | null;
  diagnostics: Failure[];
};

const route = useRoute();
const project = typeof route.query.project === 'string' ? route.query.project : null;
const id = typeof route.query.id === 'string' ? route.query.id : null;
const { data, error } = usePolling(async () => (project === null || id === null ? null : call<Brief>('task.get', { path: project, id })));

const dependency = (item: Brief['dependencies'][number]): string =>
  item.dangling ? 'names no known Task' : `${item.state ?? 'no state'}, ${item.met ? 'met' : 'not met'}`;
</script>

<template>
  <p v-if="project === null || id === null" class="warn">This address names no Task. Open one from the Overview.</p>
  <p v-else-if="error" class="warn"><code>{{ error.code }}</code> {{ error.message }}</p>
  <p v-else-if="data === null" class="muted">Loading…</p>
  <template v-else>
    <h1>{{ data.id }}: {{ data.title ?? '(untitled)' }}</h1>
    <section class="start">
      <h2>Start it</h2>
      <p v-if="data.start !== null">In a fresh session: <CopyCommand :command="data.start" /></p>
      <p v-else class="muted">No start command for this Task.</p>
    </section>
    <dl>
      <dt>State</dt>
      <dd>{{ data.state ?? 'unknown' }}</dd>
      <dt>Triage</dt>
      <dd>{{ data.triage ?? 'none' }}</dd>
      <dt>Branch</dt>
      <dd><code>{{ data.branch }}</code></dd>
      <dt>Spec</dt>
      <dd><code v-if="data.spec !== null">{{ data.spec }}</code><span v-else class="muted">none</span></dd>
      <dt>Ticket</dt>
      <dd><code>{{ data.ticket }}</code></dd>
      <dt>Dependencies</dt>
      <dd>
        <span v-if="data.dependencies.length === 0" class="muted">none</span>
        <ul v-else>
          <li v-for="item in data.dependencies" :key="item.id" :class="{ warn: item.met === false }">
            {{ item.id }} {{ item.title ?? '' }} ({{ dependency(item) }})
          </li>
        </ul>
      </dd>
    </dl>
    <ul v-if="data.diagnostics.length > 0">
      <li v-for="(item, index) in data.diagnostics" :key="index" class="warn"><code>{{ item.code }}</code> {{ item.message }}</li>
    </ul>
    <h2>Ticket</h2>
    <pre class="body">{{ data.body.text }}</pre>
    <p v-if="data.body.truncated" class="muted">The brief cut the body here; the whole ticket is at <code>{{ data.ticket }}</code>.</p>
  </template>
</template>

<style scoped>
h2 {
  font-size: 1rem;
}
.start {
  padding: 0.25rem 1rem;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
}
dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.35rem 1rem;
}
dt {
  color: var(--muted);
}
dd {
  margin: 0;
}
ul {
  margin: 0;
  padding-left: 1.25rem;
}
.body {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: inherit;
  padding: 0.75rem 1rem;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
}
</style>
