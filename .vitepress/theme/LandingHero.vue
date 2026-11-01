<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const { lang } = useData()
const copy = computed(() => lang.value.startsWith('ru') ? {
  title: ['Панель управления', 'ИИ-разработкой.'],
  lead: 'Локальное приложение и набор навыков для работы с ИИ-агентами. Планируйте задачи, передавайте агентам контекст проекта и отслеживайте прогресс и расход токенов.',
  detail: 'Работает с Git, Markdown и вашим трекером. Вы выбираете задачи и запускаете агентов.',
  start: 'Быстрый старт', docs: 'Как это работает',
  diagram: 'От знаний проекта — к работе',
  project: 'Ваш проект', sources: ['Markdown', 'Git', 'Трекер'],
  sourceDetails: ['Документы и решения', 'Изменения кода', 'Задачи и зависимости'],
  context: 'Контекст для агента', status: 'Состояние задач', usage: 'Расход токенов',
  you: 'Вы', choose: 'Выбираете задачу', launch: 'запускаете',
  agent: 'ИИ-агент', work: 'Работает с контекстом',
  caption: 'Знания остаются в проекте. Binnacle собирает контекст для агента и показывает вам ход работы.',
  local: 'На вашем компьютере', portable: 'Markdown · Git · Трекер', control: 'Вы управляете процессом',
} : {
  title: ['Your control panel', 'for AI development.'],
  lead: 'A local app and a set of skills for working with coding agents. Plan tasks, give agents your project context, and track progress and token usage.',
  detail: 'Works with Git, Markdown and your issue tracker. You choose the tasks and start the agents.',
  start: 'Get started', docs: 'How it works',
  diagram: 'From project knowledge to work',
  project: 'Your project', sources: ['Markdown', 'Git', 'Tracker'],
  sourceDetails: ['Docs and decisions', 'Code changes', 'Tasks and dependencies'],
  context: 'Context for the agent', status: 'Task status', usage: 'Token usage',
  you: 'You', choose: 'Choose a task', launch: 'start',
  agent: 'Coding agent', work: 'Works with context',
  caption: 'Knowledge stays in your project. Binnacle prepares context for the agent and shows you how work is going.',
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

    <figure class="hero-map" aria-labelledby="project-map-title">
      <p id="project-map-title" class="map-heading">{{ copy.diagram }}</p>
      <div class="map-flow">
        <div class="map-project">
          <p class="map-label">{{ copy.project }}</p>
          <div v-for="(source, index) in copy.sources" :key="source" class="map-source">
            <span class="map-source-icon" aria-hidden="true">{{ ['#', '⑂', '☷'][index] }}</span>
            <div><strong>{{ source }}</strong><small>{{ copy.sourceDetails[index] }}</small></div>
          </div>
        </div>
        <span class="map-connector" aria-hidden="true">→</span>
        <div class="map-binnacle">
          <img :src="withBase('/favicon.svg')" alt="" width="36" height="36">
          <strong>Binnacle</strong>
          <ul><li>{{ copy.context }}</li><li>{{ copy.status }}</li><li>{{ copy.usage }}</li></ul>
        </div>
        <span class="map-connector" aria-hidden="true">→</span>
        <div class="map-work">
          <div class="map-person"><span class="map-person-icon" aria-hidden="true">◎</span><strong>{{ copy.you }}</strong><small>{{ copy.choose }}</small></div>
          <div class="map-launch"><span>{{ copy.launch }}</span><span aria-hidden="true">↓</span></div>
          <div class="map-agent"><span class="map-person-icon" aria-hidden="true">⌘</span><strong>{{ copy.agent }}</strong><small>{{ copy.work }}</small></div>
        </div>
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
