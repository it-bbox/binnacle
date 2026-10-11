<script setup lang="ts">
import { useLanguage } from '~/composables/language';
import { readLevel, storeLevel, type Level } from '~/widget';

/**
 * The shared widget frame (spec, *A widget with two levels*): a panel with its title and the
 * *Brief* / *Full* control in its header, the level kept per page and widget in the browser.
 * The default slot and the footer get `full`; `title` replaces the plain heading and `aside` sits
 * before the control.
 */
const props = defineProps<{ page: string; widget: string; title?: string }>();
const { t } = useLanguage();

const LEVELS = ['brief', 'full'] as const;
const level = ref<Level>(readLevel(props.page, props.widget));
const choose = (value: Level): void => {
  level.value = value;
  storeLevel(props.page, props.widget, value);
};
const full = computed(() => level.value === 'full');

const panel = { root: 'rounded-[10px]', header: 'flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 px-3.5 py-2.5 sm:px-3.5', body: 'p-0 sm:p-0', footer: 'px-3.5 py-2 sm:px-3.5' };
</script>

<template>
  <UCard :ui="panel">
    <template #header>
      <slot name="title"><h2 class="text-base font-semibold">{{ title }}</h2></slot>
      <div class="ml-auto flex flex-none items-center gap-3">
        <slot name="aside" />
        <UFieldGroup role="group" :aria-label="t.level" size="xs">
          <UButton
            v-for="value in LEVELS"
            :key="value"
            :label="t[value]"
            color="neutral"
            :variant="level === value ? 'soft' : 'ghost'"
            :aria-pressed="level === value"
            @click="choose(value)"
          />
        </UFieldGroup>
      </div>
    </template>
    <slot :full="full" />
    <template v-if="$slots.footer" #footer><slot name="footer" :full="full" /></template>
  </UCard>
</template>
