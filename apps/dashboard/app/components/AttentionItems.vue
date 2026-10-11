<script setup lang="ts">
import type { Failure } from '~/composables/daemon';
import { BRIEF_ROWS, LIST_FOLD } from '~/widget';

/** Attention items: in *Brief* the first few messages, in *Full* every item with its code; the list folds either way. */
defineProps<{ items: Failure[]; full: boolean }>();
</script>

<template>
  <ul class="divide-y divide-default">
    <FoldedList :items="items" :by="(item) => item.code + item.message" :limit="full ? LIST_FOLD : BRIEF_ROWS">
      <template #default="{ item }">
        <li class="flex items-start gap-2 px-3.5 py-2.5">
          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 flex-none text-(--warn)" />
          <div class="flex min-w-0 flex-1 flex-col gap-0.5">
            <FoldedText class="leading-snug break-words"><DaemonReason :reason="item.message" /></FoldedText>
            <code v-if="full" class="font-mono text-xs text-dimmed">{{ item.code }}</code>
          </div>
        </li>
      </template>
    </FoldedList>
  </ul>
</template>
