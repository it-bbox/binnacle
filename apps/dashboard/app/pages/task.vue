<script setup lang="ts">
import { call, usePolling, type Failure } from '~/composables/daemon';
import { useLanguage } from '~/composables/language';
import { isUnavailable, type Unavailable } from '~/composables/projects';
import { tokensLine, type TaskUsage } from '~/composables/usage';

/** `task.get`'s brief, as the Task page renders it. */
type Brief = {
  id: string;
  title: string | null;
  state: string | null;
  triage: string | null;
  ticket: string;
  spec: string | null;
  dependencies: { id: string; title: string | null; state: string | null; met: boolean | null; dangling: boolean }[];
  body: { text: string; truncated: boolean };
  branch: string;
  start: string | null;
  review: { text: string; truncated: boolean } | Unavailable | null;
  diagnostics: Failure[];
};

const { t, plural, number, since, dateTime } = useLanguage();
const route = useRoute();
const project = typeof route.query.project === 'string' ? route.query.project : null;
const id = typeof route.query.id === 'string' ? route.query.id : null;
const { data, error } = usePolling(async () => (project === null || id === null ? null : call<Brief>('task.get', { path: project, id })));
// Apart from the brief, so that a failing `usage.get` leaves the brief standing.
const { data: usage, error: usageError } = usePolling(async () => (project === null || id === null ? null : call<TaskUsage>('usage.get', { path: project, task: id })));

/**
 * In progress from its runs, as the board reads it (ADR-0032): the ticket says `READY` and runs
 * are attributed to it. Its start command then resumes it.
 */
const fromRuns = computed(() => data.value?.state === 'READY' && usage.value !== null && usage.value.runs.items.length > 0);

/** A ticket state as a badge: Done is quiet, work under way is the accent, Blocked is an error. */
function stateBadge(state: string | null) {
  switch (state) {
    case 'DONE':
    case 'MERGED':
      return { color: 'neutral' as const, variant: 'soft' as const };
    case 'BLOCKED':
      return { color: 'error' as const, variant: 'soft' as const };
    case 'READY':
      return { color: 'primary' as const, variant: 'outline' as const };
    case 'ACTIVE':
    case 'READY_FOR_REVIEW':
    case 'APPROVED':
    case 'MERGE_READY':
      return { color: 'primary' as const, variant: 'soft' as const };
    default:
      return { color: 'neutral' as const, variant: 'outline' as const };
  }
}

const dependency = (item: Brief['dependencies'][number]): string =>
  item.dangling ? t.value.dangling : `${item.state ?? t.value.noState}, ${item.met ? t.value.met : t.value.notMet}`;

const notAvailableRows = computed(() => [{ element: t.value.questions, reason: t.value.questionsReason }]);
</script>

