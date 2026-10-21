<script setup lang="ts">
import { call, usePolling } from '~/composables/daemon';
import { useLanguage } from '~/composables/language';
import { pairReason } from '~/i18n';
import { count, isUnavailable, runRole, wordFor, SELECTED_VIEW, statusBadge, type Alternative, type Board, type ConflictRisk } from '~/composables/projects';
import type { Totals } from '~/composables/usage';

/**
 * The selected project's Overview: what's next, the epics' progress, Ready to start with the
 * conflict risk beside the parallel limit, what is running, attention and a line of usage. The
 * snapshot is the shell's, each epic with its count; the current epic's board is polled here for
 * its Tasks waiting on an Unmet dependency.
 */
const view = inject(SELECTED_VIEW, ref(null));
const snapshot = computed(() => view.value?.snapshot ?? null);
const route = useRoute();
const project = typeof route.query.project === 'string' ? route.query.project : null;
const { t, language, number, list, secondsAgo } = useLanguage();

const board = usePolling(async () => (project === null ? null : call<Board>('task.list', { path: project })));

/** The attention items that say why a section is empty: those whose code starts with `prefix`. */
const reasons = (prefix: string) => snapshot.value?.attention.filter((item) => item.code.startsWith(prefix)) ?? [];
// Without a readable manifest there is no roadmap item, and the tracker's says why.
const roadmapReasons = computed(() => {
  const own = reasons('roadmap.');
  return own.length > 0 ? own : reasons('tracker.');
});
const trackerReasons = computed(() => reasons('tracker.'));
/** `next_action.missing` or `next_action.stale`, shown inside What's next. */
const nextActionWarnings = computed(() => reasons('next_action.'));

/** The alternatives, each with its title and reason written by the page in its language from `kind` and `tasks`. */
const alternatives = computed(() => {
  const next = snapshot.value?.next.alternatives;
  if (!Array.isArray(next)) return [];
  return next.map((alternative) => ({ ...alternative, ...t.value.alternatives[alternative.kind](list(alternative.tasks), alternative.tasks.length) }));
});
/** Written out, so that the build bundles each icon. */
const ICONS: Record<Alternative['kind'], string> = {
  wait: 'i-lucide-hourglass',
  parallel: 'i-lucide-split',
  resume: 'i-lucide-step-forward',
  autopilot: 'i-lucide-route',
  byHand: 'i-lucide-terminal',
  owner: 'i-lucide-user',
  blocked: 'i-lucide-lock',
  close: 'i-lucide-circle-check',
  plan: 'i-lucide-list-todo',
  finished: 'i-lucide-flag',
};

/** The roadmap's epics as steps: done, the current one (the daemon's), and the others not done. */
const steps = computed(() => {
  const roadmap = snapshot.value?.roadmap;
  return (roadmap?.epics ?? []).map((epic) => ({ epic, step: epic.number === roadmap?.current?.number ? 'current' : epic.status === 'done' ? 'done' : 'later' }));
});
const current = computed(() => snapshot.value?.roadmap?.current ?? null);

/** The current epic's Tasks done out of all of them, `CANCELLED` left out; null without a spec or readable Tasks. */
const progress = computed(() => current.value?.progress ?? null);

/** No Tasks in the project, or none in its current epic; the tracker's attention items say why, when it has any. */
const noTasks = computed((): boolean => {
  const tasks = snapshot.value?.tasks;
  if (!tasks) return false;
  const all = count(tasks.inFlight) + count(tasks.readyToStart) + Object.values(tasks.counts).reduce((sum, value) => sum + value, 0);
  return all === 0 || (current.value !== null && (progress.value?.all ?? 0) === 0);
});

/** The current epic's `READY` Tasks that wait on an Unmet dependency. */
const waiting = computed(() => board.data.value?.columns.ready.items.filter((card) => card.unmetDependencies.length > 0) ?? []);

