<script setup lang="ts">
import { FIELDS, tokens, type Totals } from '~/composables/usage';

/**
 * The weekly totals, a row per week, with a CSS bar per field, each scaled to that field's
 * largest week: fields are never added to one another, and a field not reported has no bar.
 */
const props = defineProps<{ weeks: { week: string; totals: Totals }[] }>();

const largest = computed(() => Object.fromEntries(FIELDS.map(([name]) => [name, Math.max(0, ...props.weeks.map((week) => week.totals[name].tokens ?? 0))])));
const width = (name: (typeof FIELDS)[number][0], value: number | null): string =>
  value === null || largest.value[name] === 0 ? '0' : `${(value / largest.value[name]!) * 100}%`;
</script>

<template>
  <table>
    <thead>
      <tr>
        <th>Week of</th>
        <th>Records</th>
        <th v-for="[name, label] in FIELDS" :key="name">{{ label }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="item in weeks" :key="item.week">
        <th>{{ item.week }}</th>
        <td>{{ item.totals.records.toLocaleString('en') }}</td>
        <td v-for="[name] in FIELDS" :key="name" :class="{ muted: item.totals[name].tokens === null }">
          <span class="track"><span class="bar" :style="{ width: width(name, item.totals[name].tokens) }"></span></span>
          {{ tokens(item.totals[name]) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
table {
  display: block;
  overflow-x: auto;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}
th,
td {
  padding: 0.2rem 0.75rem 0.2rem 0;
  text-align: right;
  white-space: nowrap;
  border-bottom: 1px solid var(--line);
}
thead th {
  font-weight: normal;
  color: var(--muted);
}
tbody th {
  text-align: left;
  font-weight: normal;
}
.track {
  display: block;
  width: 6rem;
  height: 0.5rem;
  margin: 0.2rem 0 0.1rem auto;
  background: var(--line);
}
.bar {
  display: block;
  height: 100%;
  background: var(--muted);
}
</style>