<template>
  <div class="flex flex-col gap-5 pt-4">
    <p v-if="project === null || id === null" class="m-0 text-warning">{{ t.noTaskAddress }}</p>
    <p v-else-if="error" class="m-0 text-warning"><code>{{ error.code }}</code> {{ error.message }}</p>
    <USkeleton v-else-if="data === null" class="h-40 w-full" />
    <template v-else>
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-[12.5px] text-muted">{{ data.id }}</span>
          <UBadge :label="data.state ?? t.noState" v-bind="stateBadge(data.state)" class="font-mono" />
          <template v-if="fromRuns">
            <UBadge label="In progress" color="primary" variant="soft" />
            <span class="text-xs text-muted" :title="t.fromRunsReading">{{ t.fromRuns }}, {{ t.ticketSays(data.state ?? t.noState) }}</span>
          </template>
        </div>
        <h1 lang="en" class="m-0 text-xl leading-snug font-semibold text-highlighted">{{ data.title ?? t.untitled }}</h1>
      </div>

      <dl class="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-1.5 text-[12.5px]">
        <dt class="text-muted">{{ t.triage }}</dt>
        <dd class="m-0 font-mono text-xs">{{ data.triage ?? t.none }}</dd>
        <dt class="text-muted">{{ t.blockedBy }}</dt>
        <dd class="m-0">
          <span v-if="data.dependencies.length === 0" class="text-dimmed">{{ t.none }}</span>
          <div v-for="item in data.dependencies" :key="item.id" class="flex flex-wrap items-baseline gap-x-1.5" :class="{ 'text-warning': item.met === false }">
            <NuxtLink v-if="!item.dangling" :to="{ query: { project, id: item.id } }" class="font-mono text-xs text-primary hover:underline">{{ item.id }}</NuxtLink>
            <span v-else class="font-mono text-xs">{{ item.id }}</span>
            <span v-if="item.title !== null" lang="en">{{ item.title }}</span>
            <span class="text-muted">({{ dependency(item) }})</span>
          </div>
        </dd>
        <dt class="text-muted">{{ t.spec }}</dt>
        <dd class="m-0 font-mono text-xs break-all">
          <template v-if="data.spec !== null">{{ data.spec }}</template>
          <span v-else class="font-sans text-dimmed">{{ t.none }}</span>
        </dd>
        <dt class="text-muted">{{ t.ticket }}</dt>
        <dd class="m-0 font-mono text-xs break-all">{{ data.ticket }}</dd>
        <dt class="text-muted">{{ t.branch }}</dt>
        <dd class="m-0 font-mono text-xs break-all">{{ data.branch }}</dd>
      </dl>
      <div v-for="(item, index) in data.diagnostics" :key="index" lang="en" class="text-warning">
        <code class="font-mono">{{ item.code }}</code> {{ item.message }}
      </div>

      <section class="flex flex-col gap-2 rounded-xl border border-default bg-default px-5 py-4">
        <h2 class="m-0 text-[13px] font-semibold">{{ fromRuns ? t.resumeCommand : t.startCommand }}</h2>
        <template v-if="data.start !== null">
          <div class="text-muted">{{ fromRuns ? t.resumeNote : t.startNote }}</div>
          <CopyCommand :command="data.start" primary />
        </template>
        <div v-else class="text-muted">
          {{ data.state === 'DONE' ? t.noCommandDone : data.state === 'CANCELLED' ? t.noCommandCancelled : t.noCommand }}
        </div>
      </section>

      <div class="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] items-start gap-5">
        <div class="flex min-w-0 flex-col gap-5">
          <section class="overflow-hidden rounded-lg border border-default bg-default">
            <div class="flex items-center justify-between border-b border-default px-3.5 py-2.5">
              <h2 class="m-0 text-[13px] font-semibold">{{ t.ticket }}</h2>
              <span class="text-[11px] text-dimmed">{{ t.plainText }}</span>
            </div>
            <pre lang="en" class="m-0 max-w-[70ch] p-3.5 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">{{ data.body.text }}</pre>
            <p v-if="data.body.truncated" class="m-0 border-t border-default px-3.5 py-2 text-xs text-muted">
              {{ t.bodyCut }} <code class="font-mono">{{ data.ticket }}</code>
            </p>
          </section>
          <section class="overflow-hidden rounded-lg border border-default bg-default">
            <div class="border-b border-default px-3.5 py-2.5"><h2 class="m-0 text-[13px] font-semibold">Review</h2></div>
            <div v-if="data.review === null" class="flex items-center gap-2 px-3.5 py-3" :class="data.state === 'DONE' ? 'text-warning' : 'text-muted'">
              <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0" :class="data.state === 'DONE' ? 'text-(--warn)' : ''" />
              <span>{{ t.noReview }}</span>
            </div>
            <div v-else-if="isUnavailable(data.review)" class="px-3.5 py-3">
              <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :reason="data.review.reason" /></span>
            </div>
            <template v-else>
              <pre lang="en" class="m-0 max-w-[70ch] p-3.5 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">{{ data.review.text }}</pre>
              <p v-if="data.review.truncated" class="m-0 border-t border-default px-3.5 py-2 text-xs text-muted">
                {{ t.reviewCut }} <code class="font-mono">{{ data.ticket }}</code>
              </p>
            </template>
          </section>
        </div>

        <div class="flex min-w-0 flex-col gap-5">
          <section class="overflow-hidden rounded-lg border border-default bg-default">
            <div class="flex items-center justify-between border-b border-default px-3.5 py-2.5">
              <h2 class="m-0 text-[13px] font-semibold">{{ t.runs }}</h2>
              <span v-if="usage" class="font-mono text-[11.5px] text-dimmed">{{ number(usage.runs.items.length + usage.runs.remainder) }}</span>
            </div>
            <p v-if="usageError" class="m-0 px-3.5 py-3 text-warning"><code>{{ usageError.code }}</code> {{ usageError.message }}</p>
            <USkeleton v-else-if="usage === null" class="m-3.5 h-24" />
            <template v-else>
              <p v-if="usage.importing.incomplete" class="m-0 px-3.5 pt-3 text-warning">{{ t.importing }}</p>
              <p v-if="usage.runs.items.length === 0" class="m-0 px-3.5 py-3 text-muted">{{ t.noRuns }}</p>
              <ol v-else class="m-0 list-none px-3.5 py-1">
                <li v-for="(run, index) in usage.runs.items" :key="run.id" class="grid grid-cols-[14px_minmax(0,1fr)] gap-2.5">
                  <div class="flex flex-col items-center">
                    <span
                      class="mt-3.5 size-2.5 shrink-0 rounded-full border-2"
                      :class="run.active.value ? 'border-success bg-success motion-safe:animate-pulse' : 'border-accented bg-default'"
                    />
                    <span class="w-px flex-1" :class="index < usage.runs.items.length - 1 ? 'bg-(--ui-border)' : ''" />
                  </div>
                  <div class="flex min-w-0 flex-col gap-1.5 pt-2.5 pb-3">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-mono text-xs font-medium">{{ run.harness }} · {{ run.model ?? t.modelNotReported }} · {{ run.role }}</span>
                      <span class="text-[11.5px]" :class="run.active.value ? 'text-success' : 'text-dimmed'" :title="t.runningReading">
                        {{ run.active.value ? t.activeNow : t.notActiveNow }}
                      </span>
                    </div>
                    <dl class="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3.5 gap-y-0.5 text-[11.5px]">
                      <dt class="text-dimmed">{{ t.branch }}</dt>
                      <dd class="m-0 font-mono break-all">
                        <template v-if="run.branch !== null">{{ run.branch }}</template>
                        <span v-else class="font-sans text-muted">{{ t.noBranch }}</span>
                      </dd>
                      <dt class="text-dimmed">{{ t.checkout }}</dt>
                      <dd class="m-0 font-mono break-all">
                        <template v-if="run.checkout !== null">{{ run.checkout }}</template>
                        <span v-else class="font-sans text-muted">{{ t.unnamedCheckout }}</span>
                      </dd>
                      <dt class="text-dimmed">{{ t.started }}</dt>
                      <dd class="m-0">{{ dateTime(run.startedAt) }}</dd>
                      <dt class="text-dimmed">{{ t.latestActivity }}</dt>
                      <dd class="m-0" :title="dateTime(run.lastActivityAt)">{{ since(run.lastActivityAt) }}</dd>
                      <dt class="text-dimmed">{{ t.tokens }}</dt>
                      <dd class="m-0 font-mono">{{ tokensLine(run.totals, t, number) }}</dd>
                    </dl>
                  </div>
                </li>
              </ol>
              <p v-if="usage.runs.remainder > 0" class="m-0 px-3.5 pb-3 text-xs text-dimmed">{{ plural(usage.runs.remainder, t.earlierRuns) }}</p>
            </template>
          </section>

          <section class="overflow-hidden rounded-lg border border-default bg-default">
            <div class="border-b border-default px-3.5 py-2.5"><h2 class="m-0 text-[13px] font-semibold">{{ t.usage }}</h2></div>
            <div class="flex flex-col gap-2 px-3.5 py-3">
              <div>
                <span class="font-medium">{{ t.usageByRole }}</span>
                <span v-if="usage" class="text-xs text-dimmed">, {{ usage.importing.windowStart === null ? t.wholeWindow : t.sinceWindow(usage.importing.windowStart) }}</span>
              </div>
              <p v-if="usageError" class="m-0 text-xs">
                <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <code>{{ usageError.code }}</code></span>
              </p>
              <USkeleton v-else-if="usage === null" class="h-24" />
              <template v-else>
                <div class="overflow-x-auto">
                  <TokenKinds
                    :columns="[
                      { key: 'implementation', label: t.roleImplementation, totals: usage.byRole.implementation },
                      { key: 'review', label: t.roleReview, totals: usage.byRole.review },
                      { key: 'rework', label: t.roleRework, totals: usage.byRole.rework },
                    ]"
                  />
                </div>
                <p class="m-0 text-[11.5px] leading-snug text-dimmed">{{ t.rolesReading }}</p>
              </template>
            </div>
            <div v-for="row in notAvailableRows" :key="row.element" class="flex flex-col gap-0.5 border-t border-default px-3.5 py-2.5">
              <div class="flex justify-between gap-2">
                <span class="font-medium">{{ row.element }}</span>
                <span class="text-xs text-muted">{{ t.notAvailable }}</span>
              </div>
              <div class="text-[11.5px] leading-snug text-dimmed">{{ row.reason }}</div>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
