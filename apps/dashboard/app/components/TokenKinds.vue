<script setup lang="ts">
import { useLanguage } from '~/composables/language';
import { FIELDS, marks, type Totals } from '~/composables/usage';

/**
 * Totals kind by kind, a row each, beside one another when there are several: no cell adds
 * kinds together, and reasoning is shown as the part of output it is. A total not reported is
 * said so, never zero, and a partial, calculated or estimated one is marked (ADR-0007). The
 * records row can be left out, for a page that gives the counts elsewhere.
 */
withDefaults(defineProps<{ columns: { key: string; label: string; totals: Totals }[]; records?: boolean }>(), { records: true });
const { t, number } = useLanguage();
</script>

<template>
  <table class="w-full border-collapse text-xs tabular-nums">
    <thead v-if="columns.length > 1">
      <tr class="text-left text-muted">
        <th class="py-1.5 pr-3 font-medium" />
        <th v-for="column in columns" :key="column.key" class="py-1.5 pl-3 text-right font-medium">{{ column.label }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-if="records" class="border-t border-default">
        <th class="py-1.5 pr-3 text-left font-normal text-muted">{{ t.records }}</th>
        <td v-for="column in columns" :key="column.key" class="py-1.5 pl-3 text-right font-mono">{{ number(column.totals.records) }}</td>
      </tr>
      <tr v-for="name in FIELDS" :key="name" class="border-t border-default">
        <th class="py-1.5 pr-3 text-left font-normal text-muted" :class="{ 'pl-3.5': name === 'reasoning' }">{{ t[name] }}</th>
        <td v-for="column in columns" :key="column.key" class="py-1.5 pl-3 text-right">
          <span class="inline-flex items-center justify-end gap-1.5">
            <UBadge v-for="mark in marks(column.totals[name])" :key="mark" :label="t[mark]" color="neutral" variant="outline" size="sm" />
            <span v-if="column.totals[name].tokens === null" class="text-dimmed">{{ t.notReported }}</span>
            <span v-else class="font-mono">{{ number(Math.round(column.totals[name].tokens!)) }}</span>
          </span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
