<script setup lang="ts">
import { useLanguage } from '~/composables/language';
import { projectName, type ProjectView, type Run } from '~/composables/projects';

/** A run on the Attention page: its Task or role, its project, who ran it and where, and its latest activity. */
const props = defineProps<{ view: ProjectView; run: Run; live: boolean }>();
const { t, since } = useLanguage();

const meta = computed(() =>
  [props.run.harness, props.run.model ?? t.value.modelNotReported, props.run.role, props.run.branch, props.run.checkout].filter((part) => part !== null).join(' · '),
);
</script>

<template>
  <li class="flex flex-col gap-1 px-3.5 py-2.5">
    <div class="flex min-w-0 items-center gap-2">
      <span v-if="live" class="size-1.5 flex-none rounded-full bg-success motion-safe:animate-pulse" />
      <span v-else class="size-1.5 flex-none rounded-full border border-(--ui-text-dimmed)" />
      <template v-if="run.taskId !== null">
        <ULink :to="{ path: '/task', query: { project: view.project.path, id: run.taskId } }" class="flex-none font-mono text-[11.5px] text-muted">{{ run.taskId }}</ULink>
        <span v-if="run.taskTitle !== null" class="truncate" lang="en">{{ run.taskTitle }}</span>
      </template>
      <template v-else>
        <UBadge :label="run.role" color="neutral" variant="soft" size="sm" class="font-mono" />
        <span class="text-xs text-dimmed">{{ t.noTask }}</span>
      </template>
      <span class="flex-1" />
      <span class="flex-none text-[11.5px] whitespace-nowrap text-muted">{{ since(run.lastActivityAt) }}</span>
    </div>
    <div class="pl-3.5 text-[11px] text-dimmed">
      <span class="text-muted">{{ projectName(view.project) }}</span> · <span class="font-mono break-all">{{ meta }}</span>
    </div>
  </li>
</template>
