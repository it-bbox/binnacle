<script setup lang="ts">
import { useLanguage } from '~/composables/language';

/** A command the human types, with the dashboard's only action: copying it (Clipboard API; loopback is a secure context). */
const props = defineProps<{ command: string; primary?: boolean }>();
const { t } = useLanguage();

const state = ref<'idle' | 'copied' | 'failed'>('idle');
let timer: ReturnType<typeof setTimeout> | undefined;

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.command);
    state.value = 'copied';
  } catch {
    state.value = 'failed';
  }
  clearTimeout(timer);
  timer = setTimeout(() => (state.value = 'idle'), 2000);
}
onUnmounted(() => clearTimeout(timer));
</script>

<template>
  <span class="inline-flex max-w-full flex-wrap items-center gap-x-2 align-middle">
    <span class="inline-flex max-w-full items-center gap-2 rounded-md border border-default bg-muted py-1 pr-1 pl-2.5">
      <UIcon name="i-lucide-chevron-right" class="size-3.5 shrink-0 text-dimmed" />
      <code class="min-w-0 flex-1 font-mono text-xs break-all text-highlighted">{{ command }}</code>
      <UButton
        :label="state === 'copied' ? t.copied : t.copy"
        :icon="state === 'copied' ? 'i-lucide-check' : 'i-lucide-copy'"
        :color="primary ? 'primary' : 'neutral'"
        :variant="primary ? 'solid' : 'outline'"
        :size="primary ? 'sm' : 'xs'"
        class="shrink-0"
        @click="copy"
      />
    </span>
    <span class="text-xs text-muted" role="status">{{ state === 'failed' ? t.copyFailed : '' }}</span>
  </span>
</template>
