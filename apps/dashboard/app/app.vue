<script setup lang="ts">
import { useAuthorised } from '~/composables/daemon';

const authorised = useAuthorised();
</script>

<template>
  <p v-if="!authorised" class="signin">Run <code>binn dashboard</code> to open the dashboard.</p>
  <div v-else class="shell">
    <nav>
      <strong>Binnacle</strong>
      <NuxtLink to="/">Overview</NuxtLink>
      <NuxtLink to="/projects">Projects</NuxtLink>
      <NuxtLink to="/attention">Attention</NuxtLink>
    </nav>
    <main>
      <NuxtPage />
    </main>
  </div>
</template>

<style>
:root {
  color-scheme: light dark;
  --fg: #1d2127;
  --muted: #5d6673;
  --bg: #fbfbfa;
  --panel: #ffffff;
  --line: #e2e4e8;
  --warn: #9a4d00;
  font-family: system-ui, sans-serif;
  font-size: 15px;
  line-height: 1.45;
}
@media (prefers-color-scheme: dark) {
  :root {
    --fg: #e6e8eb;
    --muted: #9aa3ae;
    --bg: #15181c;
    --panel: #1c2026;
    --line: #2d333b;
    --warn: #f0a458;
  }
}
body {
  margin: 0;
  color: var(--fg);
  background: var(--bg);
}
nav {
  display: flex;
  gap: 1.25rem;
  align-items: baseline;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--line);
}
nav a {
  color: var(--muted);
  text-decoration: none;
}
nav a.router-link-exact-active {
  color: var(--fg);
}
main {
  max-width: 64rem;
  padding: 1rem 1.25rem 3rem;
}
h1 {
  font-size: 1.25rem;
}
code {
  font-family: ui-monospace, monospace;
  font-size: 0.9em;
}
.muted {
  color: var(--muted);
}
.warn {
  color: var(--warn);
}
.signin {
  padding: 2rem 1.25rem;
}
</style>