/** A dependency by its number when it is in the Task's own spec, by its whole id otherwise. */
function dependency(task: string, id: string): string {
  const spec = task.slice(0, task.lastIndexOf('/') + 1);
  return spec !== '' && id.startsWith(spec) ? id.slice(spec.length) : id;
}

/** "Up to {free} can run in parallel", when something is free and either two Tasks are ready or one is in progress. */
const parallel = computed((): string | null => {
  const tasks = snapshot.value?.tasks;
  if (!tasks) return null;
  const ready = count(tasks.readyToStart);
  const { free, inProgress } = tasks.parallel;
  return free >= 1 && (ready >= 2 || inProgress >= 1) ? t.value.inParallel(number(free)) : null;
});

/** A pair's risk badge: the higher the risk, the louder; unknown is never shown as low. */
const RISK_COLORS = { high: 'error', medium: 'warning', low: 'success', unknown: 'neutral' } as const satisfies Record<ConflictRisk, string>;

const lastActivity = (timestamp: string): string => secondsAgo((Date.now() - Date.parse(timestamp)) / 1000);

/** Output tokens as the line shows them: none recorded, not reported, or the total, marked when partial. */
function outputTokens(totals: Totals): string {
  if (totals.records === 0) return t.value.noRecords;
  const { tokens, partial } = totals.output;
  if (tokens === null) return t.value.noData;
  return partial ? `${number(tokens)} (${t.value.partial})` : number(tokens);
}
</script>

