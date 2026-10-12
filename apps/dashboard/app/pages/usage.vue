<script setup lang="ts">
import type { BarRow } from '~/components/BarList.vue';
import { call, usePolling } from '~/composables/daemon';
import { useLanguage } from '~/composables/language';
import { isUnavailable, projectName, SELECTED_VIEW } from '~/composables/projects';
import { BRIEF_FIELDS, FIELDS, marks, tokensLine, type Context, type Field, type PonytailSide, type ProjectUsage, type Totals } from '~/composables/usage';
import { BRIEF_ROWS } from '~/widget';

/**
 * The selected project's usage. The shell's snapshot answers today, the last seven days, by
 * model, by provider and the harnesses; `usage.get`, polled here, the import window, by Task,
 * by role and the derived metrics, of the whole project or of one roadmap epic with a spec. The
 * bars show one kind of token at a time, output unless another is picked: kinds are never added
 * to one another. Each widget is *Brief* or *Full* (spec, stories 21 to 24).
 */
const view = inject(SELECTED_VIEW, ref(null));
const snapshot = computed(() => view.value?.snapshot ?? null);
const route = useRoute();
const project = typeof route.query.project === 'string' ? route.query.project : null;
const { t, plural, number, compact, dateTime } = useLanguage();

/** The roadmap's epics with a spec, which `usage.get` takes by number; `project` is the whole project. */
const scope = ref('project');
const epics = computed(() => (snapshot.value?.roadmap?.epics ?? []).filter((epic) => epic.spec !== null));
const scopes = computed(() => [{ label: t.value.wholeProject, value: 'project' }, ...epics.value.map((epic) => ({ label: `Epic ${epic.number} · ${epic.title}`, value: String(epic.number) }))]);
const epic = computed(() => (scope.value === 'project' ? null : Number(scope.value)));

const usage = usePolling(async () =>
  project === null ? null : call<ProjectUsage>('usage.get', { path: project, ...(epic.value === null ? {} : { epic: epic.value }) }),
);
watch(scope, () => {
  usage.data.value = null;
  usage.error.value = null;
  void usage.refresh();
});
// An epic the roadmap no longer lists with a spec falls back to the whole project, rather than being refused on every poll.
watch(epics, (listed) => {
  if (epic.value !== null && !listed.some((row) => row.number === epic.value)) scope.value = 'project';
});

/** CONTEXT.md's names for the harness support levels, the same in both languages. */
const LEVELS = ['Context', 'Attribution', 'Usage', 'Live'];

const kind = ref<Field>('output');
const kinds = computed(() => FIELDS.map((name) => ({ label: t.value[name], value: name })));

/**
 * A set of totals as a bar: the picked kind, not reported rather than zero, marked partial,
 * calculated or estimated, with how many records it counts after the row's own note.
 */
function tokenRow(key: string, label: string, totals: Totals, extra: Partial<BarRow> = {}): BarRow {
  const field = totals[kind.value];
  if (totals.records === 0) return { key, label, value: null, text: t.value.noRecords, ...extra };
  return {
    key,
    label,
    value: field.tokens,
    text: field.tokens === null ? t.value.notReported : number(Math.round(field.tokens)),
    marks: marks(field).map((mark) => t.value[mark]),
    ...extra,
    note: [extra.note, plural(totals.records, t.value.recordsCount)].filter((part) => part !== undefined).join(' · '),
  };
}

/** A breakdown's rows at a widget's level: in *Brief* its largest few by the picked kind, the others counted (story 22). */
function leveled(rows: BarRow[], remainder: number, full: boolean): { rows: BarRow[]; remainder: number } {
  if (full) return { rows, remainder };
  const largest = [...rows].sort((a, b) => (b.value ?? -1) - (a.value ?? -1)).slice(0, BRIEF_ROWS);
  return { rows: largest, remainder: remainder + rows.length - largest.length };
}

/** The import window, with where it starts when the daemon says, and the epic when one is picked. */
const windowLabel = computed(() => {
  const start = usage.data.value?.importing.windowStart ?? null;
  const window = start === null ? t.value.importWindow : `${t.value.importWindow}, ${t.value.sinceDate(start)}`;
  return epic.value === null ? window : `Epic ${epic.value} · ${window}`;
});

