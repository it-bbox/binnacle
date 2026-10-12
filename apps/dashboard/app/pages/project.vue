<script setup lang="ts">
import { call, usePolling } from '~/composables/daemon';
import { useLanguage } from '~/composables/language';
import {
  CI_TONE,
  count,
  forgeName,
  gitLine,
  isUnavailable,
  projectName,
  SELECTED_VIEW,
  statusBadge,
  type Board,
  type Card,
  type CiForge,
  type CiRequest,
  type CiState,
  type LatestRun,
  type Section,
  type Snapshot,
  type Unavailable,
} from '~/composables/projects';
import { BRIEF_FIELDS, FIELDS, type ProjectUsage } from '~/composables/usage';
import { LIST_FOLD } from '~/widget';

type WaitingTask = { id: string; title: string | null; state: string | null; ticket: string };
/** *Waiting for the owner*, the snapshot's `pendingDecisions`. */
type PendingDecisions = {
  questions: Section<{ id: string; title: string | null; ticket: string; question: string; branch: string | null }> | Unavailable;
  approvals: Section<WaitingTask>;
  owner: Section<WaitingTask>;
};

/** The snapshot's `ci`: the default branch's latest commit and the open pull requests, with the Task each maps to. */
type Ci = {
  forge: CiForge;
  defaultBranch: { branch: string; commit: string; state: CiState; url: string; at: string | null };
  requests: Section<CiRequest & { taskId: string | null }>;
};

type ProjectSnapshot = Snapshot & {
  decisions: Section<{ title: string | null; path: string }> | null;
  pendingDecisions: PendingDecisions | Unavailable;
  ci: Ci | Unavailable;
};

type ColumnKey = keyof Board['columns'];

/** The columns, with the ticket state a card in each needs no word about. */
const COLUMNS: [ColumnKey, string, string | null][] = [
  ['backlog', 'Backlog', 'BACKLOG'],
  ['ready', 'Ready', 'READY'],
  ['inProgress', 'In progress', null],
  ['done', 'Done', 'DONE'],
];
/** Done shows its latest few until it is opened. */
const DONE_SHOWN = 3;

const { t, plural, number, since, elapsed } = useLanguage();
const route = useRoute();
const router = useRouter();
const project = typeof route.query.project === 'string' ? route.query.project : null;
/** The board's group: an epic's spec, the Tasks without one, or, by default, the current epic. */
const group = (): { spec?: string | null } => {
  if (route.query.withoutSpec !== undefined) return { spec: null };
  return typeof route.query.spec === 'string' ? { spec: route.query.spec } : {};
};

const view = inject(SELECTED_VIEW, ref(null));
/** The shell's snapshot of the selected project, whose answer also carries the decisions, what waits for the owner and CI. */
const snapshot = computed(() => (view.value?.snapshot ?? null) as ProjectSnapshot | null);
const board = usePolling(async () => (project === null ? null : call<Board>('task.list', { path: project, ...group() })));
const usage = usePolling(async () => (project === null ? null : call<ProjectUsage>('usage.get', { path: project })));
const doneOpen = ref(false);
watch(
  () => route.query,
  () => {
    doneOpen.value = false;
    void board.refresh();
  },
);

const epics = computed(() => snapshot.value?.roadmap?.epics ?? []);
/** The daemon's current epic: the board's default, as `task.list` reads it. */
const current = computed(() => snapshot.value?.roadmap?.current ?? null);
const tabs = computed(() =>
  epics.value.map((epic) => ({ label: String(epic.number), value: String(epic.number), disabled: epic.spec === null && epic.number !== current.value?.number })),
);
function pick(value: string | number): void {
  const epic = epics.value.find((item) => String(item.number) === String(value));
  if (epic === undefined) return;
  void router.push({ query: epic.spec === null ? { project } : { project, spec: epic.spec } });
}

