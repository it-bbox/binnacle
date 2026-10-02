<script setup lang="ts">
import { call, usePolling } from '~/composables/daemon';
import { useLanguage } from '~/composables/language';
import { count, isUnavailable, SELECTED_VIEW, type Alternative, type Board, type ConflictRisk } from '~/composables/projects';
import type { Totals } from '~/composables/usage';

/**
 * The selected project's Overview: what's next, the epic's progress, Ready to start with the
 * conflict risk beside the parallel limit, what is running, attention and a line of usage. The snapshot is the shell's; the current epic's board
 * is polled here for its progress and its Tasks waiting on an Unmet dependency.
 */
const view = inject(SELECTED_VIEW, ref(null));
const snapshot = computed(() => view.value?.snapshot ?? null);
const route = useRoute();
const project = typeof route.query.project === 'string' ? route.query.project : null;
const { t, number, list, secondsAgo } = useLanguage();

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

/** The roadmap's epics as steps: done, the current one (the first not done), and those after it. */
const steps = computed(() => {
  const epics = snapshot.value?.roadmap?.epics ?? [];
  const current = epics.find((epic) => epic.status !== 'done');
  return epics.map((epic) => ({ epic, step: epic.status === 'done' ? 'done' : epic === current ? 'current' : 'later' }));
});
const current = computed(() => steps.value.find((item) => item.step === 'current')?.epic ?? null);

/** The current epic's Tasks done out of all of them, `CANCELLED` left out, as its board counts them. */
const progress = computed(() => {
  const value = board.data.value;
  if (value === null || value.epic === null) return null;
  const { backlog, ready, inProgress, done } = value.columns;
  return { done: count(done), all: count(backlog) + count(ready) + count(inProgress) + count(done) + count(value.unknown) };
});

