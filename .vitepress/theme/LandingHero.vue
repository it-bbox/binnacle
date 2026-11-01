<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const { lang } = useData()
const copy = computed(() => lang.value.startsWith('ru') ? {
  title: ['Панель управления', 'ИИ-разработкой.'],
  lead: 'Локальное приложение и набор навыков для работы с ИИ-агентами. Планируйте задачи, передавайте агентам контекст проекта и отслеживайте прогресс и расход токенов.',
  detail: 'Работает с Git, Markdown и вашим трекером. Вы выбираете задачи и запускаете агентов.',
  start: 'Быстрый старт', docs: 'Как это работает',
  caption: 'Знания проекта сохраняются между сессиями.',
  diagram: 'Абстрактная композиция из непрерывных слоёв: знания проекта сохраняются, пока работа продолжается.',
  local: 'На вашем компьютере', portable: 'Markdown · Git · Трекер', control: 'Вы управляете процессом',
} : {
  title: ['Your control panel', 'for AI development.'],
  lead: 'A local app and a set of skills for working with coding agents. Plan tasks, give agents your project context, and track progress and token usage.',
  detail: 'Works with Git, Markdown and your issue tracker. You choose the tasks and start the agents.',
  start: 'Get started', docs: 'How it works',
  caption: 'Project knowledge stays between sessions.',
  diagram: 'An abstract composition of continuous layers: project knowledge persists as the work moves forward.',
  local: 'On your machine', portable: 'Markdown · Git · Tracker', control: 'You stay in control',
})
const prefix = computed(() => lang.value.startsWith('ru') ? '/ru' : '')

// A single continuous surface; its contours carry no provider names or simulated activity.
const contours = Array.from({ length: 25 }, (_, layer) =>
  `M36 ${130 + layer * 5} C180 ${40 + layer * 5} 205 ${335 + layer * 4} 330 ${230 + layer * 4} S490 ${80 + layer * 5} 590 ${145 + layer * 5}`,
)
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

    <figure class="context-art" aria-labelledby="context-caption">
      <svg class="context-ribbon" viewBox="0 0 620 460" fill="none" role="img" :aria-label="copy.diagram">
        <defs>
          <linearGradient id="context-ink" x1="36" y1="120" x2="590" y2="350" gradientUnits="userSpaceOnUse">
            <stop class="context-fade" />
            <stop offset="0.28" class="context-accent" />
            <stop offset="0.7" class="context-accent" />
            <stop offset="1" class="context-fade" />
          </linearGradient>
          <linearGradient id="context-surface" x1="310" y1="90" x2="310" y2="420" gradientUnits="userSpaceOnUse">
            <stop class="context-accent" stop-opacity="0.09" />
            <stop offset="1" class="context-accent" stop-opacity="0" />
          </linearGradient>
        </defs>
        <path d="M36 130 C180 40 205 335 330 230 S490 80 590 145 L590 265 C490 200 455 222 330 326 S180 160 36 250 Z" fill="url(#context-surface)" />
        <path v-for="(contour, index) in contours" :key="index" :d="contour" stroke="url(#context-ink)" :stroke-width="index % 6 === 0 ? 1.8 : 0.8" :opacity="index % 6 === 0 ? 0.95 : 0.5" />
        <path d="M95 112 L95 232 M526 118 L526 238" class="context-cross-section" />
      </svg>
      <figcaption id="context-caption">{{ copy.caption }}</figcaption>
    </figure>
  </section>
  <div class="landing-principles">
    <span><span aria-hidden="true">◉</span>{{ copy.local }}</span>
    <span><span aria-hidden="true">⌘</span>{{ copy.portable }}</span>
    <span><span aria-hidden="true">◇</span>{{ copy.control }}</span>
  </div>
</template>