const boardEmpty = computed(() => {
  const value = board.data.value;
  return value !== null && COLUMNS.every(([key]) => count(value.columns[key]) === 0) && count(value.unknown) === 0 && value.cancelled === 0;
});
const shown = (key: ColumnKey, cards: Card[]): Card[] => (key === 'done' && !doneOpen.value ? cards.slice(0, DONE_SHOWN) : cards);
/** Who works on a card: harness and role, and in *Full* the model between them. */
const runLabel = (latest: LatestRun, full: boolean): string =>
  (full ? [latest.harness, latest.model ?? t.value.modelNotReported, latest.role] : [latest.harness, latest.role]).join(' · ');
/** A card's time: how long its run has been going while it runs, and how long ago it was last active. */
const runTime = (latest: LatestRun): string =>
  latest.active.value ? `${t.value.runningFor(elapsed(latest.startedAt))} · ${t.value.activeAgo(since(latest.lastActivityAt))}` : t.value.activeAgo(since(latest.lastActivityAt));
/** *Waiting for the owner*'s lists show their first item in *Brief* (story 16), and fold as any list in *Full*. */
const waitingFold = (full: boolean): number => (full ? LIST_FOLD : 1);

/** Whether the default branch has moved past the graph's commit, or that its commit cannot be read. */
const graphFreshness = computed(() => {
  const behind = snapshot.value?.graph.behind;
  return behind === true ? t.value.behind : behind === false ? t.value.current : t.value.behindUnknown;
});

/** The two lists of Tasks waiting for the owner, each with its title and note. */
const waitingTasks = computed(() => {
  const pending = snapshot.value?.pendingDecisions;
  if (!pending || isUnavailable(pending)) return [];
  return [
    { key: 'approvals', title: t.value.waitingApprovals, note: t.value.approvalsNote, list: pending.approvals },
    { key: 'owner', title: t.value.waitingOwner, note: t.value.ownerNote, list: pending.owner },
  ];
});

const roadmapAttention = computed(() => snapshot.value?.attention.filter((item) => item.code.startsWith('roadmap.')) ?? []);
</script>


