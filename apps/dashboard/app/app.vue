<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import { REFRESH_MS, useAuthorised, usePolling } from '~/composables/daemon';
import { useLanguage } from '~/composables/language';
import { loadProjects, PROJECT_VIEWS, SELECTED_VIEW } from '~/composables/projects';

/**
 * The shell: the project rail, the sidebar and the page. It polls the registered projects'
 * snapshots for the rail and the sidebar: the selected project's on every poll, every
 * project's on the pages that list them all, and the others' every `OTHERS_EVERY` polls, so
 * that the daemon is not asked for every snapshot every 15 seconds. The first load shows the
 * selected project's before it reads the others'. It stands in for the page while the daemon
 * loads or does not answer, polling on until it does.
 */
const authorised = useAuthorised();
const { language, t, uiLocale, plural } = useLanguage();
useHead({ htmlAttrs: { lang: language } });

// The selected project is the address's `project`; without one, the first registered project, written into the address.
const route = useRoute();
const router = useRouter();
const selected = computed(() => (typeof route.query.project === 'string' ? route.query.project : null));
const listsAll = computed(() => route.path === '/projects' || route.path === '/attention');

/** A minute, at 15 seconds a poll. */
const OTHERS_EVERY = 4;
let polls = 0;
const updatedAt = ref<number | null>(null);
const { data, error, refresh } = usePolling(async () => {
  const all = polls++ % OTHERS_EVERY === 0 || listsAll.value;
  const own = selected.value;
  if (data.value === null && !listsAll.value && own !== null) {
    const first = await loadProjects(null, (path) => path === own);
    if (data.value === null) data.value = first;
    updatedAt.value = Date.now();
    return await loadProjects(first, (path) => path !== own);
  }
  const views = await loadProjects(data.value, (path) => all || path === own);
  updatedAt.value = Date.now();
  return views;
});
// Another project, or a page that lists them all, is read at once rather than at the next poll.
watch(selected, () => void refresh());
watch(listsAll, (all) => all && void refresh());
const unreachable = computed(() => error.value?.code === 'daemon.unreachable');
// A project whose directory is gone is left off every page but Projects, which lists it with the command that removes it.
const present = computed(() => data.value?.filter((item) => !item.project.gone) ?? []);
const view = computed(() => present.value.find((item) => item.project.path === selected.value) ?? null);
provide(SELECTED_VIEW, view);
provide(PROJECT_VIEWS, data);
watchEffect(() => {
  const first = present.value[0];
  const gone = data.value?.some((item) => item.project.gone && item.project.path === selected.value) ?? false;
  if ((selected.value === null || gone) && first !== undefined) void router.replace({ query: { ...route.query, project: first.project.path } });
  else if (gone) {
    const { project: _gone, ...rest } = route.query;
    void router.replace({ query: rest });
  }
});

/** A page is rebuilt for another project or Task, and keeps itself across the Project page's own query changes. */
const pageKey = (page: RouteLocationNormalizedLoaded): string => `${page.path}|${String(page.query.project)}|${String(page.query.id)}`;
</script>

<template>
  <UApp :locale="uiLocale">
    <div v-if="!authorised" class="flex min-h-screen items-center justify-center p-10">
      <div class="flex flex-col gap-3">
        <p>{{ t.signin }}</p>
        <CopyCommand command="binn dashboard" primary />
      </div>
    </div>
    <div v-else class="flex h-screen min-w-[1024px] overflow-hidden">
      <ShellRail :views="present" :selected="selected" />
      <ShellSidebar :view="view" :views="present" :selected="selected" :updated-at="updatedAt" :unreachable="unreachable" />
      <main class="min-w-0 flex-1 overflow-auto">
        <div v-if="unreachable" class="flex min-h-full items-center justify-center px-8 py-10">
          <div class="flex w-full max-w-[520px] flex-col gap-4 rounded-xl border border-default bg-default p-8">
            <div class="flex size-9 items-center justify-center rounded-lg bg-(--warn-soft) text-(--warn)">
              <UIcon name="i-lucide-triangle-alert" class="size-4.5" />
            </div>
            <div class="flex flex-col gap-1.5">
              <h1 class="text-lg font-semibold text-highlighted">{{ t.daemonTitle }}</h1>
              <p class="leading-normal text-muted">{{ t.daemonBody }}</p>
            </div>
            <CopyCommand command="binn daemon start" primary />
            <p class="text-sm text-dimmed">{{ plural(REFRESH_MS / 1000, t.retrying) }}</p>
          </div>
        </div>
        <div v-else-if="data === null && error === null" class="flex flex-col gap-6 px-8 pt-7" :aria-label="t.loading" aria-busy="true">
          <div class="flex flex-col gap-4 rounded-xl border border-default p-8">
            <USkeleton class="h-4.5 w-30" />
            <USkeleton class="h-3.5 w-[70%]" />
            <USkeleton class="h-10.5 w-full" />
            <USkeleton class="h-3.5 w-[45%]" />
          </div>
          <USkeleton class="h-10 w-full" />
          <div class="grid grid-cols-2 gap-5">
            <USkeleton class="h-55" />
            <USkeleton class="h-55" />
          </div>
          <p class="text-sm text-dimmed">{{ t.loading }}</p>
        </div>
        <div v-else class="px-8 pt-3 pb-14">
          <p v-if="error" class="my-3 text-warning">{{ t.failed }} <code>{{ error.code }}</code> {{ error.message }}</p>
          <!-- Held back while the first project is being written into the address, so that no page opens without it. -->
          <NuxtPage v-if="selected !== null || present.length === 0" :page-key="pageKey" />
        </div>
      </main>
    </div>
  </UApp>
</template>
