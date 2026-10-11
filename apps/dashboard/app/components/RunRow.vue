<script setup lang="ts">
import { useLanguage } from '~/composables/language';
import { projectName, type ProjectView, type Run } from '~/composables/projects';

/** A run on the Attention page: its Task or role, its project and its latest activity, and in *Full* who ran it and where. */
const props = defineProps<{ view: ProjectView; run: Run; live: boolean; full: boolean }>();
const { t, since } = useLanguage();

const meta = computed(() =>
  [props.run.harness, props.run.model ?? t.value.modelNotReported, props.run.role, props.run.branch, props.run.checkout].filter((part) => part !== null).join(' · '),
);
</script>

<template>
  <li class="flex items-start gap-2 px-3.5 py-2.5">
    <span v-if="live" class="mt-1.5 size-1.5 flex-none rounded-full bg-success motion-safe:animate-pulse" />
    <span v-else class="mt-1.5 size-1.5 flex-none rounded-full border border-(--ui-text-dimmed)" />
    <div class="flex min-w-0 flex-1 flex-col gap-0.5">
      <div class="flex items-start justify-between gap-2">
        <ULink
          v-if="run.taskId !== null"
          :to="{ path: '/task', query: { project: view.project.path, id: run.taskId } }"
          class="min-w-0 font-mono text-sm break-all text-muted"
        >{{ run.taskId }}</ULink>
        <span v-else class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <UBadge :label="run.role" color="neutral" variant="soft" size="sm" class="font-mono" />
          <span class="text-sm text-dimmed">{{ t.noTask }}</span>
        </span>
        <span class="flex-none text-sm whitespace-nowrap text-muted">{{ since(run.lastActivityAt) }}</span>
      </div>
      <span v-if="run.taskId !== null && run.taskTitle !== null" class="truncate" lang="en">{{ run.taskTitle }}</span>
      <div class="text-xs text-dimmed">
        <span class="text-muted">{{ projectName(view.project) }}</span><template v-if="full"> · <span class="font-mono break-all">{{ meta }}</span></template>
      </div>
    </div>
  </li>
</template>
