<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';
import { useLanguage } from '~/composables/language';

/**
 * Rows of a label, a bar and its figure, each bar scaled to the largest row. A row with no
 * figure (`value` null) has no bar, never an empty one; its `text` says why. A muted row is one
 * no source names, such as a provider not reported or the unassigned runs. `title` is the
 * repository's text, kept English; `note` is the page's own. `last` is a row set apart after
 * the remainder, such as the unassigned total below the Tasks.
 */
export type BarRow = {
  key: string;
  label: string;
  to?: RouteLocationRaw;
  title?: string | null;
  note?: string;
  muted?: boolean;
  value: number | null;
  text: string;
  marks?: string[];
};

const props = defineProps<{ rows: BarRow[]; remainder?: number; last?: BarRow }>();
const { t, number } = useLanguage();
const all = computed(() => (props.last ? [...props.rows, props.last] : props.rows));
const largest = computed(() => Math.max(0, ...all.value.map((row) => row.value ?? 0)));
</script>

<template>
  <ul>
    <template v-for="(row, index) in all" :key="row.key">
      <!-- The remainder counts the rows, so it goes before `last`. -->
      <li v-if="remainder && index === rows.length" class="px-3.5 py-1.5 text-xs text-muted">{{ t.more(number(remainder)) }}</li>
      <li
        class="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_max-content] items-center gap-3 px-3.5 py-1.5"
        :class="{ 'border-t border-dashed border-default': row.muted }"
      >
        <div class="flex min-w-0 flex-col">
          <ULink v-if="row.to" :to="row.to" class="truncate font-mono text-xs">{{ row.label }}</ULink>
          <span v-else class="truncate text-xs" :class="row.muted ? 'text-muted italic' : 'font-mono'">{{ row.label }}</span>
          <span v-if="row.title || row.note" class="truncate text-[11px] text-dimmed" :title="[row.title, row.note].filter(Boolean).join(' · ')">
            <span v-if="row.title" lang="en">{{ row.title }}</span>
            <template v-if="row.title && row.note"> · </template>
            {{ row.note }}
          </span>
        </div>
        <UProgress
          v-if="row.value !== null && largest > 0"
          :model-value="row.value"
          :max="largest"
          size="xs"
          :ui="row.muted ? { indicator: 'bg-(--ui-text-dimmed)' } : undefined"
        />
        <span v-else />
        <span class="inline-flex items-center justify-end gap-1.5">
          <UBadge v-for="mark in row.marks ?? []" :key="mark" :label="mark" color="neutral" variant="outline" size="sm" />
          <span class="text-xs" :class="row.value === null ? 'text-dimmed' : 'font-mono'">{{ row.text }}</span>
        </span>
      </li>
    </template>
    <li v-if="remainder && !last" class="px-3.5 py-1.5 text-xs text-muted">{{ t.more(number(remainder)) }}</li>
  </ul>
</template>
