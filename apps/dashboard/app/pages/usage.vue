<script setup lang="ts">
import RoleUsage from '~/components/RoleUsage.vue';
import UsageTable from '~/components/UsageTable.vue';
import { call, usePolling } from '~/composables/daemon';
import { isUnavailable } from '~/composables/projects';
import { COST_UNAVAILABLE, IMPORTING, windowLabel, type ProjectUsage, type SnapshotUsage } from '~/composables/usage';

const LEVELS: Record<number, string> = { 1: 'Context', 2: 'Attribution', 3: 'Usage' };

const route = useRoute();
const project = typeof route.query.project === 'string' ? route.query.project : null;
// The snapshot answers today and the last seven days; `usage.get` the window, by Task and by role.
const { data, error } = usePolling(async () => {
  if (project === null) return null;
  const [snapshot, window] = await Promise.all([
    call<{ usage: SnapshotUsage }>('project.snapshot', { path: project }),
    call<ProjectUsage>('usage.get', { path: project }),
  ]);
  return { week: snapshot.usage, window };
});
</script>

<template>
  <p v-if="project === null" class="warn">This address names no project. Open its usage from the Overview.</p>
  <p v-else-if="error" class="warn"><code>{{ error.code }}</code> {{ error.message }}</p>
  <p v-else-if="data === null" class="muted">Loading…</p>
  <template v-else>
    <h1>Usage</h1>
    <p class="muted"><code>{{ project }}</code> · tokens as the harnesses' artifacts report them; a field no record reports is not reported, never zero.</p>
    <p v-if="data.week.importing.incomplete || data.window.importing.incomplete" class="warn">{{ IMPORTING }}</p>

    <h2>Today and the last seven days</h2>
    <UsageTable
      :rows="[
        { key: 'today', label: 'Today', totals: data.week.today },
        { key: 'week', label: 'Last seven days', totals: data.week.last7Days },
      ]"
    />

    <h2>By model, last seven days</h2>
    <p v-if="data.week.byModel.items.length === 0" class="muted">No records.</p>
    <UsageTable
      v-else
      :rows="data.week.byModel.items.map((item) => ({ key: String(item.model), label: item.model ?? 'Model not reported', totals: item.totals }))"
      :remainder="data.week.byModel.remainder"
    />

    <h2>By provider, last seven days</h2>
    <p v-if="data.week.byProvider.items.length === 0" class="muted">No records.</p>
    <UsageTable
      v-else
      :rows="data.week.byProvider.items.map((item) => ({ key: String(item.provider), label: item.provider ?? 'Provider not reported by the artifacts', totals: item.totals }))"
      :remainder="data.week.byProvider.remainder"
    />

    <h2>By Task, {{ windowLabel(data.window.importing) }}</h2>
    <p v-if="isUnavailable(data.window.tasks)" class="muted">Not available: {{ data.window.tasks.reason }}</p>
    <template v-else>
      <p v-if="data.window.tasks.items.length === 0" class="muted">No run is attributed to a Task.</p>
      <UsageTable
        v-else
        :rows="data.window.tasks.items.map((item) => ({ key: item.id, label: `${item.id}${item.title === null ? '' : `: ${item.title}`}`, totals: item.totals }))"
        :remainder="data.window.tasks.remainder"
      />
    </template>

    <h2>By role, {{ windowLabel(data.window.importing) }}</h2>
    <RoleUsage :usage="data.window" />

    <h2>Harnesses</h2>
    <ul>
      <li v-for="item in data.week.harnesses" :key="item.harness">
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