<template>
  <div class="flex flex-col gap-7 pt-4">
    <div v-if="view === null" class="flex flex-col gap-3 py-10">
      <p class="text-muted">{{ project === null ? t.noProject : t.unknownProject }}</p>
      <CopyCommand v-if="project === null" command="binn project register" primary />
    </div>
    <p v-else-if="view.project.unavailable !== null" class="py-10 text-muted">
      <span class="font-medium text-default">{{ t.notAvailable }}</span> · <span lang="en">{{ view.project.unavailable }}</span>
    </p>
    <p v-else-if="view.failure" class="py-10 text-warning"><DaemonReason :said="view.failure" /></p>
    <template v-else-if="snapshot">
      <UCard :ui="{ root: 'rounded-[10px]', body: 'flex flex-col gap-3 px-3.5 py-3 sm:px-3.5 sm:py-3' }">
        <h1 class="text-base font-semibold">{{ t.whatsNext }}</h1>
        <div v-if="snapshot.roadmap === null" class="flex flex-col gap-2.5">
          <div class="flex items-center gap-2">
            <UBadge :label="t.notAvailable" color="neutral" variant="outline" class="border-dashed" />
            <span class="font-medium">{{ t.noRoadmap }}</span>
          </div>
          <p v-for="item in roadmapReasons" :key="item.code + item.message" class="text-sm leading-normal text-muted">
            <DaemonReason :said="item" />
          </p>
        </div>
        <div v-else class="flex flex-col gap-2.5">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge :label="t.nextAction" color="primary" variant="soft" />
            <span class="text-sm text-muted">{{ t.fromRoadmap }}</span>
          </div>
          <template v-if="snapshot.next.action">
            <p class="max-w-[70ch] leading-normal whitespace-pre-wrap" lang="en">{{ snapshot.next.action.description }}</p>
            <CopyCommand :command="snapshot.next.action.command" primary />
          </template>
          <UAlert
            v-for="item in nextActionWarnings"
            :key="item.code"
            color="warning"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :title="item.code === 'next_action.stale' ? t.nextActionStale : t.nextActionMissing"
          />
        </div>
        <p v-if="isUnavailable(snapshot.next.alternatives)" class="text-muted">
          <span class="font-medium text-default">{{ t.notAvailable }}</span> · <DaemonReason :said="snapshot.next.alternatives" />
        </p>
        <div v-else-if="alternatives.length > 0" class="flex flex-col">
          <div class="mb-1.5 flex items-center gap-2.5">
            <span class="font-semibold text-muted">{{ t.or }}</span>
            <span class="text-sm text-dimmed">({{ t.estimate }})</span>
            <div class="h-px flex-1 bg-(--ui-border)" />
          </div>
          <div
            v-for="alternative in alternatives"
            :key="alternative.kind"
            class="grid grid-cols-[28px_minmax(0,1fr)] gap-x-2.5 gap-y-1 border-t border-default py-2.5"
          >
            <div class="flex size-[26px] items-center justify-center rounded-[7px] bg-accented text-muted">
              <UIcon :name="ICONS[alternative.kind]" class="size-3.5" />
            </div>
            <div class="flex min-w-0 flex-col gap-2">
              <div class="flex flex-col gap-0.5">
                <div class="font-medium">{{ alternative.title }}</div>
                <div class="leading-snug text-muted">{{ alternative.reason }}</div>
              </div>
              <CopyCommand v-if="alternative.command !== null" :command="alternative.command" />
            </div>
          </div>
        </div>
      </UCard>

      <Widget page="overview" widget="epics" :title="t.epicProgress">
        <template #aside>
          <ULink :to="{ path: '/project', query: { project } }" class="text-sm">{{ t.openBoard }}</ULink>
        </template>
        <template #default="{ full }">
          <p v-if="snapshot.roadmap === null" class="px-3.5 py-3 text-muted">
            <span class="font-medium text-default">{{ t.notAvailable }}</span> · {{ t.noRoadmap }}
          </p>
          <div v-else-if="full" class="overflow-auto">
            <p v-if="steps.length === 0" class="px-3.5 py-3 text-muted">{{ t.noEpics }}</p>
            <p v-else-if="snapshot.tasks === null" class="border-b border-default px-3.5 py-2 text-muted">{{ t.notAvailable }} · {{ t.trackerUnreadable }}</p>
            <table v-if="steps.length > 0" class="w-full border-collapse">
              <thead>
                <tr class="text-left text-sm text-muted">
                  <th class="w-9 border-b border-default px-3.5 py-2 font-medium">#</th>
                  <th class="border-b border-default px-3.5 py-2 font-medium">{{ t.epicColumn }}</th>
                  <th class="border-b border-default px-3.5 py-2 font-medium">{{ t.status }}</th>
                  <th class="border-b border-default px-3.5 py-2 font-medium">{{ t.tasksColumn }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="{ epic, step } in steps" :key="epic.number" :aria-current="step === 'current' ? 'step' : undefined" :class="{ 'bg-primary/10': step === 'current' }">
                  <td class="border-b border-default px-3.5 py-2 font-mono text-sm text-dimmed">{{ epic.number }}</td>
                  <td lang="en" class="border-b border-default px-3.5 py-2" :class="step === 'current' ? 'font-semibold' : step === 'later' ? 'text-muted' : ''">{{ epic.title }}</td>
                  <td class="border-b border-default px-3.5 py-2">
                    <UBadge :label="wordFor(t.roadmapStatuses, epic.status)" v-bind="statusBadge(epic.status)" size="sm" />
                  </td>
                  <td class="border-b border-default px-3.5 py-2 font-mono text-sm whitespace-nowrap text-muted">
                    <span v-if="epic.progress === null" class="text-dimmed">—</span>
                    <template v-else-if="epic.progress.all === 0">{{ t.noTasks }}</template>
                    <template v-else>{{ t.tasksDone(number(epic.progress.done), number(epic.progress.all)) }}</template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="flex flex-col gap-3 px-3.5 py-3">
            <ol v-if="steps.length > 0" class="flex gap-1" lang="en">
              <li
                v-for="{ epic, step } in steps"
                :key="epic.number"
                :title="`${epic.number} ${epic.title} · ${wordFor(t.roadmapStatuses, epic.status)}`"
                :aria-current="step === 'current' ? 'step' : undefined"
                class="flex min-w-0 flex-1 flex-col gap-1"
              >
                <div class="h-1 rounded-sm" :class="step === 'done' ? 'bg-(--ui-text-muted)' : step === 'current' ? 'bg-primary' : 'bg-accented'" />
                <span class="font-mono text-xs" :class="step === 'current' ? 'font-semibold text-primary' : step === 'done' ? 'text-muted' : 'text-dimmed'">{{ epic.number }}</span>
              </li>
            </ol>
            <div class="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
              <span class="text-sm whitespace-nowrap text-muted">{{ t.currentEpic }}</span>
              <template v-if="current === null">
                <span class="text-muted">{{ steps.length === 0 ? t.noEpics : t.everyEpicDone }}</span>
              </template>
              <template v-else>
                <span class="font-medium" lang="en">{{ current.number }} {{ current.title }}</span>
                <span v-if="snapshot.tasks === null" class="flex-1 text-muted">{{ t.notAvailable }} · {{ t.trackerUnreadable }}</span>
                <span v-else-if="progress === null" class="flex-1 text-muted">{{ t.noSpecYet }}</span>
                <span v-else-if="progress.all === 0" class="flex-1 text-muted">{{ t.noTasks }}</span>
                <span v-else class="flex min-w-48 flex-1 items-center gap-3.5">
                  <UProgress :model-value="progress.done" :max="progress.all" size="sm" class="min-w-20 flex-1" />
                  <span class="font-mono text-sm whitespace-nowrap text-muted">{{ t.tasksDone(number(progress.done), number(progress.all)) }}</span>
                </span>
              </template>
            </div>
          </div>
        </template>
      </Widget>

      <!-- Ready beside a column of Running, Attention and the Usage line: each column ends where its widgets do, with nothing under the row to leave a hole above. -->
      <div class="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] items-start gap-5">
        <Widget page="overview" widget="ready" :title="t.readyToStart">
          <template #aside>
            <span v-if="snapshot.tasks" class="font-mono text-sm text-dimmed">{{ number(count(snapshot.tasks.readyToStart)) }}</span>
          </template>
          <template #default="{ full }">
            <div v-if="snapshot.tasks === null" class="flex flex-col gap-1 px-3.5 py-4">
              <div class="font-medium">{{ t.notAvailable }} · {{ t.trackerUnreadable }}</div>
              <FoldedText v-for="item in trackerReasons" :key="item.code + item.message" class="leading-snug break-words text-muted">
                <DaemonReason :said="item" />
              </FoldedText>
            </div>
            <template v-else>
              <template v-if="full">
                <div v-if="parallel" class="flex items-center gap-1.5 border-b border-default px-3.5 py-2 text-sm text-primary">
                  <UIcon name="i-lucide-split" class="size-3.5" />
                  {{ parallel }} <span class="text-dimmed">({{ t.estimate }})</span>
                </div>
                <div v-if="!snapshot.tasks.parallel.impact.available || snapshot.tasks.parallel.impact.tasks.length > 0" class="flex flex-col gap-1.5 border-b border-default px-3.5 py-2.5 text-sm">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-semibold">{{ t.conflictRisk }}</span>
                    <span class="text-dimmed">({{ t.estimate }})</span>
                  </div>
                  <p v-if="isUnavailable(snapshot.tasks.parallel.impact)" class="text-muted">
                    <span class="font-medium text-default">{{ t.notAvailable }}</span> · <DaemonReason :said="snapshot.tasks.parallel.impact" />
                  </p>
                  <template v-else>
                    <div v-for="task in snapshot.tasks.parallel.impact.tasks" :key="task.id" class="flex min-w-0 flex-wrap gap-x-1.5">
                      <span class="font-mono text-muted">{{ task.id }}</span>
                      <span class="text-dimmed">{{ task.from === 'branch' ? t.fromBranch : t.fromTicket }}</span>
                      <span v-if="task.modules.length > 0" class="font-mono break-all">{{ task.modules.join(', ') }}</span>
                      <span v-else class="text-dimmed">{{ t.noModules }}</span>
                    </div>
                    <div v-for="pair in snapshot.tasks.parallel.impact.pairs" :key="pair.tasks.join(' ')" class="flex flex-col gap-0.5 border-t border-default pt-1.5">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <span class="font-mono text-muted">{{ pair.tasks.join(' · ') }}</span>
                        <UBadge :label="t.risks[pair.risk]" :color="RISK_COLORS[pair.risk]" variant="soft" size="sm" />
                      </div>
                      <FoldedText class="leading-snug break-words text-muted">
                        <DaemonReason :said="pair" :translated="pairReason(language, pair, snapshot.tasks.parallel.impact.tasks)" />
                      </FoldedText>
                    </div>
                  </template>
                </div>
              </template>
              <template v-if="count(snapshot.tasks.readyToStart) === 0 && (!full || waiting.length === 0)">
                <div v-if="noTasks" class="flex flex-col gap-1 px-3.5 py-4">
                  <div class="font-medium">{{ t.noTasks }}</div>
                  <div class="leading-snug text-muted">{{ t.noTasksBody }}</div>
                  <FoldedText v-for="item in trackerReasons" :key="item.code + item.message" class="leading-snug break-words text-muted">
                    <DaemonReason :said="item" />
                  </FoldedText>
                </div>
                <p v-else class="px-3.5 py-4 text-muted">{{ t.nothing }}</p>
              </template>
              <ul class="divide-y divide-default">
                <FoldedList :items="snapshot.tasks.readyToStart.items" :by="(task) => task.id">
                  <template #default="{ item: task }">
                    <li class="flex flex-col gap-2 px-3.5 py-3">
                      <div class="flex min-w-0 flex-col gap-0.5">
                        <ULink :to="{ path: '/task', query: { project, id: task.id } }" class="font-mono text-sm break-all text-muted">{{ task.id }}</ULink>
                        <span class="leading-snug" lang="en">{{ task.title ?? task.id }}</span>
                      </div>
                      <CopyCommand v-if="task.start !== null" :command="task.start" />
                    </li>
                  </template>
                </FoldedList>
                <li v-if="snapshot.tasks.readyToStart.remainder > 0" class="px-3.5 py-2.5 text-muted">{{ t.more(number(snapshot.tasks.readyToStart.remainder)) }}</li>
                <FoldedList v-if="full" :items="waiting" :by="(card) => card.id">
                  <template #default="{ item: card }">
                    <li class="flex items-start gap-2.5 px-3.5 py-3 opacity-55">
                      <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                        <ULink :to="{ path: '/task', query: { project, id: card.id } }" class="font-mono text-sm break-all text-muted">{{ card.id }}</ULink>
                        <span class="leading-snug" lang="en">{{ card.title ?? card.id }}</span>
                      </div>
                      <UBadge color="neutral" variant="outline" icon="i-lucide-lock" :title="t.unmetDependency" class="flex-none">
                        {{ t.waitsOn(card.unmetDependencies.map((id) => dependency(card.id, id)).join(', ')) }}
                      </UBadge>
                    </li>
                  </template>
                </FoldedList>
              </ul>
            </template>
          </template>
        </Widget>

        <div class="flex min-w-0 flex-col gap-5">
          <Widget page="overview" widget="running" :title="t.runningNow">
            <template #aside>
              <span class="text-sm text-dimmed">({{ t.fromActivity }})</span>
              <span v-if="!isUnavailable(snapshot.activity) && count(snapshot.activity.running) > 0" class="font-mono text-sm text-dimmed">
                {{ number(count(snapshot.activity.running)) }}
              </span>
            </template>
            <template #default="{ full }">
              <p v-if="isUnavailable(snapshot.activity)" class="px-3.5 py-4 text-muted">
                {{ t.notAvailable }} · <DaemonReason :said="snapshot.activity" />
              </p>
              <p v-else-if="snapshot.activity.running.items.length === 0" class="px-3.5 py-4 text-muted">{{ t.nothing }}</p>
              <ul v-else class="divide-y divide-default">
                <FoldedList :items="snapshot.activity.running.items" :by="(run) => run.id">
                  <template #default="{ item: run }">
                    <li class="flex flex-col gap-1 px-3.5 py-2.5">
                      <div class="flex min-w-0 items-center gap-2">
                        <span class="size-1.5 flex-none rounded-full bg-success" />
                        <template v-if="run.taskId !== null">
                          <ULink :to="{ path: '/task', query: { project, id: run.taskId } }" class="flex-none font-mono text-sm text-muted">{{ run.taskId }}</ULink>
                          <span v-if="run.taskTitle !== null" class="truncate" lang="en">{{ run.taskTitle }}</span>
                        </template>
                        <template v-else>
                          <UBadge :label="runRole(t, run.role)" color="neutral" variant="soft" size="sm" />
                          <span class="text-sm text-dimmed">{{ t.noTask }}</span>
                        </template>
                        <span class="flex-1" />
                        <span class="flex-none text-sm whitespace-nowrap text-muted">{{ lastActivity(run.lastActivityAt) }}</span>
                      </div>
                      <div v-if="full" class="flex flex-wrap gap-x-3 gap-y-1 pl-3.5 font-mono text-xs text-dimmed">
                        <span>{{ run.harness }}</span>
                        <span>{{ run.model ?? t.modelNotReported }}</span>
                        <span v-if="run.taskId !== null" class="font-sans">{{ runRole(t, run.role) }}</span>
                        <span v-if="run.branch !== null" class="inline-flex items-center gap-1"><UIcon name="i-lucide-git-branch" class="size-3" />{{ run.branch }}</span>
                      </div>
                    </li>
                  </template>
                </FoldedList>
                <li v-if="snapshot.activity.running.remainder > 0" class="px-3.5 py-2.5 text-muted">{{ t.more(number(snapshot.activity.running.remainder)) }}</li>
              </ul>
            </template>
          </Widget>

          <Widget page="overview" widget="attention" :title="t.attention">
            <template #aside>
              <span v-if="snapshot.attention.length > 0" class="font-mono text-sm text-dimmed">{{ number(snapshot.attention.length) }}</span>
              <ULink :to="{ path: '/attention', query: { project } }" class="text-sm">{{ t.allProjects }}</ULink>
            </template>
            <template #default="{ full }">
              <p v-if="snapshot.attention.length === 0" class="px-3.5 py-4 text-muted">{{ t.nothing }}</p>
              <AttentionItems v-else :items="snapshot.attention" :full="full" />
            </template>
          </Widget>

          <ULink
            :to="{ path: '/usage', query: { project } }"
            class="flex flex-wrap items-center gap-3.5 rounded-[10px] border border-default bg-default px-3.5 py-2.5 text-default hover:border-accented"
          >
            <span class="font-semibold">{{ t.usage }}</span>
            <span class="text-muted">{{ t.outputTokens }}</span>
            <span><span class="text-muted">{{ t.today }}</span> <span class="tabular-nums">{{ outputTokens(snapshot.usage.today) }}</span></span>
            <span class="text-dimmed">·</span>
            <span><span class="text-muted">{{ t.last7Days }}</span> <span class="tabular-nums">{{ outputTokens(snapshot.usage.last7Days) }}</span></span>
            <span class="flex-1" />
            <UIcon name="i-lucide-arrow-right" class="size-3.5 text-primary" />
          </ULink>
        </div>
      </div>
    </template>
  </div>
</template>
