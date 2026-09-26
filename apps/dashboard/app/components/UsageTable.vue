<script setup lang="ts">
import { FIELDS, tokens, type Totals } from '~/composables/usage';

/** Totals field by field, a row each; no column adds fields together. */
defineProps<{ rows: { key: string; label: string; totals: Totals }[]; remainder?: number }>();
</script>

<template>
  <table>
    <thead>
      <tr>
        <th></th>
        <th>Records</th>
        <th v-for="[name, label] in FIELDS" :key="name">{{ label }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="row in rows" :key="row.key">
        <th>{{ row.label }}</th>
        <td>{{ row.totals.records.toLocaleString('en') }}</td>
        <td v-for="[name] in FIELDS" :key="name" :class="{ muted: row.totals[name].tokens === null }">{{ tokens(row.totals[name]) }}</td>
      </tr>
      <tr v-if="remainder">
        <td :colspan="FIELDS.length + 2" class="muted">and {{ remainder }} more</td>
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
  max-width: 22rem;
  text-align: left;
  font-weight: normal;
  white-space: normal;
}
td[colspan] {
  text-align: left;
}
</style>