/** No Tasks in the project, or none in its current epic; the tracker's attention items say why, when it has any. */
const noTasks = computed((): boolean => {
  const tasks = snapshot.value?.tasks;
  if (!tasks) return false;
  const all = count(tasks.inFlight) + count(tasks.readyToStart) + Object.values(tasks.counts).reduce((sum, value) => sum + value, 0);
  return all === 0 || progress.value?.all === 0;
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

const lastActivity =(timestamp: string): string => secondsAgo((Date.now() - Date.parse(timestamp)) / 1000);

/** Output tokens as the line shows them: none recorded, not reported, or the total, marked when partial. */
function outputTokens(totals: Totals): string {
  if (totals.records === 0) return t.value.noRecords;
  const { tokens, partial } = totals.output;
  if (tokens === null) return t.value.notReported;
  return partial ? `${number(tokens)} (${t.value.partial})` : number(tokens);
}

const panel = { root: 'rounded-[10px]', header: 'flex items-center justify-between gap-2 px-3.5 py-2.5 sm:px-3.5', body: 'p-0 sm:p-0', footer: 'px-3.5 py-2 sm:px-3.5' };
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
    <p v-else-if="view.failure" class="py-10 text-warning"><code>{{ view.failure.code }}</code> <span lang="en">{{ view.failure.message }}</span></p>
    <template v-else-if="snapshot">
      <UCard :ui="{ root: 'rounded-[14px]', body: 'flex flex-col gap-6 px-10 pt-9 pb-8 sm:px-10 sm:pt-9 sm:pb-8' }">
        <h1 class="text-[22px] font-semibold tracking-tight text-highlighted">{{ t.whatsNext }}</h1>
        <div v-if="snapshot.roadmap === null" class="flex flex-col gap-2.5">
          <div class="flex items-center gap-2">
            <UBadge :label="t.notAvailable" color="neutral" variant="outline" class="border-dashed" />
            <span class="font-medium">{{ t.noRoadmap }}</span>
          </div>
          <p v-for="item in roadmapReasons" :key="item.code + item.message" class="font-mono text-xs leading-normal text-muted" lang="en">
            {{ item.message }} <code class="text-dimmed">{{ item.code }}</code>
          </p>
        </div>
        <div v-else class="flex flex-col gap-3.5">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge label="Next action" color="primary" variant="soft" />
            <span class="text-xs text-muted">{{ t.fromRoadmap }}</span>
          </div>
          <template v-if="snapshot.next.action">
            <p class="max-w-[70ch] text-[17px] leading-normal whitespace-pre-wrap" lang="en">{{ snapshot.next.action.description }}</p>
            <CopyCommand :command="snapshot.next.action.command" primary />
          </template>
          <UAlert
            v-for="item in nextActionWarnings"
            :key="item.code"
            color="warning"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :title="item.code === 'next_action.stale' ? t.nextActionStale : t.nextActionMissing"
          >
            <template #description><code class="font-mono text-[11px]">{{ item.code }}</code></template>
          </UAlert>
        </div>
        <p v-if="isUnavailable(snapshot.next.alternatives)" class="text-muted">
          <span class="font-medium text-default">{{ t.notAvailable }}</span> · <span lang="en">{{ snapshot.next.alternatives.reason }}</span>
        </p>
        <div v-else-if="alternatives.length > 0" class="flex flex-col">
          <div class="mb-1.5 flex items-center gap-2.5">
            <span class="text-[13px] font-semibold text-muted">{{ t.or }}</span>
            <UBadge :label="t.calculation" color="neutral" variant="outline" icon="i-lucide-calculator" class="border-dashed" />
            <div class="h-px flex-1 bg-(--ui-border)" />
          </div>
          <div
            v-for="alternative in alternatives"
            :key="alternative.kind"
            class="grid grid-cols-[28px_minmax(0,1fr)] gap-x-2.5 gap-y-1 border-t border-default py-3"
          >
            <div class="flex size-[26px] items-center justify-center rounded-[7px] bg-accented text-muted">
              <UIcon :name="ICONS[alternative.kind]" class="size-3.5" />
            </div>
            <div class="flex min-w-0 flex-col gap-2">
              <div class="flex flex-col gap-0.5">
                <div class="text-sm font-medium">{{ alternative.title }}</div>
                <div class="leading-snug text-muted">{{ alternative.reason }}</div>
              </div>
              <CopyCommand v-if="alternative.command !== null" :command="alternative.command" />
            </div>
          </div>
        </div>
      </UCard>

      <section class="flex flex-col gap-3.5">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-[13px] font-semibold">{{ t.epicProgress }}</h2>
          <ULink :to="{ path: '/project', query: { project } }" class="text-xs">{{ t.openBoard }}</ULink>
        </div>
        <div v-if="snapshot.roadmap === null" class="rounded-[10px] border border-dashed border-accented px-3.5 py-3 text-[12.5px] text-muted">
          <span class="font-medium text-default">{{ t.notAvailable }}</span> · {{ t.noRoadmap }}
        </div>
        <template v-else>
          <ol v-if="steps.length > 0" class="grid auto-cols-[minmax(0,1fr)] grid-flow-col gap-1.5">
            <li v-for="{ epic, step } in steps" :key="epic.number" :title="`${epic.number} ${epic.title} · ${epic.status}`" class="flex min-w-0 flex-col gap-1.5" lang="en">
              <div
                class="h-1 rounded-sm"
                :class="step === 'done' ? 'bg-(--ui-text-muted)' : step === 'current' ? 'bg-primary' : 'bg-accented'"
              />
              <div class="flex min-w-0 items-center gap-1.5">
                <UIcon v-if="step === 'done'" name="i-lucide-circle-check" class="size-3.5 flex-none text-muted" />
                <UIcon v-else-if="step === 'current'" name="i-lucide-circle-dot" class="size-3.5 flex-none text-primary" />
                <UIcon v-else name="i-lucide-circle-dashed" class="size-3.5 flex-none text-dimmed" />
                <span class="font-mono text-[11px] text-dimmed">{{ epic.number }}</span>
                <span class="truncate text-xs" :class="step === 'current' ? 'font-semibold' : step === 'later' ? 'text-dimmed' : ''">{{ epic.title }}</span>
              </div>
            </li>
          </ol>
          <div class="flex items-center gap-3.5 rounded-[10px] border border-default bg-default px-3.5 py-2.5">
            <span class="text-xs whitespace-nowrap text-muted">{{ t.currentEpic }}</span>
            <template v-if="current === null">
              <span class="text-muted">{{ steps.length === 0 ? t.noEpics : t.everyEpicDone }}</span>
            </template>
            <template v-else>
              <span class="font-medium whitespace-nowrap" lang="en">{{ current.number }} {{ current.title }}</span>
              <span v-if="snapshot.tasks === null" class="flex-1 text-muted">{{ t.notAvailable }} · {{ t.trackerUnreadable }}</span>
              <USkeleton v-else-if="progress === null" class="h-1.5 flex-1" />
              <span v-else-if="progress.all === 0" class="flex-1 text-muted">{{ t.noTasks }}</span>
              <template v-else>
                <UProgress :model-value="progress.done" :max="progress.all" size="sm" class="min-w-20 flex-1" />
                <span class="font-mono text-xs whitespace-nowrap text-muted">{{ t.tasksDone(number(progress.done), number(progress.all)) }}</span>
              </template>
            </template>
          </div>
        </template>
      </section>

      <div class="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] items-start gap-5">
        <UCard :ui="panel">
          <template #header>
            <h2 class="text-[13px] font-semibold">{{ t.readyToStart }}</h2>
            <span v-if="snapshot.tasks" class="font-mono text-[11.5px] text-dimmed">{{ number(count(snapshot.tasks.readyToStart)) }}</span>
          </template>
          <div v-if="snapshot.tasks === null" class="flex flex-col gap-1 px-3.5 py-4">
            <div class="font-medium">{{ t.notAvailable }} · {{ t.trackerUnreadable }}</div>
            <p v-for="item in trackerReasons" :key="item.code + item.message" class="leading-snug text-muted" lang="en">
              {{ item.message }} <code class="font-mono text-[11px] text-dimmed">{{ item.code }}</code>
            </p>
          </div>
          <template v-else>
            <div v-if="parallel" class="flex items-center gap-1.5 border-b border-default px-3.5 py-2 text-xs text-primary" :title="t.calculation">
              <UIcon name="i-lucide-split" class="size-3.5" />
              {{ parallel }}
            </div>
            <div class="flex flex-col gap-1.5 border-b border-default px-3.5 py-2.5 text-xs">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-semibold">{{ t.conflictRisk }}</span>
                <UBadge :label="t.calculation" color="neutral" variant="outline" icon="i-lucide-calculator" size="sm" class="border-dashed" />
              </div>
              <p v-if="!snapshot.tasks.parallel.impact.available" class="text-muted">
                <span class="font-medium text-default">{{ t.notAvailable }}</span> · <span lang="en">{{ snapshot.tasks.parallel.impact.reason }}</span>
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
                  <span lang="en" class="leading-snug break-words text-muted">{{ pair.reason }}</span>
                </div>
              </template>
            </div>
            <template v-if="count(snapshot.tasks.readyToStart) === 0 && waiting.length === 0">
              <div v-if="noTasks" class="flex flex-col gap-1 px-3.5 py-4">
                <div class="font-medium">{{ t.noTasks }}</div>
                <div class="leading-snug text-muted">{{ t.noTasksBody }}</div>
                <p v-for="item in trackerReasons" :key="item.code + item.message" class="leading-snug text-muted" lang="en">
                  {{ item.message }} <code class="font-mono text-[11px] text-dimmed">{{ item.code }}</code>
                </p>
              </div>
              <p v-else class="px-3.5 py-4 text-muted">{{ t.nothing }}</p>
            </template>
            <ul class="divide-y divide-default">
              <li v-for="task in snapshot.tasks.readyToStart.items" :key="task.id" class="flex flex-col gap-2 px-3.5 py-3">
                <div class="flex min-w-0 flex-col gap-0.5">
                  <ULink :to="{ path: '/task', query: { project, id: task.id } }" class="font-mono text-[11.5px] text-muted">{{ task.id }}</ULink>
                  <span class="leading-snug" lang="en">{{ task.title ?? task.id }}</span>
                </div>
                <CopyCommand v-if="task.start !== null" :command="task.start" />
              </li>
              <li v-if="snapshot.tasks.readyToStart.remainder > 0" class="px-3.5 py-2.5 text-muted">{{ t.more(number(snapshot.tasks.readyToStart.remainder)) }}</li>
              <li v-for="card in waiting" :key="card.id" class="flex items-start gap-2.5 px-3.5 py-3 opacity-55">
                <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <ULink :to="{ path: '/task', query: { project, id: card.id } }" class="font-mono text-[11.5px] text-muted">{{ card.id }}</ULink>
                  <span class="leading-snug" lang="en">{{ card.title ?? card.id }}</span>
                </div>
                <UBadge color="neutral" variant="outline" icon="i-lucide-lock" title="Unmet dependency" class="flex-none">
                  {{ t.waitsOn(card.unmetDependencies.map((id) => dependency(card.id, id)).join(', ')) }}
                </UBadge>
              </li>
            </ul>
          </template>
        </UCard>

        <div class="flex min-w-0 flex-col gap-5">
          <UCard :ui="panel">
            <template #header>
              <h2 class="text-[13px] font-semibold">{{ t.runningNow }}</h2>
              <span v-if="!isUnavailable(snapshot.activity) && count(snapshot.activity.running) > 0" class="font-mono text-[11.5px] text-dimmed">
                {{ number(count(snapshot.activity.running)) }}
              </span>
            </template>
            <p v-if="isUnavailable(snapshot.activity)" class="px-3.5 py-4 text-muted">
              {{ t.notAvailable }} · <span lang="en">{{ snapshot.activity.reason }}</span>
            </p>
            <p v-else-if="snapshot.activity.running.items.length === 0" class="px-3.5 py-4 text-muted">{{ t.nothing }}</p>
            <ul v-else class="divide-y divide-default">
              <li v-for="run in snapshot.activity.running.items" :key="run.id" class="flex flex-col gap-1 px-3.5 py-2.5">
                <div class="flex min-w-0 items-center gap-2">
                  <span class="size-1.5 flex-none rounded-full bg-success" />
                  <template v-if="run.taskId !== null">
                    <ULink :to="{ path: '/task', query: { project, id: run.taskId } }" class="flex-none font-mono text-[11.5px] text-muted">{{ run.taskId }}</ULink>
                    <span v-if="run.taskTitle !== null" class="truncate" lang="en">{{ run.taskTitle }}</span>
                  </template>
                  <template v-else>
                    <UBadge :label="run.role" color="neutral" variant="soft" size="sm" class="font-mono" />
                    <span class="text-xs text-dimmed">{{ t.noTask }}</span>
                  </template>
                  <span class="flex-1" />
                  <span class="flex-none text-[11.5px] whitespace-nowrap text-muted">{{ lastActivity(run.lastActivityAt) }}</span>
                </div>
                <div class="flex flex-wrap gap-x-3 gap-y-1 pl-3.5 font-mono text-[11px] text-dimmed">
                  <span>{{ run.harness }}</span>
                  <span>{{ run.model ?? t.notReported }}</span>
                  <span v-if="run.taskId !== null">{{ run.role }}</span>
                  <span v-if="run.branch !== null" class="inline-flex items-center gap-1"><UIcon name="i-lucide-git-branch" class="size-3" />{{ run.branch }}</span>
                </div>
              </li>
              <li v-if="snapshot.activity.running.remainder > 0" class="px-3.5 py-2.5 text-muted">{{ t.more(number(snapshot.activity.running.remainder)) }}</li>
            </ul>
            <template #footer>
              <p class="text-[11.5px] leading-snug text-dimmed">{{ t.runningNote }}</p>
            </template>
          </UCard>

          <UCard :ui="panel">
            <template #header>
              <h2 class="text-[13px] font-semibold">{{ t.attention }}</h2>
              <ULink :to="{ path: '/attention', query: { project } }" class="text-xs">{{ t.allProjects }}</ULink>
            </template>
            <p v-if="snapshot.attention.length === 0" class="px-3.5 py-4 text-muted">{{ t.nothing }}</p>
            <ul v-else class="divide-y divide-default">
              <li v-for="(item, index) in snapshot.attention" :key="index" class="flex items-start gap-2 px-3.5 py-2.5">
                <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-3.5 flex-none text-(--warn)" />
                <div class="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span class="leading-snug break-words" lang="en">{{ item.message }}</span>
                  <code class="font-mono text-[11px] text-dimmed">{{ item.code }}</code>
                </div>
              </li>
            </ul>
          </UCard>
        </div>
      </div>

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
    </template>
  </div>
</template>
