<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';
import { useLanguage } from '~/composables/language';
import { attentionCount, projectName, type ProjectView } from '~/composables/projects';

/** The selected project's name and current Epic, the menu (the selected project's pages, then the general ones) and the data's freshness. */
const props = defineProps<{ view: ProjectView | null; views: ProjectView[]; selected: string | null; updatedAt: number | null; unreachable: boolean }>();
const { t, number, secondsAgo } = useLanguage();
const route = useRoute();

/** The roadmap's first Epic not done, or why there is none. */
const epic = computed((): { text: string; muted: boolean; title?: string } | null => {
  const view = props.view;
  if (view === null) return null;
  const snapshot = view.snapshot;
  const reason = view.project.unavailable ?? (view.failure === null ? null : `${view.failure.code}: ${view.failure.message}`);
  if (snapshot === null) return { text: t.value.notAvailable, muted: true, ...(reason === null ? {} : { title: reason }) };
  if (snapshot.roadmap === null) return { text: t.value.noRoadmap, muted: true };
  const current = snapshot.roadmap.epics.find((item) => item.status !== 'done');
  if (current !== undefined) return { text: `${current.number} ${current.title}`, muted: false };
  return { text: snapshot.roadmap.epics.length === 0 ? t.value.noEpics : t.value.everyEpicDone, muted: true };
});

/** Every project's attention items, as the Attention page lists them. */
const attention = computed(() => props.views.reduce((sum, view) => sum + attentionCount(view), 0));

const menu = computed((): NavigationMenuItem[][] => {
  const query = props.selected === null ? {} : { project: props.selected };
  return [
    [
      { label: t.value.overview, icon: 'i-lucide-layout-dashboard', to: { path: '/', query }, active: route.path === '/' },
      { label: t.value.project, icon: 'i-lucide-folder-kanban', to: { path: '/project', query }, active: route.path === '/project' || route.path === '/task' },
      { label: t.value.usage, icon: 'i-lucide-chart-column', to: { path: '/usage', query }, active: route.path === '/usage' },
    ],
    [
      { label: t.value.projects, icon: 'i-lucide-layers', to: { path: '/projects', query }, active: route.path === '/projects' },
      {
        label: t.value.attention,
        icon: 'i-lucide-bell',
        to: { path: '/attention', query },
        active: route.path === '/attention',
        ...(attention.value > 0 ? { badge: { label: number(attention.value), color: 'warning' as const, variant: 'soft' as const } } : {}),
      },
      { label: t.value.settings, icon: 'i-lucide-settings', to: { path: '/settings', query }, active: route.path === '/settings' },
    ],
  ];
});

// Ticks every second, so that the freshness line counts.
const now = ref(Date.now());
let ticker: ReturnType<typeof setInterval> | undefined;
onMounted(() => (ticker = setInterval(() => (now.value = Date.now()), 1000)));
onUnmounted(() => clearInterval(ticker));

const freshness = computed((): { text: string; dot: string } => {
  if (props.updatedAt === null) return { text: t.value.connecting, dot: 'bg-(--ui-text-dimmed)' };
  const since = secondsAgo((now.value - props.updatedAt) / 1000);
  return props.unreachable ? { text: t.value.lastReply(since), dot: 'bg-(--warn)' } : { text: t.value.updated(since), dot: 'bg-success' };
});
</script>

<template>
  <aside class="flex w-55 flex-none flex-col border-r border-default bg-(--sidebar)">
    <div class="flex flex-col gap-2.5 border-b border-default px-3.5 pt-3.5 pb-3">
      <div v-if="view" class="flex min-w-0 flex-col gap-0.5">
        <div class="truncate text-base font-semibold text-highlighted">{{ projectName(view.project) }}</div>
        <div class="truncate font-mono text-xs text-dimmed" :title="view.project.path">{{ view.project.path }}</div>
      </div>
      <div v-else class="text-muted">{{ selected ?? t.noProject }}</div>
      <div v-if="epic" class="flex flex-col gap-0.5">
        <div class="text-xs text-dimmed">{{ t.currentEpic }}</div>
        <div :class="epic.muted ? 'text-sm text-muted' : 'text-sm leading-snug font-medium'" :title="epic.title" :lang="epic.muted ? undefined : 'en'">{{ epic.text }}</div>
      </div>
    </div>
    <UNavigationMenu :items="menu" orientation="vertical" :aria-label="t.menu" class="p-2" />
    <div class="flex-1" />
    <div class="flex items-center gap-1.5 border-t border-default px-3.5 py-3 text-sm text-dimmed">
      <span class="size-1.5 rounded-full" :class="freshness.dot" />
      <span :class="unreachable ? 'text-warning' : ''">{{ freshness.text }}</span>
    </div>
  </aside>
</template>
