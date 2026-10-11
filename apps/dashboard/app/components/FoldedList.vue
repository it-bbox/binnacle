<script setup lang="ts" generic="T">
import { useLanguage } from '~/composables/language';
import { LIST_FOLD } from '~/widget';

/** A list's rows, each keyed by `by`, folded after `limit` with a row that unfolds them in place; the caller's `<ul>` holds them. */
const props = withDefaults(defineProps<{ items: T[]; by: (item: T) => string; limit?: number }>(), { limit: LIST_FOLD });
const { t, plural } = useLanguage();
const open = ref(false);
const shown = computed(() => (open.value ? props.items : props.items.slice(0, props.limit)));
</script>

<template>
  <template v-for="item in shown" :key="by(item)"><slot :item="item" /></template>
  <li v-if="items.length > limit" class="px-1.5 py-1">
    <UButton
      :label="open ? t.showFewer : plural(items.length - limit, t.showMore)"
      :aria-expanded="open"
      color="neutral"
      variant="ghost"
      size="xs"
      block
      @click="open = !open"
    />
  </li>
</template>
