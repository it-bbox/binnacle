<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router';
import { useLanguage } from '~/composables/language';
import { LIST_FOLD } from '~/widget';

/**
 * Rows of a label, a bar and its figure, each bar scaled to the largest row. A row with no
 * figure (`value` null) has no bar, never an empty one; its `text` says why. A muted row is one
 * no source names, such as a provider not reported or the unassigned runs. A row's label wraps
 * rather than being cut; its `title`, the repository's text kept English, and its `note`, the
 * page's own, are its tooltip, and are read out to a screen reader. `last` is a
 * row set apart after the remainder, such as the unassigned total below the Tasks. Rows past six
 * fold, with a control after the list that unfolds them in place; the remainder, the rows the
 * daemon left out, shows once nothing is folded.
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
const { t, number, plural } = useLanguage();
const open = ref(false);
const folded = computed(() => !open.value && props.rows.length > LIST_FOLD);
const shown = computed(() => (folded.value ? props.rows.slice(0, LIST_FOLD) : props.rows));
const all = computed(() => (props.last ? [...shown.value, props.last] : shown.value));
const remaining = computed(() => (folded.value ? 0 : (props.remainder ?? 0)));
// Every row's figure, folded ones included, so that unfolding moves no bar.
const largest = computed(() => Math.max(0, ...[...props.rows, ...(props.last ? [props.last] : [])].map((row) => row.value ?? 0)));
</script>

<template>
  <ul>
    <template v-for="(row, index) in all" :key="row.key">
      <!-- The remainder counts the rows, so it goes before `last`. -->
      <li v-if="remaining && index === shown.length" class="px-3.5 py-1.5 text-sm text-muted">{{ t.more(number(remaining)) }}</li>
      <li
        class="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_max-content] items-center gap-3 px-3.5 py-1.5"
        :class="{ 'border-t border-dashed border-default': row.muted }"
        :title="[row.title, row.note].filter(Boolean).join(' · ') || undefined"
      >
        <!-- `relative` keeps the screen-reader text inside the scrolled page, not below the document. -->
        <div class="relative flex min-w-0">
          <ULink v-if="row.to" :to="row.to" class="min-w-0 font-mono text-sm break-words">{{ row.label }}</ULink>
          <span v-else class="min-w-0 text-sm break-words" :class="row.muted ? 'text-muted italic' : 'font-mono'">{{ row.label }}</span>
          <span v-if="row.title || row.note" class="sr-only">
            · <span v-if="row.title" lang="en">{{ row.title }}</span>
            <template v-if="row.title && row.note"> · </template>
            {{ row.note }}
          </span>
        </div>
        <UProgress
          v-if="row.value !== null && largest > 0"
          :model-value="row.value"
          :max="largest"
          :ui="{ base: 'h-1.5', indicator: row.muted ? 'bg-(--ui-text-dimmed)' : undefined }"
        />
        <span v-else />
        <span class="inline-flex items-center justify-end gap-1.5">
          <span class="text-sm" :class="row.value === null ? 'text-dimmed' : 'font-mono'">{{ row.text }}</span>
          <span v-for="mark in row.marks ?? []" :key="mark" class="text-sm text-dimmed">({{ mark }})</span>
        </span>
      </li>
    </template>
    <li v-if="remaining && !last" class="px-3.5 py-1.5 text-sm text-muted">{{ t.more(number(remaining)) }}</li>
    <li v-if="rows.length > LIST_FOLD" class="px-1.5 py-1">
      <UButton
        :label="open ? t.showFewer : plural(rows.length - LIST_FOLD, t.showMore)"
        :aria-expanded="open"
        color="neutral"
        variant="ghost"
        size="xs"
        block
        @click="open = !open"
      />
    </li>
  </ul>
</template>
