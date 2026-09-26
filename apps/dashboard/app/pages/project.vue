<script setup lang="ts">
import { call, usePolling } from '~/composables/daemon';
import { useLanguage } from '~/composables/language';
import { count, isUnavailable, projectName, type Board, type Card, type LatestRun, type ProjectRow, type Section, type Snapshot, type Unavailable } from '~/composables/projects';
import type { ProjectUsage } from '~/composables/usage';

type ProjectSnapshot = Snapshot & {
  project: ProjectRow;
  decisions: Section<{ title: string | null; path: string }> | null;
  pendingDecisions: Unavailable;
  ci: Unavailable;
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

const { t, plural, number, since } = useLanguage();
const route = useRoute();
const router = useRouter();
const project = typeof route.query.project === 'string' ? route.query.project : null;
/** The board's group: an epic's spec, the Tasks without one, or, by default, the current epic. */
const group = (): { spec?: string | null } => {
  if (route.query.withoutSpec !== undefined) return { spec: null };
  return typeof route.query.spec === 'string' ? { spec: route.query.spec } : {};
};

const snapshot = usePolling(async () => (project === null ? null : call<ProjectSnapshot>('project.snapshot', { path: project })));
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

const epics = computed(() => snapshot.data.value?.roadmap?.epics ?? []);
/** The roadmap's first epic not done: the board's default, as `task.list` reads it. */
const current = computed(() => epics.value.find((epic) => epic.status !== 'done') ?? null);
const tabs = computed(() =>
  epics.value.map((epic) => ({ label: String(epic.number), value: String(epic.number), disabled: epic.spec === null && epic !== current.value })),
);
function pick(value: string | number): void {
  const epic = epics.value.find((item) => String(item.number) === String(value));
  if (epic === undefined) return;
  void router.push({ query: epic.spec === null ? { project } : { project, spec: epic.spec } });
}

/** A roadmap status as a badge: done is quiet, in progress is the accent, the rest are outlined. */
const statusBadge = (status: string) =>
  status === 'done'
    ? { color: 'neutral' as const, variant: 'soft' as const }
    : status === 'in progress'
      ? { color: 'primary' as const, variant: 'soft' as const }
      : { color: status === 'not started' ? ('neutral' as const) : ('primary' as const), variant: 'outline' as const };

const boardEmpty = computed(() => {
  const value = board.data.value;
  return value !== null && COLUMNS.every(([key]) => count(value.columns[key]) === 0) && count(value.unknown) === 0 && value.cancelled === 0;
});
const shown = (key: ColumnKey, cards: Card[]): Card[] => (key === 'done' && !doneOpen.value ? cards.slice(0, DONE_SHOWN) : cards);
const run = (latest: LatestRun): string => [latest.harness, latest.model ?? t.value.modelNotReported, latest.role].join(' · ');

const roadmapAttention = computed(() => snapshot.data.value?.attention.filter((item) => item.code.startsWith('roadmap.')) ?? []);
function gitLine(git: Snapshot['git']): string {
  if (!git.available) return `${t.value.gitUnavailable} ${git.reason}`;
  const head = git.detached ? t.value.detachedHead : (git.branch ?? t.value.noBranch);
  return [head, git.commit?.slice(0, 12) ?? t.value.noCommits, git.dirty ? t.value.dirty : t.value.clean].join(' · ');
}
</script>

<template>
  <div class="flex flex-col gap-6 pt-4">
    <p v-if="project === null" class="m-0 text-warning">{{ t.noProjectAddress }}</p>
    <template v-else>
      <p v-if="snapshot.error.value" class="m-0 text-warning"><code>{{ snapshot.error.value.code }}</code> {{ snapshot.error.value.message }}</p>
      <USkeleton v-else-if="snapshot.data.value === null" class="h-40 w-full" />
      <template v-else>
        <div class="flex flex-col gap-0.5">
          <h1 class="m-0 text-lg font-semibold text-highlighted">{{ projectName(snapshot.data.value.project) }}</h1>
          <span class="font-mono text-[11.5px] text-dimmed">{{ snapshot.data.value.project.path }}</span>
        </div>

        <div v-if="snapshot.data.value.roadmap === null" class="flex flex-col gap-1.5 rounded-lg border border-dashed border-accented p-4">
          <div><span class="font-medium">{{ t.notAvailable }}</span> · {{ t.noRoadmap }}</div>
          <div v-if="roadmapAttention.length > 0" class="text-muted">{{ t.roadmapReason }}</div>
          <div v-for="(item, index) in roadmapAttention" :key="index" lang="en" class="text-xs">
            <code class="font-mono text-muted">{{ item.code }}</code> {{ item.message }}
          </div>
        </div>
        <section v-else class="flex flex-col gap-2.5">
          <h2 class="m-0 text-[13px] font-semibold">{{ t.epics }}</h2>
          <div class="overflow-auto rounded-lg border border-default bg-default">
            <table class="w-full border-collapse">
              <thead>
                <tr class="text-left text-xs text-muted">
                  <th class="w-9 border-b border-default px-3.5 py-2 font-medium">#</th>
                  <th class="border-b border-default px-3.5 py-2 font-medium">{{ t.epicColumn }}</th>
                  <th class="border-b border-default px-3.5 py-2 font-medium">{{ t.status }}</th>
                  <th class="border-b border-default px-3.5 py-2 font-medium">{{ t.spec }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="epic in epics" :key="epic.number" :class="{ 'bg-primary/10': board.data.value?.epic?.number === epic.number }">
                  <td class="border-b border-default px-3.5 py-2 font-mono text-xs text-dimmed">{{ epic.number }}</td>
                  <td lang="en" class="border-b border-default px-3.5 py-2 font-medium">{{ epic.title }}</td>
                  <td class="border-b border-default px-3.5 py-2">
                    <UBadge :label="epic.status" v-bind="statusBadge(epic.status)" size="sm" lang="en" />
                  </td>
                  <td class="border-b border-default px-3.5 py-2">
                    <NuxtLink
                      v-if="epic.spec !== null"
                      :to="{ query: { project, spec: epic.spec } }"
                      class="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-primary hover:underline"
                    >
                      <UIcon name="i-lucide-file-text" class="size-3 shrink-0" />specs/{{ epic.spec }}/spec.md
                    </NuxtLink>
                    <span v-else class="text-dimmed">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <section class="flex flex-col gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <h2 class="m-0 text-[13px] font-semibold">{{ t.board }}</h2>
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
          <span v-else-if="board.data.value?.spec" class="font-mono text-xs">{{ board.data.value.spec }}</span>
          <span class="flex-1" />
          <NuxtLink
            v-if="board.data.value && board.data.value.withoutSpec > 0 && route.query.withoutSpec === undefined"
            :to="{ query: { project, withoutSpec: null } }"
            class="text-xs text-primary hover:underline"
          >
            {{ t.tasksWithoutSpec }} ({{ number(board.data.value.withoutSpec) }})
          </NuxtLink>
        </div>

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
            <div v-for="[key, label, plain] in COLUMNS" :key="key" class="flex min-w-0 flex-col gap-2 rounded-lg border border-default bg-muted p-2">
              <div class="flex items-center justify-between px-1 py-0.5">
                <span class="text-xs font-semibold">{{ label }}</span>
                <span class="font-mono text-[11.5px] text-dimmed">{{ number(count(board.data.value.columns[key])) }}</span>
              </div>
              <div v-if="board.data.value.columns[key].items.length === 0" class="px-1.5 py-2.5 text-xs text-dimmed">{{ t.empty }}</div>
              <NuxtLink
                v-for="card in shown(key, board.data.value.columns[key].items)"
                :key="card.id"
                :to="{ path: '/task', query: { project, id: card.id } }"
                class="flex flex-col gap-1.5 rounded-md border border-default bg-default px-2.5 py-2 hover:border-accented"
                :class="{ 'opacity-60': card.unmetDependencies.length > 0 }"
              >
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="font-mono text-[11px] text-muted">{{ card.id }}</span>
                  <span class="flex-1" />
                  <UBadge v-if="card.state === 'BLOCKED'" label="BLOCKED" color="error" variant="soft" size="sm" class="font-mono" />
                  <span v-else-if="card.state !== plain && card.source !== 'runs'" class="font-mono text-[10.5px] text-dimmed">{{ card.state }}</span>
                  <template v-if="card.state === 'DONE' && card.review !== null">
                    <UBadge v-if="card.review" label="Review" color="neutral" variant="soft" size="sm" :title="t.reviewRecorded" />
                    <UBadge v-else :label="t.noReview" color="warning" variant="soft" size="sm" />
                  </template>
                </div>
                <div lang="en" class="text-[12.5px] leading-snug text-highlighted">{{ card.title ?? t.untitled }}</div>
                <div v-if="card.unmetDependencies.length > 0" class="text-[11px] text-muted">
                  {{ t.unmetDependency }} <span class="font-mono">{{ card.unmetDependencies.join(', ') }}</span>
                </div>
                <div v-if="card.latestRun" class="flex flex-col gap-0.5 rounded bg-elevated px-1.5 py-1 text-[11px]">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span
                      class="size-1.5 shrink-0 rounded-full"
                      :class="card.latestRun.active.value ? 'bg-success motion-safe:animate-pulse' : 'bg-(--ui-text-dimmed)'"
                      :title="`${card.latestRun.active.value ? t.activeNow : t.notActiveNow}. ${t.runningReading}`"
                    />
                    <span v-if="card.source === 'runs'" class="font-medium text-primary" :title="t.fromRunsReading">{{ t.fromRuns }}</span>
                    <span class="text-dimmed">{{ since(card.latestRun.lastActivityAt) }}</span>
                  </div>
                  <div class="font-mono break-words text-muted">{{ run(card.latestRun) }}</div>
                  <div v-if="card.source === 'runs'" class="text-dimmed">{{ t.ticketSays(card.state ?? t.noState) }}</div>
                </div>
              </NuxtLink>
              <UButton
                v-if="key === 'done' && board.data.value.columns.done.items.length > DONE_SHOWN"
                :label="doneOpen ? t.showFewer : plural(board.data.value.columns.done.items.length - DONE_SHOWN, t.showMore)"
                color="neutral"
                variant="ghost"
                size="xs"
                block
                @click="doneOpen = !doneOpen"
              />
              <div
                v-if="board.data.value.columns[key].remainder > 0 && (key !== 'done' || doneOpen)"
                class="px-1.5 text-xs text-dimmed"
              >
                {{ t.more(number(board.data.value.columns[key].remainder)) }}
              </div>
            </div>
          </div>
          <p v-if="board.data.value.cancelled > 0" class="m-0 text-xs text-muted">{{ plural(board.data.value.cancelled, t.cancelled) }}</p>
          <div v-if="count(board.data.value.unknown) > 0" class="flex flex-col gap-1.5">
            <h3 class="m-0 text-xs font-semibold text-muted">{{ t.unknownState }}</h3>
            <div v-for="card in board.data.value.unknown.items" :key="card.id" class="flex flex-wrap items-baseline gap-x-1.5 text-xs">
              <NuxtLink :to="{ path: '/task', query: { project, id: card.id } }" class="font-mono text-primary hover:underline">{{ card.id }}</NuxtLink>
              <span lang="en">{{ card.title ?? t.untitled }}</span>
              <span v-if="card.diagnostic" lang="en" class="text-warning"><code>{{ card.diagnostic.code }}</code> {{ card.diagnostic.message }}</span>
            </div>
            <div v-if="board.data.value.unknown.remainder > 0" class="text-xs text-dimmed">{{ t.more(number(board.data.value.unknown.remainder)) }}</div>
          </div>
        </template>
      </section>

      <section class="flex flex-col gap-2.5">
        <div class="flex items-center gap-3">
          <h2 class="m-0 text-[13px] font-semibold">{{ t.usageByRole }}</h2>
          <span class="flex-1" />
          <NuxtLink :to="{ path: '/usage', query: { project } }" class="text-xs text-primary hover:underline">{{ t.usagePage }}</NuxtLink>
        </div>
        <p v-if="usage.error.value" class="m-0 text-warning"><code>{{ usage.error.value.code }}</code> {{ usage.error.value.message }}</p>
        <USkeleton v-else-if="usage.data.value === null" class="h-40 w-full" />
        <div v-else class="flex flex-col gap-2 rounded-lg border border-default bg-default px-3.5 py-2.5">
          <p v-if="usage.data.value.importing.incomplete" class="m-0 text-warning">{{ t.importing }}</p>
          <p v-if="isUnavailable(usage.data.value.byRole)" class="m-0">
            <span class="font-medium">{{ t.notAvailable }}</span> <span lang="en" class="text-muted">· {{ usage.data.value.byRole.reason }}</span>
          </p>
          <TokenKinds
            v-else
            :columns="[
              { key: 'product', label: t.roleProduct, totals: usage.data.value.byRole.product },
              { key: 'implementation', label: t.roleImplementation, totals: usage.data.value.byRole.implementation },
              { key: 'unknown', label: t.roleUnknown, totals: usage.data.value.byRole.unknown },
              ...(isUnavailable(usage.data.value.unassigned) ? [] : [{ key: 'unassigned', label: t.unassigned, totals: usage.data.value.unassigned }]),
            ]"
          />
          <p v-if="isUnavailable(usage.data.value.unassigned)" class="m-0">
            {{ t.unassigned }}: <span class="font-medium">{{ t.notAvailable }}</span> <span lang="en" class="text-muted">· {{ usage.data.value.unassigned.reason }}</span>
          </p>
          <p v-else class="m-0 text-xs text-dimmed">{{ t.unassignedNote }}</p>
        </div>
      </section>

      <div v-if="snapshot.data.value" class="grid grid-cols-2 gap-2.5">
        <section class="flex flex-col gap-1.5 rounded-lg border border-default bg-default px-3.5 py-2.5">
          <h2 class="m-0 text-[13px] font-semibold">{{ t.registeredCheckout }}</h2>
          <div class="font-mono text-xs">{{ gitLine(snapshot.data.value.git) }}</div>
        </section>
        <section class="flex flex-col gap-1.5 rounded-lg border border-default bg-default px-3.5 py-2.5">
          <h2 class="m-0 text-[13px] font-semibold">{{ t.recentDecisions }}</h2>
          <div v-if="snapshot.data.value.decisions === null" class="text-muted">{{ t.noAdrDirectory }}</div>
          <template v-else>
            <div v-for="item in snapshot.data.value.decisions.items" :key="item.path" class="text-xs">
              <span lang="en">{{ item.title ?? t.untitled }}</span> <code class="font-mono text-dimmed">{{ item.path }}</code>
            </div>
            <div v-if="snapshot.data.value.decisions.remainder > 0" class="text-xs text-dimmed">{{ t.more(number(snapshot.data.value.decisions.remainder)) }}</div>
          </template>
        </section>
        <section
          v-for="{ title, element } in [
            { title: t.pendingDecisions, element: snapshot.data.value.pendingDecisions },
            { title: t.ci, element: snapshot.data.value.ci },
          ]"
          :key="title"
          class="flex flex-col gap-0.5 rounded-lg border border-default bg-default px-3.5 py-2.5"
        >
          <div class="flex justify-between gap-2">
            <h2 class="m-0 text-[13px] font-semibold">{{ title }}</h2>
            <span class="text-xs text-muted">{{ t.notAvailable }}</span>
          </div>
          <div lang="en" class="text-[11.5px] leading-snug text-dimmed">{{ element.reason }}</div>
        </section>
      </div>
    </template>
  </div>
</template>
