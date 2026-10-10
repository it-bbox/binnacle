<script setup lang="ts">
import { useLanguage } from '~/composables/language';
import { attentionCount, count, initials, isUnavailable, projectName, type ProjectView } from '~/composables/projects';

/** The project rail: one icon per registered project, and "+" to show how to add one. Nothing is registered from here. */
const props = defineProps<{ views: ProjectView[]; selected: string | null }>();
const { t, plural } = useLanguage();
const route = useRoute();
const adding = ref(false);

const running = (view: ProjectView): number => {
  const activity = view.snapshot?.activity;
  return activity === undefined || isUnavailable(activity) ? 0 : count(activity.running);
};

const rail = computed(() =>
  props.views.map((view) => {
    const name = projectName(view.project);
    const runs = running(view);
    const items = attentionCount(view);
    const counts = [runs > 0 ? plural(runs, t.value.runsRunning) : null, items > 0 ? plural(items, t.value.attentionItems) : null];
    return {
      view,
      initials: initials(view.project),
      title: [name, ...counts.filter((count) => count !== null)].join(' · '),
      selected: view.project.path === props.selected,
      dot: runs > 0 || items > 0,
      // A running project's dot is green; one that only needs attention, amber.
      color: runs > 0 ? ('success' as const) : ('warning' as const),
      // The Task page belongs to one project, so switching leaves it for that project's Overview.
      to: { path: route.path === '/task' ? '/' : route.path, query: { project: view.project.path } },
    };
  }),
);
</script>

<template>
  <nav :aria-label="t.projectRail" class="flex w-14 flex-none flex-col items-center gap-2 border-r border-default bg-(--rail) py-3">
    <UIcon name="i-lucide-compass" class="mb-1.5 size-5.5 text-primary" title="Binnacle" />
    <UChip v-for="item in rail" :key="item.view.project.path" :show="item.dot" :color="item.color" size="lg" :ui="{ base: 'ring-(--rail)' }">
      <UButton
        :to="item.to"
        :title="item.title"
        :aria-label="item.title"
        :aria-current="item.selected ? 'page' : undefined"
        :color="item.selected ? 'primary' : 'neutral'"
        :variant="item.selected ? 'soft' : 'outline'"
        class="size-9 justify-center text-xs font-semibold"
        :class="item.selected ? 'ring ring-primary' : ''"
      >
        {{ item.initials }}
      </UButton>
    </UChip>
    <div class="flex-1" />
    <UButton icon="i-lucide-plus" color="neutral" variant="ghost" class="size-9 justify-center" :title="t.addProject" :aria-label="t.addProject" @click="adding = true" />
    <UModal v-model:open="adding" :title="t.addProject">
      <template #body>
        <div class="flex flex-col gap-3">
          <p class="text-muted">{{ t.addBody }}</p>
          <CopyCommand command="binn project register" primary />
          <p class="text-xs text-dimmed">{{ t.addNote }}</p>
        </div>
      </template>
    </UModal>
  </nav>
</template>
