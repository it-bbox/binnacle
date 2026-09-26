<script setup lang="ts">
import RunList from '~/components/RunList.vue';
import { usePolling } from '~/composables/daemon';
import { loadProjects, position, projectName, unavailable } from '~/composables/projects';

const { data, error } = usePolling(loadProjects);
</script>

<template>
  <h1>Overview</h1>
  <p v-if="error" class="warn"><code>{{ error.code }}</code> {{ error.message }}</p>
  <p v-else-if="data === null" class="muted">Loading…</p>
  <p v-else-if="data.length === 0" class="muted">No projects are registered. Register one with <code>binn project register [path]</code>.</p>
  <section v-for="view in data ?? []" :key="view.project.path" class="project">
    <h2>{{ projectName(view.project) }}</h2>
    <p v-if="view.project.unavailable !== null" class="warn">Unavailable: {{ view.project.unavailable }}</p>
    <p v-else-if="view.failure" class="warn"><code>{{ view.failure.code }}</code> {{ view.failure.message }}</p>
    <template v-else-if="view.snapshot">
      <p>{{ position(view.snapshot) }}</p>
      <h3>Running now <span class="label">active in the last ten minutes, Binnacle's reading</span></h3>
      <p v-if="unavailable(view.snapshot.activity)" class="muted">Not available: {{ view.snapshot.activity.reason }}</p>
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
.project {
  margin: 1rem 0;
  padding: 0.25rem 1rem 0.75rem;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
}
h2 {
  font-size: 1.05rem;
}
h3 {
  font-size: 0.9rem;
  color: var(--muted);
  margin-bottom: 0.25rem;
}
.label {
  font-weight: normal;
}
ul {
  margin: 0;
  padding-left: 1.25rem;
}
.tasks li {
  margin-bottom: 0.4rem;
}
</style>
