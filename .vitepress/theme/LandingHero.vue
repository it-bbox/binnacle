<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import overviewLight from '../../assets/tour/overview-light.jpg'
import overviewDark from '../../assets/tour/overview-dark.jpg'

const { lang } = useData()
const copy = computed(() => lang.value.startsWith('ru') ? {
  title: ['Панель управления', 'ИИ-разработкой.'],
  lead: 'Локальное приложение и набор навыков для работы с ИИ-агентами. Планируйте задачи, передавайте агентам контекст проекта и отслеживайте прогресс и расход токенов.',
  detail: 'Работает с Git, Markdown и вашим трекером. Вы выбираете задачи и запускаете агентов.',
  start: 'Быстрый старт', docs: 'Как это работает',
  caption: 'Обзор проекта: следующий шаг, прогресс и текущая работа.',
  sample: 'Дашборд Binnacle · демонстрационные данные',
  enlarge: 'Открыть обзор крупнее',
  local: 'На вашем компьютере', portable: 'Markdown · Git · Трекер', control: 'Вы управляете процессом',
} : {
  title: ['Your control panel', 'for AI development.'],
  lead: 'A local app and a set of skills for working with coding agents. Plan tasks, give agents your project context, and track progress and token usage.',
  detail: 'Works with Git, Markdown and your issue tracker. You choose the tasks and start the agents.',
  start: 'Get started', docs: 'How it works',
  caption: 'Project overview: the next action, progress and current work.',
  sample: 'Binnacle dashboard · sample data',
  enlarge: 'Open the full-size overview',
  local: 'On your machine', portable: 'Markdown · Git · Tracker', control: 'You stay in control',
})
const prefix = computed(() => lang.value.startsWith('ru') ? '/ru' : '')

</script>

<template>
  <section class="landing-hero" aria-labelledby="landing-title">
    <div class="landing-intro">
      <p class="landing-brand"><img :src="withBase('/favicon.svg')" alt="" width="30" height="30">Binnacle Dev</p>
      <h1 id="landing-title"><span>{{ copy.title[0] }}</span><span>{{ copy.title[1] }}</span></h1>
      <p class="landing-lead">{{ copy.lead }}</p>
      <p class="landing-detail">{{ copy.detail }}</p>
      <div class="landing-actions">
        <a class="landing-button primary" :href="withBase(`${prefix}/quick-start`)">{{ copy.start }} <span aria-hidden="true">↗</span></a>
        <a class="landing-button secondary" :href="withBase(`${prefix}/operations/01-new-project`)">{{ copy.docs }} <span aria-hidden="true">→</span></a>
      </div>
      <p class="landing-platforms">Node.js 24 LTS <span aria-hidden="true">/</span> Linux · macOS · Windows</p>
      <slot />
    </div>

    <figure class="hero-preview">
      <div class="demo-window">
        <div class="demo-window-bar"><span aria-hidden="true">● ● ●</span><span>{{ copy.sample }}</span></div>
        <a class="tour-light" :href="overviewLight" target="_blank" rel="noopener" :aria-label="copy.enlarge"><img :src="overviewLight" :alt="copy.caption" width="1280" height="720"></a>
        <a class="tour-dark" :href="overviewDark" target="_blank" rel="noopener" :aria-label="copy.enlarge"><img :src="overviewDark" :alt="copy.caption" width="1280" height="720"></a>
      </div>
      <figcaption>{{ copy.caption }}</figcaption>
    </figure>
  </section>
  <div class="landing-principles">
    <span><span aria-hidden="true">◉</span>{{ copy.local }}</span>
    <span><span aria-hidden="true">⌘</span>{{ copy.portable }}</span>
    <span><span aria-hidden="true">◇</span>{{ copy.control }}</span>
  </div>
</template>