/**
 * The line under *Tokens by kind*, which has only today and the last seven days: the import
 * window's records and totals kind by kind, then each column's record count.
 */
const countsLine = computed(() => {
  const usageNow = snapshot.value?.usage;
  if (!usageNow) return '';
  const counts = `${t.value.records}: ${t.value.today} ${number(usageNow.today.records)} · ${t.value.last7Days} ${number(usageNow.last7Days.records)}.`;
  const window = usage.data.value?.totals;
  if (window === undefined) return counts;
  const totals = window.records === 0 ? t.value.noRecords : `${plural(window.records, t.value.recordsCount)} · ${tokensLine(window, t.value, number)}`;
  return `${windowLabel.value}: ${totals}. ${counts}`;
});

const taskLink = (id: string) => ({ path: '/task', query: { project, id } });

/** The derived per-Task metrics, as the page lists them. */
const perCompleted = computed(() => {
  const metric = usage.data.value?.derived.perCompletedTask;
  if (metric === undefined || isUnavailable(metric)) return null;
  return {
    mean: metric.mean === null ? null : tokenRow('mean', '', metric.mean),
    rows: metric.items.map((item) =>
      tokenRow(item.id, item.id, item.totals, { to: taskLink(item.id), title: item.title, note: plural(item.runs, t.value.runsCount) }),
    ),
    remainder: metric.remainder,
    count: metric.items.length + metric.remainder,
    withoutRuns: metric.withoutRuns,
  };
});
const runsPer = computed(() => {
  const metric = usage.data.value?.derived.runsPerTask;
  if (metric === undefined || isUnavailable(metric)) return null;
  return {
    mean: metric.mean,
    rows: metric.items.map(
      (item): BarRow => ({
        key: item.id,
        label: item.id,
        to: taskLink(item.id),
        title: item.title,
        note: t.value.ofWhichSubagents(number(item.subagentRuns)),
        value: item.runs,
        text: number(item.runs),
      }),
    ),
    remainder: metric.remainder,
    count: metric.items.length + metric.remainder,
  };
});
/** Tokens per completed Task before and after Ponytail, each side's mean of the picked kind, or why there is none. */
const ponytail = computed(() => {
  const metric = usage.data.value?.derived.ponytail;
  if (metric === undefined || isUnavailable(metric)) return null;
  const side = (key: string, label: string, value: PonytailSide | null) =>
    value === null ? null : { key, label, mean: value.mean === null ? null : tokenRow(key, label, value.mean), tasks: value.tasks };
  return {
    since: metric.since === null ? null : t.value.ponytailSince(dateTime(metric.since.at), metric.since.commit.slice(0, 7)),
    sides: [side('before', t.value.beforePonytail, metric.before), side('after', t.value.afterPonytail, metric.after)].filter((item) => item !== null),
    undated: metric.undated,
    reason: metric.reason,
  };
});
const oneDecimal = (value: number): string => number(Math.round(value * 10) / 10);
const percent = (share: number): string => t.value.percent(number(Math.round(share * 100)));

/** The rework share of each completed Task, a bar each, and their mean. */
const reworkShares = computed(() => {
  const metric = usage.data.value?.derived.reworkShare;
  if (metric === undefined || isUnavailable(metric)) return null;
  return {
    mean: metric.mean === null ? null : percent(metric.mean),
    rows: metric.items.map(
      (item): BarRow => ({ key: item.id, label: item.id, to: taskLink(item.id), title: item.title, value: item.share, text: item.share === null ? t.value.shareUnread : percent(item.share) }),
    ),
    remainder: metric.remainder,
  };
});

/** The reviewed completed Tasks, each accepted at the first pass or reworked, and the share accepted. */
const firstPass = computed(() => {
  const metric = usage.data.value?.derived.firstPassAcceptance;
  if (metric === undefined || isUnavailable(metric)) return null;
  return {
    share: metric.share === null ? null : percent(metric.share),
    count: metric.items.length + metric.remainder,
    rows: metric.items.map(
      (item): BarRow => ({ key: item.id, label: item.id, to: taskLink(item.id), title: item.title, value: null, text: item.accepted ? t.value.acceptedFirstPass : t.value.reworked }),
    ),
    remainder: metric.remainder,
  };
});