<template>
  <div class="flex flex-col gap-6 pt-4">
    <p v-if="project === null" class="m-0 text-warning">{{ t.noProjectAddress }}</p>
    <template v-else>
      <p v-if="view === null" class="m-0 text-muted">{{ t.unknownProject }}</p>
      <p v-else-if="view.project.unavailable !== null" class="m-0 text-muted">
        <span class="font-medium text-default">{{ t.notAvailable }}</span> · <span lang="en">{{ view.project.unavailable }}</span>
      </p>
      <p v-else-if="view.failure" class="m-0 text-warning"><code>{{ view.failure.code }}</code> <span lang="en">{{ view.failure.message }}</span></p>
      <template v-else-if="snapshot">
        <div class="flex flex-col gap-0.5">
          <h1 class="m-0 text-xl font-semibold text-highlighted">{{ projectName(view.project) }}</h1>
          <span class="font-mono text-sm text-dimmed">{{ view.project.path }}</span>
        </div>

        <Widget page="project" widget="waiting" :title="t.pendingDecisions">
          <template #default="{ full }">
            <p v-if="isUnavailable(snapshot.pendingDecisions)" class="m-0 px-3.5 py-2.5">
              <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="snapshot.pendingDecisions.reason" /></span>
            </p>
            <div v-else class="grid grid-cols-3 items-start divide-x divide-default">
              <section class="flex min-w-0 flex-col gap-2 px-3.5 py-2.5">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="m-0 text-sm font-semibold">{{ t.waitingQuestions }}</h3>
                  <span v-if="!isUnavailable(snapshot.pendingDecisions.questions)" class="font-mono text-sm text-dimmed">
                    {{ number(count(snapshot.pendingDecisions.questions)) }}
                  </span>
                </div>
                <p v-if="isUnavailable(snapshot.pendingDecisions.questions)" class="m-0 text-sm">
                  <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="snapshot.pendingDecisions.questions.reason" /></span>
                </p>
                <template v-else>
                  <div v-if="snapshot.pendingDecisions.questions.items.length === 0" class="text-sm text-dimmed">{{ t.none }}</div>
                  <ul v-else class="flex flex-col gap-2">
                    <FoldedList :items="snapshot.pendingDecisions.questions.items" :by="(item) => item.id + item.question" :limit="waitingFold(full)">
                      <template #default="{ item }">
                        <li class="flex min-w-0 flex-col gap-0.5 text-sm">
                          <div class="flex flex-wrap items-baseline gap-x-1.5">
                            <UIcon name="i-lucide-circle-help" class="size-3 shrink-0 self-center text-(--warn)" />
                            <NuxtLink :to="{ path: '/task', query: { project, id: item.id } }" class="font-mono break-words text-primary hover:underline">{{ item.id }}</NuxtLink>
                            <span lang="en">{{ item.title ?? t.untitled }}</span>
                            <code v-if="full && item.branch !== null" class="font-mono text-xs text-dimmed">{{ item.branch }}</code>
                          </div>
                          <template v-if="full">
                            <code class="truncate font-mono text-xs text-dimmed" :title="item.ticket">{{ item.ticket }}</code>
                            <FoldedText lang="en" class="break-words whitespace-pre-wrap text-muted">{{ item.question }}</FoldedText>
                          </template>
                        </li>
                      </template>
                    </FoldedList>
                  </ul>
                  <div v-if="snapshot.pendingDecisions.questions.remainder > 0" class="text-sm text-dimmed">
                    {{ t.more(number(snapshot.pendingDecisions.questions.remainder)) }}
                  </div>
                </template>
              </section>
              <section v-for="group in waitingTasks" :key="group.key" class="flex min-w-0 flex-col gap-2 px-3.5 py-2.5">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="m-0 text-sm font-semibold">{{ group.title }}</h3>
                  <span class="font-mono text-sm text-dimmed">{{ number(count(group.list)) }}</span>
                </div>
                <div v-if="full" class="text-sm leading-snug text-dimmed">{{ group.note }}</div>
                <div v-if="group.list.items.length === 0" class="text-sm text-dimmed">{{ t.none }}</div>
                <ul v-else class="flex flex-col gap-2">
                  <FoldedList :items="group.list.items" :by="(item) => item.id" :limit="waitingFold(full)">
                    <template #default="{ item }">
                      <li class="flex min-w-0 flex-col gap-0.5 text-sm">
                        <div class="flex flex-wrap items-baseline gap-x-1.5">
                          <NuxtLink :to="{ path: '/task', query: { project, id: item.id } }" class="font-mono break-words text-primary hover:underline">{{ item.id }}</NuxtLink>
                          <span lang="en">{{ item.title ?? t.untitled }}</span>
                        </div>
                        <code v-if="full" class="truncate font-mono text-xs text-dimmed" :title="item.ticket">{{ item.ticket }}</code>
                      </li>
                    </template>
                  </FoldedList>
                </ul>
                <div v-if="group.list.remainder > 0" class="text-sm text-dimmed">{{ t.more(number(group.list.remainder)) }}</div>
              </section>
            </div>
          </template>
        </Widget>
      </template>

      <!-- The board leads, the epics in a narrow column beside it; under 1360 px they follow it, the board's columns too narrow beside them. -->
      <div class="grid items-start gap-x-2.5 gap-y-6" :class="{ 'min-[85rem]:grid-cols-[20rem_minmax(0,1fr)]': snapshot }">
        <Widget page="project" widget="board">
          <template #title>
            <div class="flex min-w-0 flex-wrap items-center gap-3">
              <h2 class="m-0 text-base font-semibold">{{ t.board }}</h2>
              <UTabs
                v-if="tabs.length > 0"
                :model-value="board.data.value?.epic ? String(board.data.value.epic.number) : undefined"
                :items="tabs"
                :content="false"
                variant="pill"
                size="xs"
                :aria-label="t.board"
                @update:model-value="pick"
              />
              <template v-if="board.data.value?.epic">
                <span lang="en" class="font-medium">{{ board.data.value.epic.number }} {{ board.data.value.epic.title }}</span>
                <UBadge :label="board.data.value.epic.status" v-bind="statusBadge(board.data.value.epic.status)" size="sm" lang="en" />
              </template>
              <span v-else-if="route.query.withoutSpec !== undefined" class="font-medium">{{ t.tasksWithoutSpec }}</span>
              <span v-else-if="board.data.value?.spec" class="font-mono text-sm">{{ board.data.value.spec }}</span>
            </div>
          </template>
          <template #aside>
            <NuxtLink
              v-if="board.data.value && board.data.value.withoutSpec > 0 && route.query.withoutSpec === undefined"
              :to="{ query: { project, withoutSpec: null } }"
              class="text-sm text-primary hover:underline"
            >
              {{ t.tasksWithoutSpec }} ({{ number(board.data.value.withoutSpec) }})
            </NuxtLink>
          </template>
          <template #default="{ full }">
            <div class="flex flex-col gap-3 p-2.5">
              <p v-if="board.error.value" class="m-0 text-warning"><code>{{ board.error.value.code }}</code> {{ board.error.value.message }}</p>
              <USkeleton v-else-if="board.data.value === null" class="h-48 w-full" />
              <template v-else>
                <p v-if="board.data.value.epic === null && board.data.value.spec === null && route.query.withoutSpec === undefined" class="m-0 text-muted">
                  {{ t.noCurrentEpic }}
                </p>
                <div v-else-if="boardEmpty" class="flex flex-col gap-1 rounded-lg border border-dashed border-accented px-4 py-6">
                  <div class="font-medium">{{ t.noTasks }}</div>
                  <div class="text-muted">{{ board.data.value.epic !== null && board.data.value.spec === null ? t.noSpecYet : t.noTasksBody }}</div>
                </div>
                <div v-else class="grid grid-cols-4 items-start gap-2.5">
                  <div v-for="[key, label, plain] in COLUMNS" :key="key" class="flex min-w-0 flex-col gap-2 rounded-lg border border-default bg-(--sidebar) p-2">
                    <div class="flex items-center justify-between px-1 py-0.5">
                      <span class="text-sm font-semibold">{{ label }}</span>
                      <span class="font-mono text-sm text-dimmed">{{ number(count(board.data.value.columns[key])) }}</span>
                    </div>
                    <div v-if="board.data.value.columns[key].items.length === 0" class="px-1.5 py-2.5 text-sm text-dimmed">{{ t.empty }}</div>
                    <NuxtLink
                      v-for="card in shown(key, board.data.value.columns[key].items)"
                      :key="card.id"
                      :to="{ path: '/task', query: { project, id: card.id } }"
                      class="flex flex-col gap-1.5 rounded-md border border-default bg-default px-2.5 py-2 hover:border-accented"
                      :class="{ 'opacity-60': card.unmetDependencies.length > 0 }"
                    >
                      <div class="flex flex-wrap items-center gap-1.5">
                        <span class="font-mono text-xs break-words text-muted">{{ card.id }}</span>
                        <span class="flex-1" />
                        <UBadge v-if="card.state === 'BLOCKED'" label="BLOCKED" color="error" variant="soft" size="sm" class="font-mono" />
                        <span v-else-if="full && card.state !== plain && card.source !== 'runs'" class="font-mono text-xs text-dimmed">{{ card.state }}</span>
                        <template v-if="!full">
                          <UIcon
                            v-if="card.unmetDependencies.length > 0"
                            name="i-lucide-lock"
                            class="size-3.5 shrink-0 text-muted"
                            role="img"
                            :aria-label="t.unmetDependency"
                            :title="t.unmetDependency"
                          />
                          <UIcon
                            v-if="card.questions !== null && card.questions.unanswered > 0"
                            name="i-lucide-circle-help"
                            class="size-3.5 shrink-0 text-(--warn)"
                            role="img"
                            :aria-label="plural(card.questions.unanswered, t.unansweredQuestions)"
                            :title="plural(card.questions.unanswered, t.unansweredQuestions)"
                          />
                        </template>
                        <template v-if="full && card.state === 'DONE' && card.review !== null">
                          <UBadge v-if="card.review" label="Review" color="neutral" variant="soft" size="sm" :title="t.reviewRecorded" />
                          <UBadge v-else :label="t.noReview" color="warning" variant="soft" size="sm" />
                        </template>
                      </div>
                      <div lang="en" class="text-sm leading-snug text-highlighted">{{ card.title ?? t.untitled }}</div>
                      <template v-if="full">
                        <div v-if="card.questions !== null && card.questions.unanswered > 0" class="flex items-center gap-1 text-xs text-warning">
                          <UIcon name="i-lucide-circle-help" class="size-3 shrink-0 text-(--warn)" />{{ plural(card.questions.unanswered, t.unansweredQuestions) }}
                        </div>
                        <div v-if="card.unmetDependencies.length > 0" class="text-xs text-muted">
                          {{ t.unmetDependency }} <span class="font-mono break-words">{{ card.unmetDependencies.join(', ') }}</span>
                        </div>
                      </template>
                      <div v-if="card.latestRun" class="flex flex-col gap-0.5 rounded bg-muted px-1.5 py-1 text-xs">
                        <div v-if="card.source === 'runs'" class="flex items-center gap-1 font-medium text-primary" :title="t.fromRunsReading">
                          <UIcon name="i-lucide-calculator" class="size-3 shrink-0" />{{ t.fromRuns }}
                        </div>
                        <div class="flex items-start gap-1.5">
                          <span
                            class="mt-1 size-1.5 shrink-0 rounded-full"
                            :class="card.latestRun.active.value ? 'bg-success motion-safe:animate-pulse' : 'bg-(--ui-text-dimmed)'"
                            :title="`${card.latestRun.active.value ? t.activeNow : t.notActiveNow}. ${t.runningReading}`"
                          />
                          <span class="text-muted">{{ runTime(card.latestRun) }}</span>
                        </div>
                        <div class="font-mono break-words text-muted">{{ runLabel(card.latestRun, full) }}</div>
                        <div v-if="full && card.source === 'runs'" class="text-dimmed">{{ t.ticketSays(card.state ?? t.noState) }}</div>
                      </div>
                    </NuxtLink>
                    <UButton
                      v-if="key === 'done' && board.data.value.columns.done.items.length > DONE_SHOWN"
                      :label="doneOpen ? t.showFewer : plural(board.data.value.columns.done.items.length - DONE_SHOWN, t.showMore)"
                      :aria-expanded="doneOpen"
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      block
                      @click="doneOpen = !doneOpen"
                    />
                    <div
                      v-if="board.data.value.columns[key].remainder > 0 && (key !== 'done' || doneOpen)"
                      class="px-1.5 text-sm text-dimmed"
                    >
                      {{ t.more(number(board.data.value.columns[key].remainder)) }}
                    </div>
                  </div>
                </div>
                <p v-if="board.data.value.cancelled > 0" class="m-0 text-sm text-muted">{{ plural(board.data.value.cancelled, t.cancelled) }}</p>
                <div v-if="count(board.data.value.unknown) > 0" class="flex flex-col gap-1.5">
                  <h3 class="m-0 text-sm font-semibold text-muted">{{ t.unknownState }}</h3>
                  <div v-for="card in board.data.value.unknown.items" :key="card.id" class="flex flex-wrap items-baseline gap-x-1.5 text-sm">
                    <NuxtLink :to="{ path: '/task', query: { project, id: card.id } }" class="font-mono break-words text-primary hover:underline">{{ card.id }}</NuxtLink>
                    <span lang="en">{{ card.title ?? t.untitled }}</span>
                    <span v-if="card.diagnostic" lang="en" class="text-warning"><code>{{ card.diagnostic.code }}</code> {{ card.diagnostic.message }}</span>
                  </div>
                  <div v-if="board.data.value.unknown.remainder > 0" class="text-sm text-dimmed">{{ t.more(number(board.data.value.unknown.remainder)) }}</div>
                </div>
              </template>
            </div>
          </template>
        </Widget>
        <template v-if="snapshot">
          <div v-if="snapshot.roadmap === null" class="min-[85rem]:order-first flex flex-col gap-1.5 rounded-lg border border-dashed border-accented p-4">
            <div><span class="font-medium">{{ t.notAvailable }}</span> · {{ t.noRoadmap }}</div>
            <div v-if="roadmapAttention.length > 0" class="text-muted">{{ t.roadmapReason }}</div>
            <div v-for="(item, index) in roadmapAttention" :key="index" class="text-sm">
              <code class="font-mono text-muted">{{ item.code }}</code> <DaemonReason :reason="item.message" />
            </div>
          </div>
          <Widget v-else page="project" widget="epics" :title="t.epics" class="min-[85rem]:order-first">
            <template #default="{ full }">
              <table class="w-full border-collapse">
                <thead>
                  <tr class="text-left text-sm text-muted">
                    <th class="w-9 border-b border-default py-2 ps-3.5 pe-1 font-medium">#</th>
                    <th class="border-b border-default px-2 py-2 font-medium">{{ t.epicColumn }}</th>
                    <th class="border-b border-default py-2 ps-2 pe-3.5 font-medium">{{ t.status }}</th>
                  </tr>
                </thead>
                <tbody>
                  <!-- In Full an epic's spec takes a row of its own, under its name and status, where its path has room. -->
                  <template v-for="epic in epics" :key="epic.number">
                    <tr class="align-baseline" :class="{ 'bg-primary/10': board.data.value?.epic?.number === epic.number }">
                      <td class="border-default py-1.5 ps-3.5 pe-1 font-mono text-sm text-dimmed" :class="{ 'border-b': !full }">{{ epic.number }}</td>
                      <td lang="en" class="border-default px-2 py-1.5 leading-snug font-medium" :class="{ 'border-b': !full }">{{ epic.title }}</td>
                      <td class="border-default py-1.5 ps-2 pe-3.5 whitespace-nowrap" :class="{ 'border-b': !full }">
                        <UBadge :label="epic.status" v-bind="statusBadge(epic.status)" size="sm" lang="en" />
                      </td>
                    </tr>
                    <tr v-if="full" :class="{ 'bg-primary/10': board.data.value?.epic?.number === epic.number }">
                      <td class="border-b border-default" />
                      <td colspan="2" class="border-b border-default ps-2 pe-3.5 pb-1.5">
                        <NuxtLink
                          v-if="epic.spec !== null"
                          :to="{ query: { project, spec: epic.spec } }"
                          class="inline-flex items-start gap-1.5 font-mono text-sm break-words text-primary hover:underline"
                        >
                          <UIcon name="i-lucide-file-text" class="mt-0.5 size-3 shrink-0" /><span>specs/<wbr>{{ epic.spec }}/<wbr>spec.md</span>
                        </NuxtLink>
                        <span v-else class="text-sm text-dimmed">—</span>
                      </td>
                    </tr>
                  </template>
                </tbody>
              </table>
            </template>
          </Widget>
        </template>
      </div>

      <Widget page="project" widget="usage" :title="t.usageByRole">
        <template #aside>
          <NuxtLink :to="{ path: '/usage', query: { project } }" class="text-sm text-primary hover:underline">{{ t.usagePage }}</NuxtLink>
        </template>
        <template #default="{ full }">
          <p v-if="usage.error.value" class="m-0 px-3.5 py-2.5 text-warning"><code>{{ usage.error.value.code }}</code> {{ usage.error.value.message }}</p>
          <div v-else-if="usage.data.value === null" class="px-3.5 py-2.5"><USkeleton class="h-40 w-full" /></div>
          <div v-else class="flex flex-col gap-2 overflow-x-auto px-3.5 py-2.5">
            <p v-if="full" class="m-0 text-sm text-dimmed">
              {{ usage.data.value.importing.windowStart === null ? t.wholeWindow : t.sinceWindow(usage.data.value.importing.windowStart) }}
            </p>
            <p v-if="usage.data.value.importing.incomplete" class="m-0 text-warning">{{ t.importing }}</p>
            <p v-if="isUnavailable(usage.data.value.byRole)" class="m-0">
              <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="usage.data.value.byRole.reason" /></span>
            </p>
            <TokenKinds
              v-else
              :fields="full ? FIELDS : BRIEF_FIELDS"
              :records="full"
              :columns="[
                { key: 'product', label: t.roleProduct, totals: usage.data.value.byRole.product },
                { key: 'implementation', label: t.roleImplementation, totals: usage.data.value.byRole.implementation },
                { key: 'review', label: t.roleReview, totals: usage.data.value.byRole.review },
                { key: 'rework', label: t.roleRework, totals: usage.data.value.byRole.rework },
                { key: 'unknown', label: t.roleUnknown, totals: usage.data.value.byRole.unknown },
                ...(isUnavailable(usage.data.value.unassigned) ? [] : [{ key: 'unassigned', label: t.unassigned, totals: usage.data.value.unassigned }]),
              ]"
            />
            <p v-if="isUnavailable(usage.data.value.unassigned)" class="m-0">
              {{ t.unassigned }}: <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="usage.data.value.unassigned.reason" /></span>
            </p>
            <p v-else-if="full" class="m-0 text-sm text-dimmed">{{ t.unassignedNote }}</p>
          </div>
        </template>
      </Widget>

      <!-- Two columns, each a stack, read down then across in the documented order: a widget never waits under a taller neighbour's row. -->
      <div v-if="snapshot" class="grid grid-cols-2 items-start gap-2.5">
        <div class="flex min-w-0 flex-col gap-2.5">
          <Widget page="project" widget="checkout" :title="t.registeredCheckout">
            <template #default="{ full }">
              <div class="px-3.5 py-2.5 font-mono text-sm" :class="full ? 'wrap-anywhere' : 'truncate'" :title="gitLine(snapshot.git, t)">{{ gitLine(snapshot.git, t) }}</div>
            </template>
          </Widget>

          <Widget page="project" widget="graph" :title="t.graph">
            <template #aside>
              <span v-if="!snapshot.graph.available" class="text-sm text-muted">{{ t.notAvailable }}</span>
            </template>
            <template #default="{ full }">
              <div class="flex flex-col gap-1.5 px-3.5 py-2.5">
                <DaemonReason v-if="full && snapshot.graph.reason !== null" class="block text-sm leading-snug text-dimmed" :reason="snapshot.graph.reason" />
                <div class="text-sm" :class="{ truncate: !full }">
                  <span class="me-1.5 text-muted">{{ t.builtFrom }}</span>
                  <template v-if="snapshot.graph.builtFrom">
                    <code class="font-mono">{{ snapshot.graph.builtFrom.commit.slice(0, 12) }}</code> · {{ since(snapshot.graph.builtFrom.at) }} ·
                    <span :class="{ 'text-warning': snapshot.graph.behind }">{{ graphFreshness }}</span>
                  </template>
                  <span v-else class="text-dimmed">{{ t.notBuilt }}</span>
                  <span v-if="!full && snapshot.graph.lastRun?.outcome === 'failed'" class="text-warning"> · {{ t.lastRun }} {{ t.runOutcomes.failed }}</span>
                </div>
                <div v-if="full" class="text-sm">
                  <span class="me-1.5 text-muted">{{ t.lastRun }}</span>
                  <template v-if="snapshot.graph.lastRun">
                    <span :class="{ 'text-warning': snapshot.graph.lastRun.outcome === 'failed' }">{{ t.runOutcomes[snapshot.graph.lastRun.outcome] }}</span>
                    · <code class="font-mono">{{ snapshot.graph.lastRun.commit.slice(0, 12) }}</code> · {{ since(snapshot.graph.lastRun.at) }}
                    <DaemonReason v-if="snapshot.graph.lastRun.reason !== null" class="block text-sm leading-snug text-dimmed" :reason="snapshot.graph.lastRun.reason" />
                  </template>
                  <span v-else class="text-dimmed">{{ t.noRunYet }}</span>
                </div>
              </div>
            </template>
          </Widget>
        </div>

        <div class="flex min-w-0 flex-col gap-2.5">
          <Widget page="project" widget="decisions" :title="t.recentDecisions">
            <template #aside>
              <span v-if="snapshot.decisions !== null" class="font-mono text-sm text-dimmed">{{ number(count(snapshot.decisions)) }}</span>
            </template>
            <template #default="{ full }">
              <div v-if="snapshot.decisions === null" class="px-3.5 py-2.5 text-muted">{{ t.noAdrDirectory }}</div>
              <div v-else-if="snapshot.decisions.items.length === 0" class="px-3.5 py-2.5 text-sm text-dimmed">{{ t.none }}</div>
              <div v-else-if="!full" class="truncate px-3.5 py-2.5 text-sm">
                <span lang="en">{{ snapshot.decisions.items[0]!.title ?? t.untitled }}</span>
                <span v-if="count(snapshot.decisions) > 1" class="text-dimmed"> · {{ t.more(number(count(snapshot.decisions) - 1)) }}</span>
              </div>
              <div v-else class="flex flex-col gap-1.5 px-3.5 py-2.5">
                <ul class="flex flex-col gap-1.5">
                  <FoldedList :items="snapshot.decisions.items" :by="(item) => item.path">
                    <template #default="{ item }">
                      <li class="text-sm"><span lang="en">{{ item.title ?? t.untitled }}</span> <code class="font-mono text-dimmed">{{ item.path }}</code></li>
                    </template>
                  </FoldedList>
                </ul>
                <div v-if="snapshot.decisions.remainder > 0" class="text-sm text-dimmed">{{ t.more(number(snapshot.decisions.remainder)) }}</div>
              </div>
            </template>
          </Widget>

          <Widget page="project" widget="ci" :title="t.ci">
            <template #aside>
              <span v-if="isUnavailable(snapshot.ci)" class="text-sm text-muted">{{ t.notAvailable }}</span>
              <span v-else class="font-mono text-sm text-dimmed">{{ snapshot.ci.forge.repository }}</span>
            </template>
            <template #default="{ full }">
              <div v-if="isUnavailable(snapshot.ci)" class="px-3.5 py-2.5 text-sm leading-snug text-dimmed" :class="{ truncate: !full }">
                <DaemonReason :reason="snapshot.ci.reason" />
              </div>
              <div v-else class="flex flex-col gap-0.5 px-3.5 py-2.5">
                <div class="text-sm" :class="{ truncate: !full }">
                  <code class="font-mono">{{ snapshot.ci.defaultBranch.branch }}</code> ·
                  <span class="font-medium" :class="CI_TONE[snapshot.ci.defaultBranch.state.value]">{{ t.ciStates[snapshot.ci.defaultBranch.state.value] }}</span> ·
                  <template v-if="full">
                    <a :href="snapshot.ci.defaultBranch.url" target="_blank" rel="noopener noreferrer" class="font-mono text-default underline">{{ snapshot.ci.defaultBranch.commit.slice(0, 12) }}</a>
                    <template v-if="snapshot.ci.defaultBranch.at"> · {{ since(snapshot.ci.defaultBranch.at) }}</template>
                  </template>
                  <span v-else class="text-muted">{{ plural(count(snapshot.ci.requests), t.openRequestsCount) }}</span>
                </div>
                <template v-if="full">
                  <div class="mt-1 text-sm text-muted">{{ t.openRequests }}</div>
                  <div v-if="snapshot.ci.requests.items.length === 0" class="text-sm text-dimmed">{{ t.none }}</div>
                  <ul v-else class="flex flex-col gap-0.5">
                    <FoldedList :items="snapshot.ci.requests.items" :by="(item) => String(item.number)">
                      <template #default="{ item }">
                        <li class="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-sm">
                          <a :href="item.url" target="_blank" rel="noopener noreferrer" class="font-mono text-default underline">#{{ item.number }}</a>
                          <span lang="en" class="min-w-0 truncate">{{ item.title }}</span>
                          <span v-if="item.draft" class="text-dimmed">({{ t.draft }})</span>
                          · <code class="font-mono text-dimmed">{{ item.branch }}</code>
                          <NuxtLink v-if="item.taskId" :to="{ path: '/task', query: { project, id: item.taskId } }" class="font-mono break-words text-primary hover:underline">{{ item.taskId }}</NuxtLink>
                          · <span :class="CI_TONE[item.state.value]">{{ t.ciStates[item.state.value] }}</span>
                        </li>
                      </template>
                    </FoldedList>
                  </ul>
                  <div v-if="snapshot.ci.requests.remainder > 0" class="text-sm text-dimmed">{{ t.more(number(snapshot.ci.requests.remainder)) }}</div>
                  <div class="text-sm leading-snug text-dimmed">{{ t.ciReported(forgeName(snapshot.ci.forge)) }}</div>
                </template>
              </div>
            </template>
          </Widget>
        </div>
      </div>
    </template>
  </div>
</template>
