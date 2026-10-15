<script setup lang="ts">
import { useLanguage } from '~/composables/language';
import { count, gitLine, initials, isUnavailable, PROJECT_VIEWS, projectName, statusBadge, unregisterCommand, type ProjectView } from '~/composables/projects';

/**
 * Every registered project, from the shell's views. *Brief* gives each its name, current Epic, Next
 * action on one line, runs running and attention count; *Full* adds its path, checkout, the Epic's
 * status, a second line of Next action and the latest activity. A project whose directory is gone,
 * left off every other page, is one row here with the command that removes its registration.
 */
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
      epic: snapshot?.roadmap?.current ?? null,
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
    <h1 class="text-xl font-semibold text-highlighted">{{ t.projects }}</h1>
    <div v-if="views?.length === 0" class="flex flex-col gap-3">
      <p class="text-muted">{{ t.noProject }}</p>
      <CopyCommand command="binn project register" primary />
    </div>
    <Widget v-else page="projects" widget="projects" :title="t.projectRail">
      <template #default="{ full }">
        <div class="overflow-auto">
          <table class="w-full table-fixed border-collapse">
            <colgroup>
              <col class="w-[29%]" />
              <col class="w-[19%]" />
              <col class="w-[25%]" />
              <col class="w-[13%]" />
              <col class="w-[14%]" />
            </colgroup>
            <thead>
              <tr class="text-left text-sm text-muted">
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
                    <span class="flex size-6.5 flex-none items-center justify-center rounded-md bg-accented text-xs font-semibold">{{ initials(row.view.project) }}</span>
                    <div class="flex min-w-0 flex-col gap-0.5">
                      <span v-if="row.view.project.gone" class="font-medium wrap-anywhere text-muted">{{ projectName(row.view.project) }}</span>
                      <ULink v-else :to="{ path: '/', query: { project: row.view.project.path } }" class="font-medium wrap-anywhere text-default">{{ projectName(row.view.project) }}</ULink>
                      <span v-if="full" class="font-mono text-xs break-all text-dimmed">{{ row.view.project.path }}</span>
                      <span v-if="full && row.snapshot" class="font-mono text-xs wrap-anywhere text-dimmed" :title="t.registeredCheckout">{{ gitLine(row.snapshot.git, t) }}</span>
                    </div>
                  </div>
                </td>
                <td v-if="row.view.project.gone" :class="cell" colspan="4">
                  <div class="flex flex-col items-start gap-1.5">
                    <span class="text-muted">{{ t.directoryGone }}</span>
                    <CopyCommand :command="unregisterCommand(row.view.project.path)" />
                  </div>
                </td>
                <td v-else-if="row.view.project.unavailable !== null" :class="cell" colspan="4">
                  <span class="font-medium">{{ t.notAvailable }}</span> <span lang="en" class="wrap-anywhere text-muted">· {{ row.view.project.unavailable }}</span>
                </td>
                <td v-else-if="row.view.failure" :class="cell" colspan="4" class="text-warning">
                  <code>{{ row.view.failure.code }}</code> <span lang="en">{{ row.view.failure.message }}</span>
                </td>
                <template v-else-if="row.snapshot">
                  <td :class="cell">
                    <div v-if="row.snapshot.roadmap === null" class="flex flex-col gap-0.5">
                      <span class="font-medium">{{ t.notAvailable }}</span>
                      <span class="text-sm text-muted">{{ t.noRoadmap }}</span>
                    </div>
                    <div v-else-if="row.epic" class="flex flex-col items-start gap-1">
                      <span lang="en">{{ row.epic.number }} {{ row.epic.title }}</span>
                      <UBadge v-if="full" :label="row.epic.status" v-bind="statusBadge(row.epic.status)" size="sm" lang="en" />
                    </div>
                    <span v-else class="text-muted">{{ row.snapshot.roadmap.epics.length === 0 ? t.noEpics : t.everyEpicDone }}</span>
                  </td>
                  <td :class="cell">
                    <span v-if="row.snapshot.next.action" lang="en" :class="full ? 'line-clamp-2' : 'line-clamp-1'" class="leading-snug text-muted" :title="row.snapshot.next.action.description">
                      {{ row.snapshot.next.action.description }}
                    </span>
                    <span v-else class="text-dimmed">{{ t.none }}</span>
                  </td>
                  <td :class="cell">
                    <div v-if="row.running === null" class="flex flex-col gap-0.5">
                      <span class="font-medium">{{ t.notAvailable }}</span>
                      <DaemonReason v-if="row.activityReason !== null" class="text-xs leading-snug text-dimmed" :reason="row.activityReason" />
                    </div>
                    <div v-else class="flex flex-col gap-0.5">
                      <span class="inline-flex items-center gap-1.5 font-mono text-sm">
                        <span class="size-1.5 rounded-full" :class="row.running > 0 ? 'bg-success' : 'bg-accented'" />{{ number(row.running) }}
                      </span>
                      <span v-if="full" class="text-xs text-dimmed">{{ row.latest }}</span>
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
      </template>
    </Widget>
  </div>
</template>
