<script setup lang="ts">
/** A command the human types, with the dashboard's only action: copying it (Clipboard API; loopback is a secure context). */
const props = defineProps<{ command: string }>();

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
  <span class="command">
    <code>{{ command }}</code>
    <button type="button" @click="copy">Copy</button>
    <span class="status" role="status">{{ state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed: select the command and copy it by hand.' : '' }}</span>
  </span>
</template>

<style scoped>
.command {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: baseline;
}
code {
  padding: 0.1rem 0.35rem;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 4px;
  overflow-wrap: anywhere;
}
button {
  font: inherit;
  font-size: 0.85rem;
  padding: 0.1rem 0.6rem;
  color: var(--fg);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 4px;
  cursor: pointer;
}
.status {
  font-size: 0.85rem;
  color: var(--muted);
}
</style>
