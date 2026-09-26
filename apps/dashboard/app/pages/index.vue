<script setup lang="ts">
import RunList from '~/components/RunList.vue';
import { usePolling } from '~/composables/daemon';
import { isUnavailable, loadProjects, position, projectName, RUNNING_READING } from '~/composables/projects';

const { data, error } = usePolling(loadProjects);
</script>

<template>
  <h1>Overview</h1>
  <p v-if="error" class="warn"><code>{{ error.code }}</code> {{ error.message }}</p>
  <p v-else-if="data === null" class="muted">Loading…</p>
  <p v-else-if="data.length === 0" class="muted">No projects are registered. Register one with <code>binn project register [path]</code>.</p>
  <section v-for="view in data ?? []" :key="view.project.path" class="project">
    <h2><NuxtLink :to="{ path: '/project', query: { project: view.project.path } }">{{ projectName(view.project) }}</NuxtLink></h2>
    <p v-if="view.project.unavailable !== null" class="warn">Unavailable: {{ view.project.unavailable }}</p>
    <p v-else-if="view.failure" class="warn"><code>{{ view.failure.code }}</code> {{ view.failure.message }}</p>
    <template v-else-if="view.snapshot">
      <p>{{ position(view.snapshot) }}</p>
      <h3>Running now</h3>
      <p class="muted">{{ RUNNING_READING }}</p>
      <p v-if="isUnavailable(view.snapshot.activity)" class="muted">Not available: {{ view.snapshot.activity.reason }}</p>
      <RunList v-else :runs="view.snapshot.activity.running.items" :remainder="view.snapshot.activity.running.remainder" empty="Nothing is running." />
      <h3>Ready to start</h3>
      <p v-if="view.snapshot.tasks === null" class="muted">The tracker cannot be read; attention says why.</p>
      <p v-else-if="view.snapshot.tasks.readyToStart.items.length === 0" class="muted">No Task is ready to start.</p>
      <ul v-else class="tasks">
        <li v-for="task in view.snapshot.tasks.readyToStart.items" :key="task.id">
          <NuxtLink :to="{ path: '/task', query: { project: view.project.path, id: task.id } }">{{ task.id }}</NuxtLink>
          {{ task.title ?? '(untitled)' }}
          <div v-if="task.start !== null"><CopyCommand :command="task.start" /></div>
        </li>
        <li v-if="view.snapshot.tasks.readyToStart.remainder > 0" class="muted">and {{ view.snapshot.tasks.readyToStart.remainder }} more</li>
      </ul>
      <h3>Attention</h3>
      <p v-if="view.snapshot.attention.length === 0" class="muted">Nothing needs attention.</p>
      <ul v-else>
        <li v-for="(item, index) in view.snapshot.attention" :key="index"><code>{{ item.code }}</code> {{ item.message }}</li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.tasks li {
  margin-bottom: 0.4rem;
}
</style>
