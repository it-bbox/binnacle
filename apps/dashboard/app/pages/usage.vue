<script setup lang="ts">
import RoleUsage from '~/components/RoleUsage.vue';
import UsageTable from '~/components/UsageTable.vue';
import WeeklyTrend from '~/components/WeeklyTrend.vue';
import { call, usePolling } from '~/composables/daemon';
import { isUnavailable } from '~/composables/projects';
import { IMPORTING, taskLabel, windowLabel, type ProjectUsage, type SnapshotUsage } from '~/composables/usage';

/** ADR-0014's names for the levels a harness reaches through its artifacts. */
const LEVELS: Record<number, string> = { 1: 'Context', 2: 'Attribution', 3: 'Usage' };

const COST_UNAVAILABLE =
  'Cost is not available: no harness artifact Binnacle reads reports it, and a cost computed from a price table is left for later, since under a subscription such a number is conditional.';

/** How the page labels a derived metric: Binnacle's arithmetic over the records, not a figure any harness reports. */
const DERIVED_READING = "Binnacle's calculation from the same records, not a figure any harness reports.";

const plural = (count: number, one: string, many: string): string => `${count.toLocaleString('en')} ${count === 1 ? one : many}`;
const oneDecimal = (value: number): string => value.toLocaleString('en', { maximumFractionDigits: 1 });

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
        :rows="data.overWindow.tasks.items.map((item) => ({ key: item.id, label: taskLabel(item), totals: item.totals }))"
        :remainder="data.overWindow.tasks.remainder"
      />
    </template>

    <h2>By role, {{ windowLabel(data.overWindow.importing) }}</h2>
    <RoleUsage :usage="data.overWindow" />

    <h2>Tokens per completed Task, {{ windowLabel(data.overWindow.importing) }}</h2>
    <p class="muted">{{ DERIVED_READING }} Each <code>DONE</code> Task with runs, and their mean, field by field.</p>
    <p v-if="isUnavailable(data.overWindow.derived.perCompletedTask)" class="muted">Not available: {{ data.overWindow.derived.perCompletedTask.reason }}</p>
    <template v-else>
      <p v-if="data.overWindow.derived.perCompletedTask.mean === null" class="muted">
        {{
          data.overWindow.derived.perCompletedTask.withoutRuns === 0
            ? 'No Task is DONE.'
            : `No DONE Task has runs (${data.overWindow.derived.perCompletedTask.withoutRuns.toLocaleString('en')} DONE).`
        }}
      </p>
      <UsageTable
        v-else
        :rows="[
          {
            key: 'mean',
            label: 'Mean per Task',
            totals: data.overWindow.derived.perCompletedTask.mean,
          },
          ...data.overWindow.derived.perCompletedTask.items.map((item) => ({
            key: item.id,
            label: `${taskLabel(item)} · ${plural(item.runs, 'run', 'runs')}`,
            totals: item.totals,
          })),
        ]"
        :remainder="data.overWindow.derived.perCompletedTask.remainder"
      />
      <p v-if="data.overWindow.derived.perCompletedTask.mean !== null && data.overWindow.derived.perCompletedTask.withoutRuns > 0" class="muted">
        {{ plural(data.overWindow.derived.perCompletedTask.withoutRuns, 'DONE Task has', 'DONE Tasks have') }} no runs, and the mean leaves them out.
      </p>
    </template>

    <h2>Runs per Task, {{ windowLabel(data.overWindow.importing) }}</h2>
    <p class="muted">{{ DERIVED_READING }} Each Task with runs, of any state, and how many of its runs were subagents'.</p>
    <p v-if="isUnavailable(data.overWindow.derived.runsPerTask)" class="muted">Not available: {{ data.overWindow.derived.runsPerTask.reason }}</p>
    <p v-else-if="data.overWindow.derived.runsPerTask.mean === null" class="muted">No run is attributed to a Task.</p>
    <table v-else>
      <thead>
        <tr>
          <th></th>
          <th>Runs</th>
          <th>of which subagents'</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <th>Mean per Task</th>
          <td>{{ oneDecimal(data.overWindow.derived.runsPerTask.mean.runs) }}</td>
          <td>{{ oneDecimal(data.overWindow.derived.runsPerTask.mean.subagentRuns) }}</td>
        </tr>
        <tr v-for="item in data.overWindow.derived.runsPerTask.items" :key="item.id">
          <th>{{ taskLabel(item) }}</th>
          <td>{{ item.runs.toLocaleString('en') }}</td>
          <td>{{ item.subagentRuns.toLocaleString('en') }}</td>
        </tr>
        <tr v-if="data.overWindow.derived.runsPerTask.remainder">
          <td colspan="3" class="muted">and {{ data.overWindow.derived.runsPerTask.remainder }} more</td>
        </tr>
      </tbody>
    </table>

    <h2>Weekly trend, {{ windowLabel(data.overWindow.importing) }}</h2>
    <p class="muted">{{ DERIVED_READING }} Calendar weeks from Monday, in the daemon's time zone. Each field's bars are scaled to its own largest week.</p>
    <p v-if="data.overWindow.derived.weekly.items.length === 0" class="muted">No records.</p>
    <WeeklyTrend v-else :weeks="data.overWindow.derived.weekly.items" />

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
table {
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
th,
td {
  padding: 0.2rem 0.75rem 0.2rem 0;
  text-align: right;
  border-bottom: 1px solid var(--line);
}
thead th {
  font-weight: normal;
  color: var(--muted);
}
tbody th {
  max-width: 22rem;
  text-align: left;
  font-weight: normal;
}
td[colspan] {
  text-align: left;
}
</style>
