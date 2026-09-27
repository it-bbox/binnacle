<script setup lang="ts">
import { call, usePolling, type Failure } from '~/composables/daemon';
import { useLanguage } from '~/composables/language';
import { projectName, SELECTED_VIEW, type ProjectRow } from '~/composables/projects';
import { LANGUAGES, type Language } from '~/i18n';

/**
 * The language, and the selected project's and the daemon's settings to read. The page writes
 * nothing (ADR-0020): its only actions are the language choice, kept in this browser, and
 * copying commands. Each setting says where it is changed instead.
 */
const view = inject(SELECTED_VIEW, ref(null));
const route = useRoute();
const project = typeof route.query.project === 'string' ? route.query.project : null;
const { language, choose, t, number } = useLanguage();

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

type Setting = { key: string; value: string | number | boolean | null; unwritten?: string };

/** The manifest's sections, by the keys the file spells them with, since the file is where they are changed. */
const sections = computed((): { name: string; settings: Setting[] }[] | null => {
  const manifest = status.data.value?.manifest;
  if (!manifest) return null;
  // An unwritten limit is the one Binnacle uses, as the snapshot calculates it.
  const parallel = view.value?.snapshot?.tasks?.parallel;
  const limit = parallel === undefined ? undefined : t.value.limitUsed(number(parallel.limit));
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

const card = { root: 'rounded-[10px]', header: 'flex items-center justify-between gap-2 px-3.5 py-2.5 sm:px-3.5', body: 'px-3.5 py-3 sm:px-3.5 sm:py-3', footer: 'px-3.5 py-2 sm:px-3.5' };
</script>

<template>
  <div class="flex flex-col gap-4.5 pt-4">
    <h1 class="text-lg font-semibold text-highlighted">{{ t.settings }}</h1>

    <UCard :ui="card">
      <template #header>
        <h2 id="language" class="text-[13px] font-semibold">{{ t.language }}</h2>
      </template>
      <URadioGroup :model-value="language" :items="LANGUAGES" aria-labelledby="language" @update:model-value="(value) => choose(value as Language)" />
      <template #footer>
        <p class="text-[11.5px] leading-snug text-dimmed">{{ t.languageNote }}</p>
      </template>
    </UCard>

    <UCard :ui="card">
      <template #header>
        <h2 class="text-[13px] font-semibold">{{ t.projectSettings }}</h2>
        <span v-if="view" class="truncate text-[11.5px] text-dimmed">{{ projectName(view.project) }}</span>
      </template>
      <p v-if="project === null" class="text-muted">{{ t.noProject }}</p>
      <p v-else-if="status.error.value" class="text-warning">
        <code>{{ status.error.value.code }}</code> <span lang="en">{{ status.error.value.message }}</span>
      </p>
      <div v-else-if="status.data.value === null" class="flex flex-col gap-2" :aria-label="t.loading" aria-busy="true">
        <USkeleton class="h-3.5 w-[60%]" />
        <USkeleton class="h-3.5 w-[45%]" />
        <USkeleton class="h-3.5 w-[50%]" />
      </div>
      <div v-else-if="sections === null" class="flex flex-col gap-3">
        <p class="font-medium">{{ t.noManifest }}</p>
        <p v-if="status.data.value.project.unavailable" lang="en" class="font-mono text-xs leading-normal wrap-anywhere text-muted">{{ status.data.value.project.unavailable }}</p>
        <CopyCommand command="binn init" primary />
        <p class="text-xs text-dimmed">{{ t.initNote }}</p>
      </div>
      <div v-else class="flex flex-col gap-4">
        <div class="flex flex-col gap-1.5">
          <p class="text-muted">{{ t.manifestFile }}</p>
          <code class="font-mono text-xs text-highlighted" :title="`${status.data.value.project.path}/.binnacle/project.yaml`">.binnacle/project.yaml</code>
        </div>
        <div class="grid grid-cols-2 gap-x-6 gap-y-4">
          <section v-for="section in sections" :key="section.name" class="flex min-w-0 flex-col gap-1">
            <h3 class="font-mono text-xs font-semibold">{{ section.name }}</h3>
            <p v-if="section.settings.length === 0" class="text-xs text-dimmed">{{ t.notWritten }}</p>
            <dl v-else class="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-0.5 font-mono text-xs">
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
        <h3 class="text-xs font-semibold">{{ t.diagnostics }}</h3>
        <p v-for="item in status.data.value.diagnostics" :key="item.code + item.message" class="font-mono text-xs leading-normal text-warning" lang="en">
          {{ item.message }} <code class="text-dimmed">{{ item.code }}</code>
        </p>
      </div>
      <template v-if="sections" #footer>
        <p class="text-[11.5px] leading-snug text-dimmed">{{ t.manifestRefresh }}</p>
      </template>
    </UCard>

    <UCard :ui="card">
      <template #header>
        <h2 class="text-[13px] font-semibold">{{ t.daemon }}</h2>
      </template>
      <div class="flex flex-col gap-3">
        <p v-if="daemon.error.value" class="text-warning">
          <code>{{ daemon.error.value.code }}</code> <span lang="en">{{ daemon.error.value.message }}</span>
        </p>
        <dl v-else-if="daemon.data.value" class="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-0.5 text-xs">
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
      </div>
      <template #footer>
        <p class="text-[11.5px] leading-snug text-dimmed">{{ t.daemonNote }}</p>
      </template>
    </UCard>
  </div>
</template>
