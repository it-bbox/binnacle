<script setup lang="ts">
import RoleUsage from '~/components/RoleUsage.vue';
import UsageTable from '~/components/UsageTable.vue';
import { call, usePolling } from '~/composables/daemon';
import { isUnavailable } from '~/composables/projects';
import { IMPORTING, windowLabel, type ProjectUsage, type SnapshotUsage } from '~/composables/usage';

/** ADR-0014's names for the levels a harness reaches through its artifacts. */
const LEVELS: Record<number, string> = { 1: 'Context', 2: 'Attribution', 3: 'Usage' };

const COST_UNAVAILABLE =
  'Cost is not available: no harness artifact Binnacle reads reports it, and a cost computed from a price table is left for later, since under a subscription such a number is conditional.';

const route = useRoute();
const project = typeof route.query.project === 'string' ? route.query.project : null;
// The snapshot answers today, the last seven days and the harnesses; `usage.get` the window, by Task and by role.
const { data, error } = usePolling(async () => {
  if (project === null) return null;
  const [snapshot, overWindow] = await Promise.all([
    call<{ usage: SnapshotUsage }>('project.snapshot', { path: project }),
    call<ProjectUsage>('usage.get', { path: project }),
  ]);
  return { snapshot: snapshot.usage, overWindow };
});
</script>

<template>
  <p v-if="project === null" class="warn">This address names no project. Open its usage from the Overview.</p>
  <p v-else-if="error" class="warn"><code>{{ error.code }}</code> {{ error.message }}</p>
  <p v-else-if="data === null" class="muted">Loading…</p>
  <template v-else>
    <h1>Usage</h1>
    <p class="muted">
      <code>{{ project }}</code> · tokens read from the harnesses' artifacts. A field no record reports is not reported, never zero, and a total Binnacle
      calculated from what an artifact wrote says so.
    </p>
    <p v-if="data.snapshot.importing.incomplete || data.overWindow.importing.incomplete" class="warn">{{ IMPORTING }}</p>

    <h2>Today, the last seven days and the import window</h2>
    <UsageTable
      :rows="[
        { key: 'today', label: 'Today', totals: data.snapshot.today },
        { key: 'week', label: 'Last seven days', totals: data.snapshot.last7Days },
        { key: 'window', label: data.overWindow.importing.windowStart === null ? 'Import window' : `Since ${data.overWindow.importing.windowStart}`, totals: data.overWindow.totals },
      ]"
    />

    <h2>By model, last seven days</h2>
    <p v-if="data.snapshot.byModel.items.length === 0" class="muted">No records.</p>
    <UsageTable
      v-else
      :rows="data.snapshot.byModel.items.map((item) => ({ key: String(item.model), label: item.model ?? 'Model not reported', totals: item.totals }))"
      :remainder="data.snapshot.byModel.remainder"
    />

    <h2>By provider, last seven days</h2>
    <p v-if="data.snapshot.byProvider.items.length === 0" class="muted">No records.</p>
    <UsageTable
      v-else
      :rows="data.snapshot.byProvider.items.map((item) => ({ key: String(item.provider), label: item.provider ?? 'Provider not reported by the artifacts', totals: item.totals }))"
      :remainder="data.snapshot.byProvider.remainder"
    />

    <h2>By Task, {{ windowLabel(data.overWindow.importing) }}</h2>
    <p v-if="isUnavailable(data.overWindow.tasks)" class="muted">Not available: {{ data.overWindow.tasks.reason }}</p>
    <template v-else>
      <p v-if="data.overWindow.tasks.items.length === 0" class="muted">No run is attributed to a Task.</p>
      <UsageTable
        v-else
        :rows="data.overWindow.tasks.items.map((item) => ({ key: item.id, label: `${item.id}${item.title === null ? '' : `: ${item.title}`}`, totals: item.totals }))"
        :remainder="data.overWindow.tasks.remainder"
      />
    </template>

    <h2>By role, {{ windowLabel(data.overWindow.importing) }}</h2>
    <RoleUsage :usage="data.overWindow" />

    <h2>Harnesses</h2>
    <ul>
      <li v-for="item in data.snapshot.harnesses" :key="item.harness">
        {{ item.harness }}:
        <template v-if="item.level !== null">level {{ item.level }}, {{ LEVELS[item.level] }}</template>
        <template v-else>no level</template>
        <span v-if="item.reason !== null" class="muted"> · {{ item.reason }}</span>
      </li>
    </ul>

    <h2>Cost</h2>
    <p class="muted">{{ COST_UNAVAILABLE }}</p>
  </template>
</template>

<style scoped>
h2 {
  margin-top: 1.5rem;
  font-size: 1rem;
}
ul {
  padding-left: 1.25rem;
}
</style>