const ROLE_LABELS = { product: 'roleProduct', implementation: 'roleImplementation', review: 'roleReview', rework: 'roleRework', unknown: 'roleUnknown' } as const;

/** Each run's context growth, a bar for its largest call's context, largest first. */
const contexts = computed(() => {
  const metric = usage.data.value?.derived.contextGrowth;
  if (metric === undefined || isUnavailable(metric)) return null;
  const shown = (context: Context): string => (context.tokens === null ? t.value.notReported : compact(context.tokens));
  return {
    rows: metric.items.map(
      (item): BarRow => ({
        key: item.id,
        label: item.taskId ?? t.value.unassigned,
        to: item.taskId === null ? undefined : taskLink(item.taskId),
        muted: item.taskId === null,
        note: `${item.harness} · ${t.value[ROLE_LABELS[item.role]]}`,
        value: item.largest.tokens,
        text: t.value.contextLine(shown(item.first), shown(item.latest), shown(item.largest)),
        marks: [item.first, item.latest, item.largest].some((context) => context.partial) ? [t.value.partial] : [],
      }),
    ),
    remainder: metric.remainder,
  };
});

/** The weekly trend of the picked kind, each week scaled to the largest. */
const weeks = computed(() => {
  const items = usage.data.value?.derived.weekly.items ?? [];
  const values = items.map((item) => (item.totals.records === 0 ? null : item.totals[kind.value].tokens));
  const largest = Math.max(0, ...values.map((value) => value ?? 0));
  return items.map((item, index) => {
    const value = values[index] ?? null;
    const text = item.totals.records === 0 ? t.value.noRecords : value === null ? t.value.notReported : number(Math.round(value));
    return { week: item.week, value, largest, short: value === null ? '—' : compact(value), title: `${t.value.weekOf(item.week)}: ${text}`, marks: marks(item.totals[kind.value]).map((mark) => t.value[mark]) };
  });
});

const card = { root: 'rounded-[10px]', header: 'flex items-center justify-between gap-2 px-3.5 py-2.5 sm:px-3.5', body: 'p-0 sm:p-0', footer: 'px-3.5 py-2 sm:px-3.5' };
</script>

