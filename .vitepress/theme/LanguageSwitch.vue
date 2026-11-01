<script setup lang="ts">
import { computed } from 'vue'
import { useData, useRoute, withBase } from 'vitepress'

/**
 * One switch between the two languages, on the page the reader is already on: a source page and
 * its `*.ru.md` twin are built at paths that differ only by the `ru/` prefix (`docs/README`).
 */
const route = useRoute()
const { site } = useData()

/** The route without the deployment's base, which `route.path` carries. */
const path = computed(() => {
  const base = site.value.base
  return route.path.startsWith(base) ? route.path.slice(base.length - 1) : route.path
})

const russian = computed(() => path.value === '/ru' || path.value.startsWith('/ru/'))

const twin = computed(() => {
  if (russian.value) return path.value.replace(/^\/ru(?=\/|$)/, '') || '/'
  return path.value === '/' ? '/ru/' : `/ru${path.value}`
})

const label = computed(() => (russian.value ? 'English' : 'Русский'))
</script>

<template>
  <a
    class="language-switch"
    :href="withBase(twin)"
    :hreflang="russian ? 'en' : 'ru'"
    :lang="russian ? 'en' : 'ru'"
  >{{ label }}</a>
</template>
