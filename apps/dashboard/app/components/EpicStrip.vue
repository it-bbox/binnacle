<script setup lang="ts">
import { useLanguage } from '~/composables/language';
import { wordFor } from '~/composables/projects';

/**
 * The roadmap's epics as a strip: twenty across its width, scrolling past them, centred on the
 * current epic when it opens, is resized or the current epic changes, and faded at an edge with
 * more beyond. The current epic is half filled in the accent, so that it stands apart from the
 * done ones.
 */
const props = defineProps<{ steps: { epic: { number: number; title: string; status: string }; step: 'current' | 'done' | 'later' }[] }>();
const { t } = useLanguage();
const strip = ref<HTMLElement | null>(null);
const edges = ref({ start: false, end: false });

const measure = (): void => {
  const el = strip.value;
  if (el !== null) edges.value = { start: el.scrollLeft > 1, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 };
};
const centre = (): void => {
  const el = strip.value;
  const at = el?.querySelector<HTMLElement>('[aria-current]');
  if (el && at) el.scrollLeft = at.offsetLeft - (el.clientWidth - at.offsetWidth) / 2;
  measure();
};
const fade = computed(() => {
  const { start, end } = edges.value;
  if (!start && !end) return undefined;
  return { maskImage: `linear-gradient(to right, ${start ? 'transparent' : '#000'}, #000 2rem, #000 calc(100% - 2rem), ${end ? 'transparent' : '#000'})` };
});

watch(() => [props.steps.find(({ step }) => step === 'current')?.epic.number, props.steps.length], centre, { flush: 'post' });
let observer: ResizeObserver | undefined;
onMounted(() => {
  if (strip.value === null) return;
  centre();
  observer = new ResizeObserver(centre);
  observer.observe(strip.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <ol
    ref="strip"
    class="relative flex gap-1 overflow-x-auto [scrollbar-color:var(--ui-border-accented)_transparent] [scrollbar-width:thin]"
    :class="{ 'pb-1.5': edges.start || edges.end }"
    :style="fade"
    lang="en"
    @scroll.passive="measure"
  >
    <li
      v-for="{ epic, step } in steps"
      :key="epic.number"
      :title="`${epic.number} ${epic.title} · ${wordFor(t.roadmapStatuses, epic.status)}`"
      :aria-current="step === 'current' ? 'step' : undefined"
      class="flex min-w-0 shrink-0 grow basis-[calc((100%-4.75rem)/20)] flex-col gap-1"
    >
      <div v-if="step === 'current'" class="h-1 rounded-sm bg-accented"><div class="h-full w-1/2 rounded-sm bg-primary" /></div>
      <div v-else class="h-1 rounded-sm" :class="step === 'done' ? 'bg-(--ui-text-muted)' : 'bg-accented'" />
      <span class="font-mono text-xs" :class="step === 'current' ? 'font-semibold text-primary' : step === 'done' ? 'text-muted' : 'text-dimmed'">{{ epic.number }}</span>
    </li>
  </ol>
</template>
