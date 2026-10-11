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
</script>

<template>
  <div class="flex flex-col gap-4.5 pt-4">
    <h1 class="text-xl font-semibold text-highlighted">
      {{ t.attention }} <span class="text-base font-normal text-muted">· {{ t.allProjects }}</span>
    </h1>
    <div v-if="views?.length === 0" class="flex flex-col gap-3">
      <p class="text-muted">{{ t.noProject }}</p>
      <CopyCommand command="binn project register" primary />
    </div>
    <div v-else class="grid grid-cols-2 items-start gap-5">
      <div class="flex min-w-0 flex-col gap-3.5">
        <Widget v-for="view in views ?? []" :key="view.project.path" page="attention" :widget="`project:${view.project.path}`">
          <template #title>
            <div class="flex min-w-0 items-center gap-2.5">
              <span class="flex size-5.5 flex-none items-center justify-center rounded-md bg-accented text-xs font-semibold">{{ initials(view.project) }}</span>
              <ULink :to="overview(view)" class="truncate font-semibold text-default">{{ projectName(view.project) }}</ULink>
            </div>
          </template>
          <template #aside>
            <span v-if="view.snapshot" class="font-mono text-sm text-dimmed">{{ number(view.snapshot.attention.length) }}</span>
          </template>
          <template #default="{ full }">
            <p v-if="view.project.unavailable !== null" class="px-3.5 py-3">
              <span class="font-medium">{{ t.notAvailable }}</span> <span lang="en" class="text-muted">· {{ view.project.unavailable }}</span>
            </p>
            <p v-else-if="view.failure" class="px-3.5 py-3 text-warning"><code>{{ view.failure.code }}</code> <span lang="en">{{ view.failure.message }}</span></p>
            <template v-else-if="view.snapshot">
              <p v-if="view.snapshot.attention.length === 0" class="px-3.5 py-3 text-muted">{{ t.nothing }}</p>
              <AttentionItems v-else :items="view.snapshot.attention" :full="full" />
            </template>
          </template>
        </Widget>
      </div>

      <div class="flex min-w-0 flex-col gap-3.5">
        <Widget page="attention" widget="running" :title="t.runningNow">
          <template #aside>
            <span class="font-mono text-sm text-dimmed">{{ number(running.length + runningRemainder) }}</span>
          </template>
          <template #default="{ full }">
            <p v-if="running.length === 0 && unread.length === 0" class="px-3.5 py-3 text-muted">{{ t.nothing }}</p>
            <ul class="divide-y divide-default">
              <FoldedList :items="running">
                <template #default="{ item: { view, run } }">
                  <RunRow :view="view" :run="run" live :full="full" />
                </template>
              </FoldedList>
              <li v-if="runningRemainder > 0" class="px-3.5 py-2.5 text-muted">{{ t.more(number(runningRemainder)) }}</li>
              <li v-for="{ view, reason } in unread" :key="view.project.path" class="px-3.5 py-2.5">
                <span class="text-muted">{{ projectName(view.project) }}</span> · <span class="font-medium">{{ t.notAvailable }}</span>
                <span class="text-muted"> · <DaemonReason :reason="reason" /></span>
              </li>
            </ul>
          </template>
          <template #footer>
            <p class="text-sm leading-snug text-dimmed">{{ t.runningReading }}</p>
          </template>
        </Widget>

        <Widget page="attention" widget="recent" :title="t.recentRuns">
          <template #default="{ full }">
            <p v-if="recent.length === 0" class="px-3.5 py-3 text-muted">{{ t.nothing }}</p>
            <ul v-else class="divide-y divide-default">
              <FoldedList :items="recent">
                <template #default="{ item: { view, run } }">
                  <RunRow :view="view" :run="run" :live="false" :full="full" />
                </template>
              </FoldedList>
            </ul>
          </template>
        </Widget>
      </div>
    </div>
  </div>
</template>
