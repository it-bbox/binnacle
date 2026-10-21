<script setup lang="ts">
import { call, usePolling, type Failure } from '~/composables/daemon';
import { useLanguage } from '~/composables/language';
import { CI_TONE, forgeName, isUnavailable, runRole, said, type CiForge, type CiRequest, type Unavailable } from '~/composables/projects';
import { tokensLine, type TaskUsage } from '~/composables/usage';
import { markdown } from '~/markdown';
import { BRIEF_ROWS, LIST_FOLD } from '~/widget';

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
  questions: { branch: string | null; items: { text: string; answer: string | null }[] } | Unavailable;
  roles: { required: string[]; source: 'ticket' | 'default'; suggested: { role: string; reason: string; provenance: 'calculated' }[] };
  /** Its open pull or merge request with its CI state, as the forge reports it. */
  request: (CiRequest & { forge: CiForge }) | Unavailable | null;
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

// Raw HTML stays text and only web or mail links survive (`markdown.ts`), so `v-html` injects nothing.
const body = computed(() => (data.value === null ? '' : markdown(data.value.body.text)));
const review = computed(() => {
  const value = data.value?.review;
  return value == null || isUnavailable(value) ? '' : markdown(value.text);
});

/**
 * *Brief* shows the unanswered questions; the answered ones wait for *Full*. A question is keyed
 * by its place in the ticket, which only grows, since two may read the same.
 */
const questions = computed(() => (data.value === null || isUnavailable(data.value.questions) ? [] : data.value.questions.items));
const unanswered = computed(() => questions.value.filter((item) => item.answer === null));

/** A Task's state in the page's language, or that it has none. */
const state = (value: string | null): string => (value === null ? t.value.noState : said(t.value.states, value));

const dependency = (item: Brief['dependencies'][number]): string =>
  item.dangling ? t.value.dangling : `${state(item.state)}, ${item.met ? t.value.met : t.value.notMet}`;
</script>

