<script setup lang="ts">
import { call, DaemonError, usePolling, type Failure } from '~/composables/daemon';
import { useLanguage } from '~/composables/language';
import { projectName, SELECTED_VIEW, type ParallelLimit, type ProjectRow } from '~/composables/projects';
import { LANGUAGES, type Language } from '~/i18n';

/**
 * The language, the machine's Parallel limit with what the machine has carried beside it, its
 * context-pressure thresholds, and the selected project's and the daemon's settings to read. The
 * Parallel limit (ADR-0041) and the thresholds (ADR-0046) are the two things the page writes,
 * through the daemon; the rest it only shows, each setting saying where it is changed (ADR-0020).
 */
const view = inject(SELECTED_VIEW, ref(null));
const route = useRoute();
const project = typeof route.query.project === 'string' ? route.query.project : null;
const { language, choose, t, number, plural, dateTime, list } = useLanguage();

/** The parts of `project.status`'s manifest the page shows, as the daemon answers them. */
type Manifest = {
  tracker: { provider: string | null; repository: string | null; host: string | null; local: { issues: string | null } };
  workflow: { provider: string | null; scratch: string | null };
  capabilities: Record<string, boolean | 'optional'>;
  automation: { mode: string | null; maxParallelDevelopmentTasks: number | null };
  telemetry: { privacy: string | null; import: { windowDays: number | 'all' | null } };
};
type ProjectStatus = { project: ProjectRow; manifest: Manifest | null; diagnostics: Failure[] };

const status = usePolling(async () => (project === null ? null : call<ProjectStatus>('project.status', { path: project })));
const daemon = usePolling(() => call<{ version: string; host: string; port: number }>('daemon.status'));

/** What this machine has carried, as `parallel.get` gives it beside the limit: each figure Binnacle's calculation. */
type Informer = {
  mostActive: { runs: number; at: string | null; provenance: 'calculated' };
  usageLimits: { at: string; harness: string; limit: string | null; active: number; provenance: 'calculated' }[];
  notReporting: string[];
};
const machine = usePolling(() => call<ParallelLimit & { informer: Informer }>('parallel.get'));
const informer = computed(() => machine.data.value?.informer ?? null);
/** The latest usage limits first, the ones that say most about the subscription now. */
const latestLimits = computed(() => [...(informer.value?.usageLimits ?? [])].reverse());
/** The form's choice, filled from the machine's limit until the owner edits it. */
const choice = ref<'number' | 'auto'>('number');
/** A number, or the input's text when it is not one. */
const entered = ref<number | string>('');
const edited = ref(false);
watch(machine.data, (limit) => {
  if (limit === null || edited.value) return;
  choice.value = limit.mode;
  entered.value = limit.mode === 'number' ? limit.limit : '';
});
const saving = ref(false);
const saved = ref(false);
const refused = ref<Failure | null>(null);

/** Sends the choice as it stands; the daemon alone decides whether it is a limit, and says why not. */
async function save(): Promise<void> {
  saving.value = true;
  saved.value = false;
  refused.value = null;
  try {
    // Whatever was entered is sent as it is, for the daemon to refuse with its reason.
    const limit = await call<ParallelLimit>('parallel.set', { limit: choice.value === 'auto' ? 'auto' : entered.value === '' ? null : entered.value });
    if (machine.data.value) machine.data.value = { ...machine.data.value, ...limit };
    edited.value = false;
    saved.value = true;
  } catch (error) {
    refused.value =
      error instanceof DaemonError
        ? { code: error.code, message: error.message, ...(error.params && { params: error.params }) }
        : { code: 'daemon.unreachable', message: 'The Binnacle daemon did not answer.' };
  } finally {
    saving.value = false;
  }
}
const edit = (): void => {
  edited.value = true;
  saved.value = false;
};
/** The selected project's own limit, which wins over the machine's for it. */
const override = computed(() => status.data.value?.manifest?.automation.maxParallelDevelopmentTasks ?? null);
const choices = computed(() => [
  { value: 'number', label: t.value.parallelNumber },
  { value: 'auto', label: t.value.parallelAuto },
]);

