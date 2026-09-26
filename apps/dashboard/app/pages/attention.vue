<script setup lang="ts">
import { useLanguage } from '~/composables/language';
import { initials, isUnavailable, PROJECT_VIEWS, projectName, type Run, type ProjectView } from '~/composables/projects';

/** Every project's attention items, from the shell's views, beside the runs running now and recently in all of them. */
const views = inject(PROJECT_VIEWS, ref(null));
const { t, number } = useLanguage();

type ProjectRun = { view: ProjectView; run: Run };

const activities = computed(() =>
  (views.value ?? []).flatMap((view) => {
    const activity = view.snapshot?.activity;
    return activity === undefined ? [] : [{ view, activity }];
  }),
);
const running = computed((): ProjectRun[] =>
  activities.value.flatMap(({ view, activity }) => (isUnavailable(activity) ? [] : activity.running.items.map((run) => ({ view, run })))),
);
const runningRemainder = computed(() => activities.value.reduce((sum, { activity }) => sum + (isUnavailable(activity) ? 0 : activity.running.remainder), 0));
/** Every project's recent runs, newest first. */
const recent = computed((): ProjectRun[] =>
  activities.value
    .flatMap(({ view, activity }) => (isUnavailable(activity) ? [] : activity.recent.map((run) => ({ view, run }))))
    .sort((a, b) => Date.parse(b.run.lastActivityAt) - Date.parse(a.run.lastActivityAt)),
);
/** The projects whose runs cannot be read, with why. */
const unread = computed(() => activities.value.flatMap(({ view, activity }) => (isUnavailable(activity) ? [{ view, reason: activity.reason }] : [])));

const overview = (view: ProjectView) => ({ path: '/', query: { project: view.project.path } });

const card = { root: 'rounded-[10px]', header: 'flex items-center justify-between gap-2 px-3.5 py-2.5 sm:px-3.5', body: 'p-0 sm:p-0', footer: 'px-3.5 py-2 sm:px-3.5' };
</script>

<template>
  <div class="flex flex-col gap-4.5 pt-4">
    <h1 class="text-lg font-semibold text-highlighted">
      {{ t.attention }} <span class="text-[13px] font-normal text-muted">· {{ t.allProjects }}</span>
    </h1>
    <div v-if="views?.length === 0" class="flex flex-col gap-3">
      <p class="text-muted">{{ t.noProject }}</p>
      <CopyCommand command="binn project register" primary />
    </div>
    <div v-else class="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] items-start gap-5">
      <div class="flex min-w-0 flex-col gap-3.5">
        <UCard v-for="view in views ?? []" :key="view.project.path" :ui="card">
          <template #header>
            <div class="flex min-w-0 items-center gap-2.5">
              <span class="flex size-5.5 flex-none items-center justify-center rounded-md bg-elevated text-[10px] font-semibold">{{ initials(view.project) }}</span>
              <ULink :to="overview(view)" class="truncate font-semibold text-default">{{ projectName(view.project) }}</ULink>
            </div>
            <span v-if="view.snapshot" class="font-mono text-[11.5px] text-dimmed">{{ number(view.snapshot.attention.length) }}</span>
          </template>
          <p v-if="view.project.unavailable !== null" class="px-3.5 py-3">
            <span class="font-medium">{{ t.notAvailable }}</span> <span lang="en" class="text-muted">· {{ view.project.unavailable }}</span>
          </p>
          <p v-else-if="view.failure" class="px-3.5 py-3 text-warning"><code>{{ view.failure.code }}</code> <span lang="en">{{ view.failure.message }}</span></p>
          <template v-else-if="view.snapshot">
            <p v-if="view.snapshot.attention.length === 0" class="px-3.5 py-3 text-muted">{{ t.nothing }}</p>
            <ul v-else class="divide-y divide-default">
              <li v-for="(item, index) in view.snapshot.attention" :key="index" class="flex items-start gap-2 px-3.5 py-2.5">
                <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 flex-none text-warning" />
                <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span class="leading-snug break-words" lang="en">{{ item.message }}</span>
                  <code class="font-mono text-[11px] text-dimmed">{{ item.code }}</code>
                </div>
              </li>
            </ul>
          </template>
        </UCard>
      </div>

      <div class="flex min-w-0 flex-col gap-3.5">
        <UCard :ui="card">
          <template #header>
            <h2 class="text-[13px] font-semibold">{{ t.runningNow }}</h2>
            <span class="font-mono text-[11.5px] text-dimmed">{{ number(running.length + runningRemainder) }}</span>
          </template>
          <p v-if="running.length === 0 && unread.length === 0" class="px-3.5 py-3 text-muted">{{ t.nothing }}</p>
          <ul class="divide-y divide-default">
            <RunRow v-for="{ view, run } in running" :key="view.project.path + run.id" :view="view" :run="run" live />
            <li v-if="runningRemainder > 0" class="px-3.5 py-2.5 text-muted">{{ t.more(number(runningRemainder)) }}</li>
            <li v-for="{ view, reason } in unread" :key="view.project.path" class="px-3.5 py-2.5">
              <span class="text-muted">{{ projectName(view.project) }}</span> · <span class="font-medium">{{ t.notAvailable }}</span>
              <span lang="en" class="text-muted"> · {{ reason }}</span>
            </li>
          </ul>
          <template #footer>
            <p class="text-[11.5px] leading-snug text-dimmed">{{ t.runningReading }}</p>
          </template>
        </UCard>

        <UCard :ui="card">
          <template #header>
            <h2 class="text-[13px] font-semibold">{{ t.recentRuns }}</h2>
          </template>
          <p v-if="recent.length === 0" class="px-3.5 py-3 text-muted">{{ t.nothing }}</p>
          <ul v-else class="divide-y divide-default">
            <RunRow v-for="{ view, run } in recent" :key="view.project.path + run.id" :view="view" :run="run" :live="false" />
          </ul>
        </UCard>
      </div>
    </div>
  </div>
</template>
