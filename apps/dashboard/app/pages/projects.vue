<script setup lang="ts">
import { useLanguage } from '~/composables/language';
import { count, currentEpic, gitLine, initials, isUnavailable, PROJECT_VIEWS, projectName, statusBadge, type ProjectView } from '~/composables/projects';

/** Every registered project, from the shell's views: its current Epic, Next action, runs, attention and checkout. */
const views = inject(PROJECT_VIEWS, ref(null));
const { t, number, since } = useLanguage();

const rows = computed(() =>
  (views.value ?? []).map((view: ProjectView) => {
    const snapshot = view.snapshot;
    const activity = snapshot?.activity;
    const known = activity !== undefined && !isUnavailable(activity);
    const latest = known ? (activity.running.items[0] ?? activity.recent[0]) : undefined;
    return {
      view,
      snapshot,
      epic: snapshot === null ? null : currentEpic(snapshot),
      running: known ? count(activity.running) : null,
      latest: known ? (latest === undefined ? t.value.noRunsSeen : t.value.latest(since(latest.lastActivityAt))) : null,
      activityReason: activity !== undefined && isUnavailable(activity) ? activity.reason : null,
    };
  }),
);

const cell = 'border-b border-default px-3.5 py-2.5 align-top';
</script>

<template>
  <div class="flex flex-col gap-4 pt-4">
    <h1 class="text-lg font-semibold text-highlighted">{{ t.projects }}</h1>
    <div v-if="views?.length === 0" class="flex flex-col gap-3">
      <p class="text-muted">{{ t.noProject }}</p>
      <CopyCommand command="binn project register" primary />
    </div>
    <div v-else class="overflow-auto rounded-[10px] border border-default bg-default">
      <table class="w-full table-fixed border-collapse">
        <colgroup>
          <col class="w-[29%]" />
          <col class="w-[19%]" />
          <col class="w-[25%]" />
          <col class="w-[13%]" />
          <col class="w-[14%]" />
        </colgroup>
        <thead>
          <tr class="text-left text-xs text-muted">
            <th class="border-b border-default px-3.5 py-2 font-medium">{{ t.project }}</th>
            <th class="border-b border-default px-3.5 py-2 font-medium">{{ t.currentEpic }}</th>
            <th class="border-b border-default px-3.5 py-2 font-medium">Next action</th>
            <th class="border-b border-default px-3.5 py-2 font-medium">{{ t.runningNow }}</th>
            <th class="border-b border-default px-3.5 py-2 font-medium">{{ t.attention }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.view.project.path">
            <td :class="cell">
              <div class="flex items-center gap-2.5">
                <span class="flex size-6.5 flex-none items-center justify-center rounded-md bg-accented text-[11px] font-semibold">{{ initials(row.view.project) }}</span>
                <div class="flex min-w-0 flex-col gap-0.5">
                  <ULink :to="{ path: '/', query: { project: row.view.project.path } }" class="font-medium wrap-anywhere text-default">{{ projectName(row.view.project) }}</ULink>
                  <span class="font-mono text-[11px] break-all text-dimmed">{{ row.view.project.path }}</span>
                  <span v-if="row.snapshot" class="font-mono text-[11px] wrap-anywhere text-dimmed" :title="t.registeredCheckout">{{ gitLine(row.snapshot.git, t) }}</span>
                </div>
              </div>
            </td>
            <td v-if="row.view.project.unavailable !== null" :class="cell" colspan="4">
              <span class="font-medium">{{ t.notAvailable }}</span> <span lang="en" class="wrap-anywhere text-muted">· {{ row.view.project.unavailable }}</span>
            </td>
            <td v-else-if="row.view.failure" :class="cell" colspan="4" class="text-warning">
              <code>{{ row.view.failure.code }}</code> <span lang="en">{{ row.view.failure.message }}</span>
            </td>
            <template v-else-if="row.snapshot">
              <td :class="cell">
                <div v-if="row.snapshot.roadmap === null" class="flex flex-col gap-0.5">
                  <span class="font-medium">{{ t.notAvailable }}</span>
                  <span class="text-xs text-muted">{{ t.noRoadmap }}</span>
                </div>
                <div v-else-if="row.epic" class="flex flex-col items-start gap-1">
                  <span lang="en">{{ row.epic.number }} {{ row.epic.title }}</span>
                  <UBadge :label="row.epic.status" v-bind="statusBadge(row.epic.status)" size="sm" lang="en" />
                </div>
                <span v-else class="text-muted">{{ row.snapshot.roadmap.epics.length === 0 ? t.noEpics : t.everyEpicDone }}</span>
              </td>
              <td :class="cell">
                <span v-if="row.snapshot.next.action" lang="en" class="line-clamp-2 leading-snug text-muted" :title="row.snapshot.next.action.description">
                  {{ row.snapshot.next.action.description }}
                </span>
                <span v-else class="text-dimmed">{{ t.none }}</span>
              </td>
              <td :class="cell">
                <div v-if="row.running === null" class="flex flex-col gap-0.5">
                  <span class="font-medium">{{ t.notAvailable }}</span>
                  <DaemonReason v-if="row.activityReason !== null" class="text-[11px] leading-snug text-dimmed" :reason="row.activityReason" />
                </div>
                <div v-else class="flex flex-col gap-0.5">
                  <span class="inline-flex items-center gap-1.5 font-mono text-xs">
                    <span class="size-1.5 rounded-full" :class="row.running > 0 ? 'bg-success' : 'bg-accented'" />{{ number(row.running) }}
                  </span>
                  <span class="text-[11px] text-dimmed">{{ row.latest }}</span>
                </div>
              </td>
              <td :class="cell">
                <UBadge
                  :label="number(row.snapshot.attention.length)"
                  :color="row.snapshot.attention.length > 0 ? 'warning' : 'neutral'"
                  variant="soft"
                  size="sm"
                  class="font-mono"
                />
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
