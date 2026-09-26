<script setup lang="ts">
import { ago, runSubject, type Run } from '~/composables/projects';

defineProps<{ runs: Run[]; remainder?: number; empty: string }>();
</script>

<template>
  <p v-if="runs.length === 0" class="muted">{{ empty }}</p>
  <ul v-else>
    <li v-for="run in runs" :key="run.id">
      {{ runSubject(run) }}
      <span class="muted">
        · {{ run.harness }}, {{ run.model ?? 'model not reported' }} · {{ ago(run.lastActivityAt) }}
        <template v-if="run.branch !== null"> · <code>{{ run.branch }}</code></template>
        <template v-if="run.checkout !== null"> in <code>{{ run.checkout }}</code></template>
      </span>
    </li>
    <li v-if="remainder" class="muted">and {{ remainder }} more</li>
  </ul>
</template>

<style scoped>
ul {
  margin: 0;
  padding-left: 1.25rem;
}
</style>
