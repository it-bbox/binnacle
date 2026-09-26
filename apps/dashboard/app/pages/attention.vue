<script setup lang="ts">
import RunList from '~/components/RunList.vue';
import { usePolling } from '~/composables/daemon';
import { isUnavailable, loadProjects, projectName, RUNNING_READING } from '~/composables/projects';

const { data, error } = usePolling(loadProjects);
</script>

<template>
  <h1>Attention and current activity</h1>
  <p class="muted">{{ RUNNING_READING }}</p>
  <p v-if="error" class="warn"><code>{{ error.code }}</code> {{ error.message }}</p>
  <p v-else-if="data === null" class="muted">Loading…</p>
  <p v-else-if="data.length === 0" class="muted">No projects are registered. Register one with <code>binn project register [path]</code>.</p>
  <section v-for="view in data ?? []" :key="view.project.path" class="project">
    <h2>{{ projectName(view.project) }}</h2>
    <p v-if="view.project.unavailable !== null" class="warn">Unavailable: {{ view.project.unavailable }}</p>
    <p v-else-if="view.failure" class="warn"><code>{{ view.failure.code }}</code> {{ view.failure.message }}</p>
    <template v-else-if="view.snapshot">
      <h3>Attention</h3>
      <p v-if="view.snapshot.attention.length === 0" class="muted">Nothing needs attention.</p>
      <ul v-else>
        <li v-for="(item, index) in view.snapshot.attention" :key="index"><code>{{ item.code }}</code> {{ item.message }}</li>
      </ul>
      <p v-if="isUnavailable(view.snapshot.activity)" class="muted">Runs not available: {{ view.snapshot.activity.reason }}</p>
      <template v-else>
        <h3>Running now</h3>
        <RunList :runs="view.snapshot.activity.running.items" :remainder="view.snapshot.activity.running.remainder" empty="Nothing is running." />
        <h3>Recent</h3>
        <RunList :runs="view.snapshot.activity.recent" empty="No other runs observed." />
      </template>
    </template>
  </section>
</template>