/** The machine's context-pressure thresholds, as `context_pressure.get` gives them, with the models to offer and the projects that override them. */
type Thresholds = { tokens: number; models: Record<string, number>; source: 'machine' | 'default' };
type PressureInformed = Thresholds & { recentModels: string[]; overrides: { path: string; name: string; tokens: number }[] };
const pressure = usePolling(() => call<PressureInformed>('context_pressure.get'));
/** The form, filled from the machine's thresholds until the owner edits it: numbers, or the inputs' text when they are not. */
const pressureTokens = ref<number | string>('');
const pressureRows = ref<{ model: string; tokens: number | string }[]>([]);
const newModel = ref('');
const newTokens = ref<number | string>('');
const pressureEdited = ref(false);
const fillPressure = (thresholds: Thresholds): void => {
  pressureTokens.value = thresholds.tokens;
  pressureRows.value = Object.entries(thresholds.models).map(([model, tokens]) => ({ model, tokens }));
};
watch(pressure.data, (thresholds) => {
  if (thresholds !== null && !pressureEdited.value) fillPressure(thresholds);
});
/** The recent models no row names yet, for the new row's datalist. */
const offeredModels = computed(() => (pressure.data.value?.recentModels ?? []).filter((model) => !pressureRows.value.some((row) => row.model === model)));
const pressureSaving = ref(false);
const pressureSaved = ref(false);
const pressureRefused = ref<Failure | null>(null);
const editPressure = (): void => {
  pressureEdited.value = true;
  pressureSaved.value = false;
};
/** A new row, or a new number for a model a row already names; the daemon judges the name and the number on save. */
function addModel(): void {
  // A name is matched exactly against a call's model, so spaces around it would never match.
  const model = newModel.value.trim();
  if (model === '') return;
  const row = pressureRows.value.find((existing) => existing.model === model);
  if (row) row.tokens = newTokens.value;
  else pressureRows.value.push({ model, tokens: newTokens.value });
  newModel.value = '';
  newTokens.value = '';
  editPressure();
}
function removeModel(model: string): void {
  pressureRows.value = pressureRows.value.filter((row) => row.model !== model);
  editPressure();
}
/** Sends the form as it stands, the whole `{ tokens, models }`; the daemon alone decides whether it holds, and says why not. */
async function savePressure(): Promise<void> {
  pressureSaving.value = true;
  pressureSaved.value = false;
  pressureRefused.value = null;
  try {
    const entered = (value: number | string): number | string | null => (value === '' ? null : value);
    const models = Object.fromEntries(pressureRows.value.map((row) => [row.model, entered(row.tokens)]));
    const thresholds = await call<Thresholds>('context_pressure.set', { tokens: entered(pressureTokens.value), models });
    if (pressure.data.value) pressure.data.value = { ...pressure.data.value, ...thresholds };
    fillPressure(thresholds);
    pressureEdited.value = false;
    pressureSaved.value = true;
  } catch (error) {
    pressureRefused.value =
      error instanceof DaemonError
        ? { code: error.code, message: error.message, ...(error.params && { params: error.params }) }
        : { code: 'daemon.unreachable', message: 'The Binnacle daemon did not answer.' };
  } finally {
    pressureSaving.value = false;
  }
}

type Setting = { key: string; value: string | number | boolean | null; unwritten?: string };

/** The manifest's sections, by the keys the file spells them with, since the file is where they are changed. */
const sections = computed((): { name: string; settings: Setting[] }[] | null => {
  const manifest = status.data.value?.manifest;
  if (!manifest) return null;
  // An unwritten limit is the one Binnacle uses, as the snapshot calculates it.
  const parallel = view.value?.snapshot?.tasks?.parallel;
  const limit = parallel === undefined ? undefined : t.value.limitUsed(t.value.limitValue(number(parallel.limit), parallel.mode));
  return [
    {
      name: 'tracker',
      settings: [
        { key: 'provider', value: manifest.tracker.provider },
        { key: 'repository', value: manifest.tracker.repository },
        { key: 'host', value: manifest.tracker.host },
        { key: 'local.issues', value: manifest.tracker.local.issues },
      ],
    },
    {
      name: 'workflow',
      settings: [
        { key: 'provider', value: manifest.workflow.provider },
        { key: 'scratch', value: manifest.workflow.scratch },
      ],
    },
    { name: 'capabilities', settings: Object.entries(manifest.capabilities).map(([key, value]) => ({ key, value })) },
    {
      name: 'automation',
      settings: [
        { key: 'mode', value: manifest.automation.mode },
        { key: 'max_parallel_development_tasks', value: manifest.automation.maxParallelDevelopmentTasks, ...(limit === undefined ? {} : { unwritten: limit }) },
      ],
    },
    {
      name: 'telemetry',
      settings: [
        { key: 'privacy', value: manifest.telemetry.privacy },
        { key: 'import.window_days', value: manifest.telemetry.import.windowDays },
      ],
    },
  ];
});