<template>
  <div class="flex flex-col gap-5 pt-4">
    <p v-if="project === null" class="text-warning">{{ t.noProjectAddress }}</p>
    <p v-else-if="view === null" class="text-muted">{{ t.unknownProject }}</p>
    <p v-else-if="view.project.unavailable !== null" class="text-muted">
      <span class="font-medium text-default">{{ t.notAvailable }}</span> · <span lang="en">{{ view.project.unavailable }}</span>
    </p>
    <p v-else-if="view.failure" class="text-warning"><code>{{ view.failure.code }}</code> <span lang="en">{{ view.failure.message }}</span></p>
    <template v-else-if="snapshot">
      <div class="flex flex-col gap-1">
        <div class="flex flex-wrap items-center gap-x-2.5 gap-y-2">
          <h1 class="text-xl font-semibold text-highlighted">{{ t.usage }}</h1>
          <span class="text-muted">{{ projectName(view.project) }}</span>
          <span class="ml-auto flex flex-wrap items-center gap-2.5">
            <span v-if="epics.length > 0" class="flex items-center gap-2.5">
              <span class="text-sm text-muted">{{ t.usageOf }}</span>
              <USelect v-model="scope" :items="scopes" size="sm" class="min-w-56" :aria-label="t.usageOf" />
            </span>
            <span class="text-sm text-muted">{{ t.barsShow }}</span>
            <UTabs v-model="kind" :items="kinds" :content="false" variant="pill" size="xs" :aria-label="t.barsShow" />
          </span>
        </div>
        <p class="text-sm text-muted">{{ t.usageNote }}</p>
        <p v-if="snapshot.usage.importing.incomplete || usage.data.value?.importing.incomplete" class="text-warning">{{ t.importing }}</p>
      </div>

      <!-- Two columns, each a stack, read down then across in the documented order; the last widget of each stretches, so none leaves a hole. -->
      <div class="grid grid-cols-[repeat(auto-fit,minmax(400px,1fr))] gap-5">
        <div class="flex min-w-0 flex-col gap-5 *:last:flex-1">
          <Widget page="usage" widget="kinds" :title="t.tokensByKind">
            <template #default="{ full }">
              <div class="px-3.5">
                <TokenKinds
                  :columns="[
                    { key: 'today', label: t.today, totals: snapshot.usage.today },
                    { key: 'week', label: t.last7Days, totals: snapshot.usage.last7Days },
                  ]"
                  :records="false"
                  :fields="full ? FIELDS : BRIEF_FIELDS"
                />
                <p v-if="full" class="border-t border-default py-2 text-sm leading-snug text-muted">{{ countsLine }}</p>
              </div>
            </template>
            <template #footer="{ full }">
              <p v-if="full" class="text-sm leading-snug text-dimmed">{{ t.reasoningNote }}</p>
            </template>
          </Widget>

          <Widget page="usage" widget="models" :title="t.byModel">
            <template #aside>
              <span class="text-sm text-dimmed">{{ t[kind] }} · {{ t.last7Days }}</span>
            </template>
            <template #default="{ full }">
              <p v-if="snapshot.usage.byModel.items.length === 0" class="px-3.5 py-3 text-muted">{{ t.noRecords }}</p>
              <BarList
                v-else
                class="py-1"
                v-bind="
                  leveled(
                    snapshot.usage.byModel.items.map((item) => tokenRow(String(item.model), item.model ?? t.modelNotReported, item.totals, { muted: item.model === null })),
                    snapshot.usage.byModel.remainder,
                    full,
                  )
                "
              />
              <h3 class="border-t border-default px-3.5 pt-2.5 pb-1 text-sm font-semibold">{{ t.byProvider }}</h3>
              <p v-if="snapshot.usage.byProvider.items.length === 0" class="px-3.5 py-3 text-muted">{{ t.noRecords }}</p>
              <BarList
                v-else
                class="pb-1"
                v-bind="
                  leveled(
                    snapshot.usage.byProvider.items.map((item) => tokenRow(String(item.provider), item.provider ?? t.notReported, item.totals, { muted: item.provider === null })),
                    snapshot.usage.byProvider.remainder,
                    full,
                  )
                "
              />
            </template>
          </Widget>

          <Widget page="usage" widget="tasks" :title="t.byTask">
            <template #aside>
              <span class="text-sm text-dimmed">{{ epic === null ? t.largestTasks : `Epic ${epic}` }} · {{ t[kind] }}</span>
            </template>
            <template #default="{ full }">
              <p v-if="usage.error.value" class="px-3.5 py-3 text-warning"><code>{{ usage.error.value.code }}</code> {{ usage.error.value.message }}</p>
              <USkeleton v-else-if="usage.data.value === null" class="m-3.5 h-32" />
              <template v-else>
                <p v-if="isUnavailable(usage.data.value.tasks)" class="px-3.5 py-3">
                  <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="usage.data.value.tasks.reason" /></span>
                </p>
                <template v-else>
                  <p v-if="usage.data.value.tasks.items.length === 0" class="px-3.5 pt-3 text-muted">{{ t.noTaskRuns }}</p>
                  <BarList
                    class="py-1"
                    v-bind="
                      leveled(
                        usage.data.value.tasks.items.map((item) => tokenRow(item.id, item.id, item.totals, { to: taskLink(item.id), title: item.title })),
                        usage.data.value.tasks.remainder,
                        full,
                      )
                    "
                    :last="full && epic === null && !isUnavailable(usage.data.value.unassigned) ? tokenRow('unassigned', t.unassigned, usage.data.value.unassigned, { muted: true }) : undefined"
                  />
                </template>
                <p v-if="full && epic === null && isUnavailable(usage.data.value.unassigned)" class="px-3.5 pb-2 text-sm">
                  {{ t.unassigned }}: <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="usage.data.value.unassigned.reason" /></span>
                </p>
                <h3 class="border-t border-default px-3.5 pt-2.5 pb-1 text-sm font-semibold">{{ t.byRole }}</h3>
                <p v-if="isUnavailable(usage.data.value.byRole)" class="px-3.5 py-3">
                  <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="usage.data.value.byRole.reason" /></span>
                </p>
                <BarList
                  v-else
                  class="pb-1"
                  v-bind="
                    leveled(
                      [
                        tokenRow('product', t.roleProduct, usage.data.value.byRole.product),
                        tokenRow('implementation', t.roleImplementation, usage.data.value.byRole.implementation),
                        tokenRow('review', t.roleReview, usage.data.value.byRole.review),
                        tokenRow('rework', t.roleRework, usage.data.value.byRole.rework),
                        tokenRow('unknown', t.roleUnknown, usage.data.value.byRole.unknown, { muted: true }),
                      ],
                      0,
                      full,
                    )
                  "
                />
              </template>
            </template>
            <template #footer="{ full }">
              <p class="text-sm leading-snug text-dimmed">{{ windowLabel }}.<template v-if="full && epic === null"> {{ t.unassignedNote }}</template></p>
            </template>
          </Widget>
        </div>

        <div class="flex min-w-0 flex-col gap-5 *:last:flex-1">
          <Widget page="usage" widget="derived" :title="t.derived">
            <template #aside>
              <span v-if="epic !== null" class="text-sm text-dimmed">Epic {{ epic }}</span>
              <UBadge :label="t.calculation" color="neutral" variant="outline" class="border-dashed" :title="t.derivedNote" />
            </template>
            <template #default="{ full }">
              <p v-if="usage.error.value" class="px-3.5 py-3 text-warning"><code>{{ usage.error.value.code }}</code> {{ usage.error.value.message }}</p>
              <USkeleton v-else-if="usage.data.value === null" class="m-3.5 h-40" />
              <template v-else>
                <div class="grid grid-cols-2 divide-x divide-default">
                  <section class="flex min-w-0 flex-col gap-1">
                    <div class="flex flex-col gap-1 px-3.5 pt-3 pb-1.5">
                      <h3 class="text-sm leading-snug text-muted">{{ t.perCompletedTask }} · {{ t[kind] }}</h3>
                      <p v-if="isUnavailable(usage.data.value.derived.perCompletedTask)">
                        <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="usage.data.value.derived.perCompletedTask.reason" /></span>
                      </p>
                      <template v-else-if="perCompleted">
                        <template v-if="perCompleted.mean">
                          <span class="inline-flex items-center gap-1.5">
                            <span class="font-mono text-xl font-medium">{{ perCompleted.mean.text }}</span>
                            <UBadge v-for="mark in perCompleted.mean.marks" :key="mark" :label="mark" color="neutral" variant="outline" size="sm" />
                          </span>
                          <span class="text-xs text-dimmed">{{ plural(perCompleted.count, t.meanOverDone) }}</span>
                        </template>
                        <p v-else class="text-muted">{{ perCompleted.withoutRuns === 0 ? t.noDoneTask : t.noDoneWithRuns(number(perCompleted.withoutRuns)) }}</p>
                        <span v-if="full && perCompleted.mean && perCompleted.withoutRuns > 0" class="text-xs text-dimmed">{{ plural(perCompleted.withoutRuns, t.doneWithoutRuns) }}</span>
                      </template>
                    </div>
                    <BarList v-if="full && perCompleted && perCompleted.rows.length > 0" class="pb-1" :rows="perCompleted.rows" :remainder="perCompleted.remainder" />
                  </section>
                  <section class="flex min-w-0 flex-col gap-1">
                    <div class="flex flex-col gap-1 px-3.5 pt-3 pb-1.5">
                      <h3 class="text-sm leading-snug text-muted">{{ t.runsPerTask }}</h3>
                      <p v-if="isUnavailable(usage.data.value.derived.runsPerTask)">
                        <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="usage.data.value.derived.runsPerTask.reason" /></span>
                      </p>
                      <template v-else-if="runsPer">
                        <template v-if="runsPer.mean">
                          <span class="font-mono text-xl font-medium">{{ oneDecimal(runsPer.mean.runs) }}</span>
                          <span class="text-xs text-dimmed">{{ plural(runsPer.count, t.meanOverTasks) }} · {{ t.ofWhichSubagents(oneDecimal(runsPer.mean.subagentRuns)) }}</span>
                        </template>
                        <p v-else class="text-muted">{{ t.noTaskRuns }}</p>
                      </template>
                    </div>
                    <BarList v-if="full && runsPer && runsPer.rows.length > 0" class="pb-1" :rows="runsPer.rows" :remainder="runsPer.remainder" />
                  </section>
                </div>
                <section class="flex flex-col gap-1.5 border-t border-default px-3.5 py-3">
                  <h3 class="text-sm leading-snug text-muted">{{ t.ponytail }} · {{ t[kind] }}</h3>
                  <p v-if="isUnavailable(usage.data.value.derived.ponytail)">
                    <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="usage.data.value.derived.ponytail.reason" /></span>
                  </p>
                  <template v-else-if="ponytail">
                    <div v-if="ponytail.sides.length > 0" class="grid grid-cols-2 gap-3">
                      <div v-for="side in ponytail.sides" :key="side.key" class="flex min-w-0 flex-col gap-0.5">
                        <span class="text-xs text-dimmed">{{ side.label }}</span>
                        <span v-if="side.mean" class="inline-flex items-center gap-1.5">
                          <span class="font-mono text-xl font-medium">{{ side.mean.text }}</span>
                          <UBadge v-for="mark in side.mean.marks" :key="mark" :label="mark" color="neutral" variant="outline" size="sm" />
                        </span>
                        <span v-else class="font-mono text-xl text-dimmed">—</span>
                        <span class="text-xs text-dimmed">{{ plural(side.tasks, t.meanOverDone) }}</span>
                      </div>
                    </div>
                    <DaemonReason v-if="ponytail.reason !== null" class="block text-muted" :reason="ponytail.reason" />
                    <p v-if="full && ponytail.since" class="text-xs text-dimmed">{{ ponytail.since }}</p>
                    <p v-if="full && ponytail.undated > 0" class="text-xs text-dimmed">{{ plural(ponytail.undated, t.ponytailUndated) }}</p>
                  </template>
                </section>
                <section v-if="full" class="flex flex-col gap-2.5 border-t border-default px-3.5 py-3">
                  <h3 class="text-sm text-muted">{{ t.weekly }} · {{ t[kind] }}</h3>
                  <p v-if="weeks.length === 0" class="text-muted">{{ t.noRecords }}</p>
                  <ol v-else class="grid auto-cols-[minmax(0,56px)] grid-flow-col gap-2">
                    <li v-for="week in weeks" :key="week.week" class="flex min-w-0 flex-col items-center gap-1" :title="week.title">
                      <UProgress
                        v-if="week.value !== null && week.largest > 0"
                        :model-value="week.value"
                        :max="week.largest"
                        orientation="vertical"
                        inverted
                        class="h-24 w-full"
                        :ui="{ base: 'w-full rounded-t-sm rounded-b-none bg-transparent', indicator: 'rounded-t-sm rounded-b-none' }"
                      />
                      <div v-else class="h-24" />
                      <span class="max-w-full truncate font-mono text-xs">{{ week.short }}</span>
                      <span v-for="mark in week.marks" :key="mark" class="text-xs text-dimmed">{{ mark }}</span>
                      <span class="max-w-full truncate text-xs text-dimmed">{{ week.week.slice(5) }}</span>
                    </li>
                  </ol>
                  <p class="text-xs text-dimmed">{{ t.weeklyNote }}</p>
                </section>
                <div class="grid grid-cols-2 divide-x divide-default border-t border-default">
                  <section class="flex min-w-0 flex-col gap-1">
                    <div class="flex flex-col gap-1 px-3.5 pt-3 pb-1.5">
                      <h3 class="text-sm leading-snug text-muted">{{ t.reworkShare }}</h3>
                      <p v-if="isUnavailable(usage.data.value.derived.reworkShare)">
                        <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="usage.data.value.derived.reworkShare.reason" /></span>
                      </p>
                      <template v-else-if="reworkShares">
                        <template v-if="reworkShares.mean !== null">
                          <span class="font-mono text-xl font-medium">{{ reworkShares.mean }}</span>
                          <span class="text-xs text-dimmed">{{ t.meanShareOver }}</span>
                        </template>
                        <p v-else class="text-muted">{{ t.noShare }}</p>
                        <span v-if="full" class="text-xs text-dimmed">{{ t.reworkShareNote }}</span>
                      </template>
                    </div>
                    <BarList v-if="full && reworkShares && reworkShares.rows.length > 0" class="pb-1" :rows="reworkShares.rows" :remainder="reworkShares.remainder" />
                  </section>
                  <section class="flex min-w-0 flex-col gap-1">
                    <div class="flex flex-col gap-1 px-3.5 pt-3 pb-1.5">
                      <h3 class="text-sm leading-snug text-muted">{{ t.firstPassAcceptance }}</h3>
                      <p v-if="isUnavailable(usage.data.value.derived.firstPassAcceptance)">
                        <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="usage.data.value.derived.firstPassAcceptance.reason" /></span>
                      </p>
                      <template v-else-if="firstPass">
                        <template v-if="firstPass.share !== null">
                          <span class="font-mono text-xl font-medium">{{ firstPass.share }}</span>
                          <span class="text-xs text-dimmed">{{ plural(firstPass.count, t.acceptedOf) }}</span>
                        </template>
                        <p v-else class="text-muted">{{ t.noReviewedDone }}</p>
                      </template>
                    </div>
                    <BarList v-if="full && firstPass && firstPass.rows.length > 0" class="pb-1" :rows="firstPass.rows" :remainder="firstPass.remainder" />
                  </section>
                </div>
                <section v-if="full" class="flex flex-col gap-1 border-t border-default">
                  <h3 class="px-3.5 pt-3 pb-1.5 text-sm text-muted">{{ t.contextGrowth }}</h3>
                  <p v-if="isUnavailable(usage.data.value.derived.contextGrowth)" class="px-3.5 pb-2">
                    <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="usage.data.value.derived.contextGrowth.reason" /></span>
                  </p>
                  <template v-else-if="contexts">
                    <p v-if="contexts.rows.length === 0" class="px-3.5 pb-2 text-muted">{{ t.noRunsSeen }}</p>
                    <BarList v-else class="pb-1" :rows="contexts.rows" :remainder="contexts.remainder" />
                    <p class="px-3.5 pb-3 text-xs text-dimmed">{{ t.contextNote }}</p>
                  </template>
                </section>
              </template>
            </template>
            <template #footer>
              <p class="text-sm leading-snug text-dimmed">{{ epic === null ? t.derivedNote : t.epicAverages }} {{ windowLabel }}.</p>
            </template>
          </Widget>

          <Widget page="usage" widget="harnesses" :title="t.harnesses">
            <template #default="{ full }">
              <ul class="divide-y divide-default">
                <li v-for="item in snapshot.usage.harnesses" :key="item.harness" class="flex flex-col gap-1.5 px-3.5 py-2.5">
                  <div class="flex items-center gap-2.5">
                    <span class="flex-1 font-mono text-sm font-medium">{{ item.harness }}</span>
                    <template v-if="item.level !== null">
                      <span class="flex gap-0.5" aria-hidden="true">
                        <span v-for="step in 4" :key="step" class="h-1.5 w-3.5 rounded-xs" :class="step <= item.level ? 'bg-primary' : 'bg-accented'" />
                      </span>
                      <span class="text-sm whitespace-nowrap text-muted">{{ t.levelOf(number(item.level)) }} · <span lang="en">{{ LEVELS[item.level - 1] }}</span></span>
                    </template>
                    <span v-else class="text-sm text-muted">{{ t.noLevel }}</span>
                  </div>
                  <DaemonReason v-if="full && item.reason !== null" class="block text-sm leading-snug text-dimmed" :reason="item.reason" />
                </li>
              </ul>
            </template>
            <template #footer="{ full }">
              <p v-if="full" class="text-xs leading-normal text-dimmed">{{ t.levelsLegend }}</p>
            </template>
          </Widget>

          <UCard :ui="card">
            <template #header>
              <h2 class="text-base font-semibold">{{ t.cost }}</h2>
            </template>
            <div class="flex flex-col gap-1 px-3.5 py-3">
              <span class="font-medium">{{ t.notAvailable }}</span>
              <span class="leading-snug text-muted">{{ t.costReason }}</span>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </div>
</template>
