<script setup lang="ts">
import { usePolling } from '~/composables/daemon';
import { checkout, latestActivity, loadProjects, position, projectName } from '~/composables/projects';

const { data, error } = usePolling(loadProjects);
</script>

<template>
  <h1>Projects</h1>
  <p v-if="error" class="warn"><code>{{ error.code }}</code> {{ error.message }}</p>
  <p v-else-if="data === null" class="muted">Loading…</p>
  <p v-else-if="data.length === 0" class="muted">No projects are registered. Register one with <code>binn project register [path]</code>.</p>
  <table v-else>
    <thead>
      <tr>
        <th>Project</th>
        <th>Path</th>
        <th>Position</th>
        <th>Registered checkout</th>
        <th>Latest activity</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="view in data" :key="view.project.path">
        <td><NuxtLink :to="{ path: '/project', query: { project: view.project.path } }">{{ projectName(view.project) }}</NuxtLink></td>
        <td><code>{{ view.project.path }}</code></td>
        <td v-if="view.project.unavailable !== null" colspan="3" class="warn">Unavailable: {{ view.project.unavailable }}</td>
        <td v-else-if="view.failure" colspan="3" class="warn"><code>{{ view.failure.code }}</code> {{ view.failure.message }}</td>
        <template v-else-if="view.snapshot">
          <td>{{ position(view.snapshot) }}</td>
          <td>{{ checkout(view.snapshot.git) }}</td>
          <td>{{ latestActivity(view.snapshot.activity) }}</td>
        </template>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
  background: var(--panel);
}
th,
td {
  text-align: left;
  vertical-align: top;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--line);
}
th {
  font-weight: 600;
  color: var(--muted);
}
</style>