/** Autostart as the selected project's snapshot reads it for the daemon's home: shown with its command, never switched here. */
const autostart = computed(() => view.value?.snapshot?.autostart ?? null);

const card = { root: 'rounded-[10px]', header: 'flex items-center justify-between gap-2 px-3.5 py-2.5 sm:px-3.5', body: 'px-3.5 py-3 sm:px-3.5 sm:py-3', footer: 'px-3.5 py-2 sm:px-3.5' };
</script>

<template>
  <div class="flex flex-col gap-4.5 pt-4">
    <h1 class="text-xl font-semibold text-highlighted">{{ t.settings }}</h1>

    <UCard :ui="card">
      <template #header>
        <h2 id="language" class="text-base font-semibold">{{ t.language }}</h2>
      </template>
      <URadioGroup :model-value="language" :items="LANGUAGES" aria-labelledby="language" @update:model-value="(value) => choose(value as Language)" />
      <template #footer>
        <p class="text-sm leading-snug text-dimmed">{{ t.languageNote }}</p>
      </template>
    </UCard>

    <UCard :ui="card">
      <template #header>
        <h2 id="parallel" class="text-base font-semibold">{{ t.parallelLimit }}</h2>
        <span v-if="machine.data.value" class="text-sm text-dimmed">{{ t.parallelNow(t.limitValue(number(machine.data.value.limit), machine.data.value.mode), machine.data.value.source) }}</span>
      </template>
      <div class="flex flex-col gap-3">
        <p v-if="machine.error.value" class="text-warning">
          <DaemonReason :said="machine.error.value" />
        </p>
        <form class="flex flex-wrap items-center gap-x-4 gap-y-2" aria-labelledby="parallel" @submit.prevent="save">
          <URadioGroup v-model="choice" :items="choices" orientation="horizontal" aria-labelledby="parallel" @update:model-value="edit" />
          <UInput
            v-model.number="entered"
            type="number"
            step="1"
            class="w-24"
            :disabled="choice === 'auto'"
            :aria-label="t.parallelNumber"
            @update:model-value="edit"
          />
          <UButton type="submit" :loading="saving" :label="t.parallelSave" />
          <span v-if="saved" class="text-sm text-success" role="status">{{ t.parallelSaved }}</span>
        </form>
        <p v-if="refused" class="text-warning" role="alert">
          <DaemonReason :said="refused" />
        </p>
        <p v-if="override !== null" class="text-warning">{{ t.parallelOverride(number(override)) }}</p>
        <section v-if="informer" class="flex flex-col gap-1.5 border-t border-default pt-3" aria-labelledby="carried">
          <h3 id="carried" class="text-sm font-semibold">{{ t.carried }} <span class="font-normal text-dimmed">({{ t.estimate }})</span></h3>
          <p v-if="informer.mostActive.at === null" class="text-muted">{{ t.noRunsCarried }}</p>
          <p v-else>
            <span class="text-muted">{{ t.mostActive }}:</span> <span class="font-semibold">{{ number(informer.mostActive.runs) }}</span>
            <span class="text-sm text-dimmed"> · {{ dateTime(informer.mostActive.at) }}</span>
          </p>
          <p class="text-muted">{{ t.usageLimitsHit }}<template v-if="informer.usageLimits.length === 0">: {{ t.noUsageLimit }}</template></p>
          <ul v-if="informer.usageLimits.length > 0" class="flex flex-col gap-0.5">
            <FoldedList :items="latestLimits" :by="(item) => item.harness + item.at">
              <template #default="{ item }">
                <li class="text-sm">
                  {{ dateTime(item.at) }} · <span class="font-semibold">{{ plural(item.active, t.activeThen) }}</span>
                  <span v-if="item.limit !== null" class="font-mono text-dimmed"> · {{ item.limit }}</span>
                </li>
              </template>
            </FoldedList>
          </ul>
          <p v-if="informer.notReporting.length > 0" class="text-sm text-dimmed">{{ t.notReporting(list(informer.notReporting)) }}</p>
        </section>
      </div>
      <template #footer>
        <p class="text-sm leading-snug text-dimmed">{{ t.parallelNote }}</p>
        <p v-if="informer" class="mt-1.5 text-sm leading-snug text-dimmed">{{ t.carriedNote }}</p>
      </template>
    </UCard>

    <UCard :ui="card">
      <template #header>
        <h2 id="pressure" class="text-base font-semibold">{{ t.contextPressure }}</h2>
        <span v-if="pressure.data.value" class="text-sm text-dimmed">{{ t.pressureNow(number(pressure.data.value.tokens), pressure.data.value.source) }}</span>
      </template>
      <div class="flex flex-col gap-3">
        <p v-if="pressure.error.value" class="text-warning">
          <DaemonReason :said="pressure.error.value" />
        </p>
        <form class="flex flex-col gap-3" aria-labelledby="pressure" @submit.prevent="savePressure">
          <label class="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span class="text-muted">{{ t.pressureDefault }}</span>
            <UInput v-model.number="pressureTokens" type="number" step="1000" class="w-36" :aria-label="t.pressureDefault" @update:model-value="editPressure" />
          </label>
          <p v-if="pressureRows.length === 0" class="text-sm text-dimmed">{{ t.pressureNoModels }}</p>
          <table v-else class="w-full max-w-xl text-sm">
            <thead>
              <tr class="text-left text-muted">
                <th class="py-1 pr-3 font-normal">{{ t.pressureModel }}</th>
                <th class="py-1 pr-3 font-normal">{{ t.pressureTokens }}</th>
                <th class="py-1" />
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in pressureRows" :key="row.model">
                <td class="py-1 pr-3 font-mono wrap-anywhere">{{ row.model }}</td>
                <td class="py-1 pr-3">
                  <UInput v-model.number="row.tokens" type="number" step="1000" class="w-36" :aria-label="`${t.pressureTokens}: ${row.model}`" @update:model-value="editPressure" />
                </td>
                <td class="py-1">
                  <UButton type="button" color="neutral" variant="ghost" icon="i-lucide-x" :aria-label="t.pressureRemove(row.model)" @click="removeModel(row.model)" />
                </td>
              </tr>
            </tbody>
          </table>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <UInput v-model="newModel" list="recent-models" class="w-64" :placeholder="t.pressureNewModel" :aria-label="t.pressureNewModel" />
            <datalist id="recent-models">
              <option v-for="model in offeredModels" :key="model" :value="model" />
            </datalist>
            <UInput v-model.number="newTokens" type="number" step="1000" class="w-36" :placeholder="t.pressureNewTokens" :aria-label="t.pressureNewTokens" />
            <UButton type="button" color="neutral" variant="outline" :label="t.pressureAdd" :disabled="newModel.trim() === ''" @click="addModel" />
          </div>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
            <UButton type="submit" :loading="pressureSaving" :label="t.parallelSave" />
            <span v-if="pressureSaved" class="text-sm text-success" role="status">{{ t.parallelSaved }}</span>
            <span v-else-if="pressureEdited" class="text-sm text-dimmed">{{ t.pressureUnsaved }}</span>
          </div>
        </form>
        <p v-if="pressureRefused" class="text-warning" role="alert">
          <DaemonReason :said="pressureRefused" />
        </p>
        <section v-if="pressure.data.value?.overrides.length" class="flex flex-col gap-1 border-t border-default pt-3">
          <p class="text-warning">{{ t.pressureOverrides }}</p>
          <ul class="flex flex-col gap-0.5 text-sm">
            <li v-for="item in pressure.data.value.overrides" :key="item.path">
              <span class="font-semibold">{{ item.name }}</span> · {{ number(item.tokens) }}
              <span class="font-mono text-dimmed wrap-anywhere"> · {{ item.path }}</span>
            </li>
          </ul>
        </section>
      </div>
      <template #footer>
        <p class="text-sm leading-snug text-dimmed">{{ t.pressureNote }}</p>
      </template>
    </UCard>

    <UCard :ui="card">
      <template #header>
        <h2 class="text-base font-semibold">{{ t.projectSettings }}</h2>
        <span v-if="view" class="truncate text-sm text-dimmed">{{ projectName(view.project) }}</span>
      </template>
      <p v-if="project === null" class="text-muted">{{ t.noProject }}</p>
      <p v-else-if="status.error.value" class="text-warning">
        <DaemonReason :said="status.error.value" />
      </p>
      <div v-else-if="status.data.value === null" class="flex flex-col gap-2" :aria-label="t.loading" aria-busy="true">
        <USkeleton class="h-3.5 w-[60%]" />
        <USkeleton class="h-3.5 w-[45%]" />
        <USkeleton class="h-3.5 w-[50%]" />
      </div>
      <div v-else-if="sections === null" class="flex flex-col gap-3">
        <p class="font-medium">{{ t.noManifest }}</p>
        <p v-if="status.data.value.project.unavailable" lang="en" class="font-mono text-sm leading-normal wrap-anywhere text-muted">{{ status.data.value.project.unavailable }}</p>
        <CopyCommand command="binn init" primary />
        <p class="text-sm text-dimmed">{{ t.initNote }}</p>
      </div>
      <div v-else class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <p class="text-muted">{{ t.manifestFile }}</p>
          <code class="font-mono text-sm text-highlighted" :title="`${status.data.value.project.path}/.binnacle/project.yaml`">.binnacle/project.yaml</code>
        </div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(22rem,1fr))] gap-x-6 gap-y-4">
          <section v-for="section in sections" :key="section.name" class="flex min-w-0 flex-col gap-1">
            <h3 class="font-mono text-sm font-semibold">{{ section.name }}</h3>
            <p v-if="section.settings.length === 0" class="text-sm text-dimmed">{{ t.notWritten }}</p>
            <dl v-else class="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-0.5 font-mono text-sm">
              <template v-for="setting in section.settings" :key="setting.key">
                <dt class="text-muted wrap-anywhere">{{ setting.key }}</dt>
                <dd v-if="setting.value === null" class="font-sans text-dimmed">{{ setting.unwritten ?? t.notWritten }}</dd>
                <dd v-else class="wrap-anywhere">{{ setting.value }}</dd>
              </template>
            </dl>
          </section>
        </div>
      </div>
      <div v-if="!status.error.value && status.data.value?.diagnostics.length" class="mt-4 flex flex-col gap-1.5 border-t border-default pt-3">
        <h3 class="text-sm font-semibold">{{ t.diagnostics }}</h3>
        <p v-for="item in status.data.value.diagnostics" :key="item.code + item.message" class="text-sm leading-normal text-warning">
          <DaemonReason :said="item" />
        </p>
      </div>
      <template v-if="sections" #footer>
        <p class="text-sm leading-snug text-dimmed">{{ t.manifestRefresh }}</p>
      </template>
    </UCard>

    <UCard :ui="card">
      <template #header>
        <h2 class="text-base font-semibold">{{ t.daemon }}</h2>
      </template>
      <div class="flex flex-col gap-3">
        <p v-if="daemon.error.value" class="text-warning">
          <DaemonReason :said="daemon.error.value" />
        </p>
        <dl v-else-if="daemon.data.value" class="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-sm">
          <dt class="text-muted">{{ t.version }}</dt>
          <dd class="font-mono">{{ daemon.data.value.version }}</dd>
          <dt class="text-muted">{{ t.address }}</dt>
          <dd class="font-mono">http://{{ daemon.data.value.host }}:{{ daemon.data.value.port }}</dd>
        </dl>
        <USkeleton v-else class="h-3.5 w-[40%]" />
        <div class="flex flex-wrap gap-2">
          <CopyCommand command="binn daemon stop" />
          <CopyCommand command="binn daemon start" />
        </div>
        <section class="flex flex-col gap-1.5 border-t border-default pt-3" aria-labelledby="autostart">
          <h3 id="autostart" class="text-sm font-semibold">{{ t.autostart }}</h3>
          <p v-if="autostart === null" class="text-muted">{{ t.autostartUnread }}</p>
          <p v-else-if="!('state' in autostart)" class="text-warning" lang="en">{{ autostart.reason }}</p>
          <template v-else>
            <p :class="autostart.state === 'broken' ? 'text-warning' : ''">
              <span class="font-semibold">{{ t.autostartStates[autostart.state] }}</span> {{ t.autostartMeanings[autostart.state] }}
            </p>
            <p class="text-sm text-dimmed">
              {{ t.autostartFor }} <code class="font-mono wrap-anywhere">{{ autostart.home }}</code> · {{ autostart.platform }}
            </p>
            <div><CopyCommand :command="autostart.command" :primary="autostart.state === 'broken'" /></div>
          </template>
        </section>
      </div>
      <template #footer>
        <p class="text-sm leading-snug text-dimmed">{{ t.daemonNote }}</p>
        <p class="mt-1.5 text-sm leading-snug text-dimmed">{{ t.autostartNote }}</p>
      </template>
    </UCard>
  </div>
</template>