<template>
  <div class="flex flex-col gap-5 pt-4">
    <p v-if="project === null || id === null" class="m-0 text-warning">{{ t.noTaskAddress }}</p>
    <p v-else-if="error" class="m-0 text-warning"><DaemonReason :said="error" /></p>
    <USkeleton v-else-if="data === null" class="h-40 w-full" />
    <template v-else>
      <div class="flex flex-col gap-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-sm text-muted">{{ data.id }}</span>
          <UBadge :label="state(data.state)" v-bind="stateBadge(data.state)" />
          <template v-if="fromRuns">
            <UBadge :label="t.states.ACTIVE" color="primary" variant="soft" />
            <span class="text-sm text-muted">({{ t.fromActivity }}), {{ t.ticketSays(state(data.state)) }}</span>
          </template>
        </div>
        <h1 lang="en" class="m-0 text-2xl leading-snug font-semibold text-highlighted">{{ data.title ?? t.untitled }}</h1>
      </div>

      <dl class="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-1.5 text-sm">
        <dt class="text-muted">{{ t.triage }}</dt>
        <dd class="m-0 font-mono text-sm">{{ data.triage ?? t.none }}</dd>
        <dt class="text-muted">{{ t.roles }}</dt>
        <dd class="m-0">
          <span>{{ data.roles.required.map((role) => said(t.taskRoles, role)).join(', ') }}</span>
          <span v-if="data.roles.source === 'default'" class="text-muted"> ({{ t.rolesDefault }})</span>
          <div v-for="item in data.roles.suggested" :key="item.role" class="flex flex-wrap items-baseline gap-x-1.5">
            <span class="text-muted">{{ t.suggestedRoles }}</span>
            <span>{{ said(t.taskRoles, item.role) }}</span>
            <span class="text-dimmed">({{ t.estimate }})</span>
            <span lang="en" class="text-dimmed">{{ item.reason }}</span>
          </div>
        </dd>
        <dt class="text-muted">{{ t.blockedBy }}</dt>
        <dd class="m-0">
          <span v-if="data.dependencies.length === 0" class="text-dimmed">{{ t.none }}</span>
          <div v-for="item in data.dependencies" :key="item.id" class="flex flex-wrap items-baseline gap-x-1.5" :class="{ 'text-warning': item.met === false }">
            <NuxtLink v-if="!item.dangling" :to="{ query: { project, id: item.id } }" class="font-mono text-sm text-primary hover:underline">{{ item.id }}</NuxtLink>
            <span v-else class="font-mono text-sm">{{ item.id }}</span>
            <span v-if="item.title !== null" lang="en">{{ item.title }}</span>
            <span class="text-muted">({{ dependency(item) }})</span>
          </div>
        </dd>
        <dt class="text-muted">{{ t.spec }}</dt>
        <dd class="m-0 font-mono text-sm break-all">
          <template v-if="data.spec !== null">{{ data.spec }}</template>
          <span v-else class="font-sans text-dimmed">{{ t.none }}</span>
        </dd>
        <dt class="text-muted">{{ t.ticket }}</dt>
        <dd class="m-0 font-mono text-sm break-all">{{ data.ticket }}</dd>
        <dt class="text-muted">{{ t.branch }}</dt>
        <dd class="m-0 font-mono text-sm break-all">{{ data.branch }}</dd>
        <dt class="text-muted">{{ t.pullRequest }}</dt>
        <dd class="m-0">
          <span v-if="data.request === null" class="text-dimmed">{{ t.noRequest }}</span>
          <template v-else-if="isUnavailable(data.request)">
            <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :said="data.request" /></span>
          </template>
          <div v-else class="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
            <a :href="data.request.url" target="_blank" rel="noopener noreferrer" class="font-mono text-sm text-default underline">#{{ data.request.number }}</a>
            <span lang="en">{{ data.request.title }}</span>
            <span v-if="data.request.draft" class="text-dimmed">({{ t.draft }})</span>
            · <code class="font-mono text-sm text-dimmed">{{ data.request.branch }}</code>
            · <span class="font-medium" :class="CI_TONE[data.request.state.value]">{{ t.ciStates[data.request.state.value] }}</span>
            <span class="text-sm text-dimmed">{{ t.ciReported(forgeName(data.request.forge)) }}</span>
          </div>
        </dd>
      </dl>
      <div v-for="(item, index) in data.diagnostics" :key="index" class="text-warning">
        <DaemonReason :said="item" />
      </div>

      <section class="flex flex-col gap-2 rounded-xl border border-default bg-default px-5 py-4">
        <h2 class="m-0 text-base font-semibold">{{ fromRuns ? t.resumeCommand : t.startCommand }}</h2>
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
            <div class="border-b border-default px-3.5 py-2.5"><h2 class="m-0 text-base font-semibold">{{ t.ticket }}</h2></div>
            <div lang="en" class="markdown p-3.5" v-html="body" />
            <p v-if="data.body.truncated" class="m-0 border-t border-default px-3.5 py-2 text-sm text-muted">
              {{ t.bodyCut }} <code class="font-mono">{{ data.ticket }}</code>
            </p>
          </section>
          <section class="overflow-hidden rounded-lg border border-default bg-default">
            <div class="border-b border-default px-3.5 py-2.5"><h2 class="m-0 text-base font-semibold">{{ t.roleReview }}</h2></div>
            <div v-if="data.review === null" class="flex items-center gap-2 px-3.5 py-3" :class="data.state === 'DONE' ? 'text-warning' : 'text-muted'">
              <UIcon name="i-lucide-triangle-alert" class="size-3.5 shrink-0" :class="data.state === 'DONE' ? 'text-(--warn)' : ''" />
              <span>{{ t.noReview }}</span>
            </div>
            <div v-else-if="isUnavailable(data.review)" class="px-3.5 py-3">
              <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :said="data.review" /></span>
            </div>
            <template v-else>
              <div lang="en" class="markdown p-3.5" v-html="review" />
              <p v-if="data.review.truncated" class="m-0 border-t border-default px-3.5 py-2 text-sm text-muted">
                {{ t.reviewCut }} <code class="font-mono">{{ data.ticket }}</code>
              </p>
            </template>
          </section>
          <Widget page="task" widget="questions" :title="t.questions">
            <template #default="{ full }">
              <div v-if="isUnavailable(data.questions)" class="px-3.5 py-3">
                <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :said="data.questions" /></span>
              </div>
              <p v-else-if="data.questions.items.length === 0" class="m-0 px-3.5 py-3 text-muted">{{ t.noQuestions }}</p>
              <template v-else>
                <p v-if="data.questions.branch !== null" class="m-0 px-3.5 pt-3 text-sm text-muted">{{ t.questionsFromBranch(data.questions.branch) }}</p>
                <p v-if="!full && unanswered.length === 0" class="m-0 px-3.5 py-3 text-muted">{{ t.allAnswered }}</p>
                <ul v-else class="m-0 list-none divide-y divide-default p-0">
                  <FoldedList :items="full ? questions : unanswered" :by="(item) => String(questions.indexOf(item))" :limit="full ? LIST_FOLD : BRIEF_ROWS">
                    <template #default="{ item }">
                      <li class="flex flex-col gap-1.5 px-3.5 py-3">
                        <FoldedText lang="en" class="font-mono text-sm leading-relaxed break-words whitespace-pre-wrap">{{ item.text }}</FoldedText>
                        <FoldedText v-if="item.answer !== null" lang="en" class="border-l-2 border-accented pl-2.5 font-mono text-sm leading-relaxed break-words whitespace-pre-wrap">{{ item.answer }}</FoldedText>
                        <div v-else class="flex items-center gap-2 text-warning">
                          <UIcon name="i-lucide-circle-help" class="size-3.5 shrink-0 text-(--warn)" />
                          <span>{{ t.unanswered }}</span>
                        </div>
                      </li>
                    </template>
                  </FoldedList>
                </ul>
                <p v-if="!full && questions.length > unanswered.length" class="m-0 px-3.5 pb-3 text-sm text-dimmed">
                  {{ plural(questions.length - unanswered.length, t.answeredInFull) }}
                </p>
              </template>
            </template>
          </Widget>
        </div>

        <div class="flex min-w-0 flex-col gap-5">
          <Widget page="task" widget="runs" :title="t.runs">
            <template #aside>
              <span v-if="usage" class="font-mono text-sm text-dimmed">{{ number(usage.runs.items.length + usage.runs.remainder) }}</span>
            </template>
            <template #default="{ full }">
              <p v-if="usageError" class="m-0 px-3.5 py-3 text-warning"><DaemonReason :said="usageError" /></p>
              <USkeleton v-else-if="usage === null" class="m-3.5 h-24" />
              <template v-else>
                <p v-if="usage.importing.incomplete" class="m-0 px-3.5 pt-3 text-warning">{{ t.importing }}</p>
                <p v-if="usage.runs.items.length === 0" class="m-0 px-3.5 py-3 text-muted">{{ t.noRuns }}</p>
                <ol v-else class="m-0 list-none px-3.5 py-1">
                  <FoldedList :items="usage.runs.items" :by="(run) => run.id" :limit="full ? LIST_FOLD : BRIEF_ROWS">
                    <template #default="{ item: run }">
                      <li class="grid grid-cols-[14px_minmax(0,1fr)] gap-2.5">
                        <div class="flex flex-col items-center">
                          <span
                            class="mt-3.5 size-2.5 shrink-0 rounded-full border-2"
                            :class="run.active.value ? 'border-success bg-success motion-safe:animate-pulse' : 'border-accented bg-default'"
                          />
                          <span class="w-px flex-1" :class="run !== usage.runs.items.at(-1) ? 'bg-(--ui-border)' : ''" />
                        </div>
                        <div class="flex min-w-0 flex-col gap-1.5 pt-2.5 pb-3">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="font-mono text-sm font-medium">{{ run.harness }} · {{ run.model ?? t.modelNotReported }} · <span class="font-sans">{{ runRole(t, run.role) }}</span></span>
                            <span class="text-sm" :class="run.active.value ? 'text-success' : 'text-dimmed'">
                              {{ run.active.value ? t.activeNow : t.notActiveNow }} <span class="text-dimmed">({{ t.fromActivity }})</span>
                            </span>
                          </div>
                          <dl class="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3.5 gap-y-0.5 text-sm">
                            <template v-if="full">
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
                            </template>
                            <dt class="text-dimmed">{{ t.latestActivity }}</dt>
                            <dd class="m-0" :title="dateTime(run.lastActivityAt)">{{ since(run.lastActivityAt) }}</dd>
                            <dt class="text-dimmed">{{ t.tokens }}</dt>
                            <dd class="m-0 font-mono">{{ tokensLine(run.totals, t, number) }}</dd>
                          </dl>
                        </div>
                      </li>
                    </template>
                  </FoldedList>
                </ol>
                <p v-if="usage.runs.remainder > 0" class="m-0 px-3.5 pb-3 text-sm text-dimmed">{{ plural(usage.runs.remainder, t.earlierRuns) }}</p>
              </template>
            </template>
          </Widget>

          <section class="overflow-hidden rounded-lg border border-default bg-default">
            <div class="border-b border-default px-3.5 py-2.5"><h2 class="m-0 text-base font-semibold">{{ t.usage }}</h2></div>
            <div class="flex flex-col gap-2 px-3.5 py-3">
              <div>
                <span class="font-medium">{{ t.usageByRole }}</span> <span class="text-sm text-dimmed">({{ t.estimate }})</span>
                <span v-if="usage" class="text-sm text-dimmed">, {{ usage.importing.windowStart === null ? t.wholeWindow : t.sinceWindow(usage.importing.windowStart) }}</span>
              </div>
              <p v-if="usageError" class="m-0 text-sm">
                <span class="font-medium">{{ t.notAvailable }}</span> <span class="text-muted">· <DaemonReason :said="usageError" /></span>
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
                <p v-if="usage.reworkUnread" class="m-0 text-sm">
                  <span class="font-medium">{{ t.reworkUnread }}</span> <span class="text-muted">· <DaemonReason :said="{ reason: usage.reworkUnread }" /></span>
                </p>
              </template>
            </div>
          </section>
        </div>
      </div>
    </template>
  </div>
</template>
