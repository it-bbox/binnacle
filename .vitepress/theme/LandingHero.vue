<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData, withBase } from 'vitepress'

const { lang } = useData()
const selected = ref('Claude Code')
const agents = ['Claude Code', 'Codex', 'Gemini CLI']
const copy = computed(() => lang.value.startsWith('ru') ? {
  eyebrow: 'Локальная память для работы с ИИ',
  title: ['Одна память проекта.', 'Любой coding agent.'],
  lead: 'Claude сегодня. Codex завтра. Проект не начинается с нуля.',
  detail: 'Контекст, задачи и решения остаются в проекте. Новый агент получает ясную картину и продолжает работу.',
  start: 'Быстрый старт', docs: 'Как это работает',
  sources: 'Источники проекта', memory: 'Память проекта', snapshot: 'Компактный контекст',
  decisions: 'Документы и решения', history: 'История изменений', tasks: 'Задачи и зависимости',
  retained: 'Контекст сохранён', choose: 'Выберите агента для иллюстрации',
  caption: 'Схема работы. Меняется агент — знания остаются.',
  diagram: 'Markdown, Git и тикеты сохраняют знания проекта; Binnacle передаёт компактный контекст выбранному агенту.',
  local: 'На вашем компьютере', portable: 'Markdown · Git · Трекер', control: 'Вы управляете процессом',
} : {
  eyebrow: 'Local project memory for AI engineering',
  title: ['One project memory.', 'Any coding agent.'],
  lead: 'Claude today. Codex tomorrow. Your project never starts from zero.',
  detail: 'Context, tasks and decisions stay with your project. A fresh agent gets a clear picture and picks up the work.',
  start: 'Get started', docs: 'How it works',
  sources: 'Project sources', memory: 'Project memory', snapshot: 'Compact context',
  decisions: 'Documents & decisions', history: 'Change history', tasks: 'Tasks & dependencies',
  retained: 'Context preserved', choose: 'Choose an agent for the illustration',
  caption: 'How it works. Change the agent. Keep the knowledge.',
  diagram: 'Markdown, Git and tickets keep project knowledge; Binnacle hands compact context to the selected agent.',
  local: 'On your machine', portable: 'Markdown · Git · Tracker', control: 'You stay in control',
})
const prefix = computed(() => lang.value.startsWith('ru') ? '/ru' : '')
</script>

<template>
  <section class="landing-hero" aria-labelledby="landing-title">
    <div class="landing-intro">
      <p class="landing-eyebrow"><span aria-hidden="true"></span>{{ copy.eyebrow }}</p>
      <h1 id="landing-title"><span>{{ copy.title[0] }}</span><span>{{ copy.title[1] }}</span></h1>
      <p class="landing-lead">{{ copy.lead }}</p>
      <p class="landing-detail">{{ copy.detail }}</p>
      <div class="landing-actions">
        <a class="landing-button primary" :href="withBase(`${prefix}/quick-start`)">{{ copy.start }} <span aria-hidden="true">↗</span></a>
        <a class="landing-button secondary" :href="withBase(`${prefix}/operations/01-new-project`)">{{ copy.docs }} <span aria-hidden="true">→</span></a>
      </div>
      <p class="landing-install"><span aria-hidden="true">$</span><code>npm i -g @it-bbox/binnacle</code></p>
      <p class="landing-platforms">Node.js 24 LTS <span aria-hidden="true">/</span> Linux · macOS · Windows</p>
    </div>

    <figure class="memory-illustration" aria-labelledby="memory-caption">
      <div class="memory-topline"><span>BINNACLE / CONTEXT</span><span aria-hidden="true">01 — 03</span></div>
      <div class="memory-chart">
        <svg class="memory-connections" viewBox="0 0 480 340" fill="none" role="img" :aria-label="copy.diagram">
          <defs>
            <pattern id="memory-grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <path d="M 24 0 L 0 0 0 24" class="memory-grid-line" />
            </pattern>
          </defs>
          <rect width="480" height="340" fill="url(#memory-grid)" />
          <path class="memory-wire" d="M100 70H165L240 170M100 170H240M100 270H165L240 170M240 170H395" />
          <path :key="selected" class="memory-signal" d="M100 70H165L240 170H395" pathLength="100" />
          <circle cx="240" cy="170" r="80" class="memory-orbit" />
          <circle cx="240" cy="170" r="66" class="memory-dial" />
          <g class="memory-ticks">
            <path v-for="tick in 48" :key="tick" :transform="`rotate(${tick * 7.5} 240 170)`" :d="tick % 4 === 0 ? 'M240 93V100' : 'M240 94V97'" />
          </g>
          <path class="memory-needle" d="M240 120L252 154L240 149L228 154Z" />
          <path class="memory-needle-tail" d="M240 220L252 186L240 191L228 186Z" />
          <circle cx="240" cy="170" r="5" class="memory-pivot" />
          <circle cx="160" cy="170" r="3" class="memory-pin" />
          <circle cx="320" cy="170" r="3" class="memory-pin" />
        </svg>
        <span class="memory-source-label">{{ copy.sources }}</span>
        <div class="memory-source source-markdown"><span class="source-glyph" aria-hidden="true">M↓</span><div><strong>Markdown</strong><small>{{ copy.decisions }}</small></div></div>
        <div class="memory-source source-git"><span class="source-glyph" aria-hidden="true">⑂</span><div><strong>Git</strong><small>{{ copy.history }}</small></div></div>
        <div class="memory-source source-tracker"><span class="source-glyph" aria-hidden="true">☷</span><div><strong>Tracker</strong><small>{{ copy.tasks }}</small></div></div>
        <div class="memory-core"><strong>Binnacle</strong><small>{{ copy.memory }}</small></div>
        <div :key="selected + '-destination'" class="memory-destination" aria-live="polite"><span class="destination-arrow" aria-hidden="true">↗</span><strong>{{ selected }}</strong><small>{{ copy.snapshot }}</small></div>
        <span class="memory-retained"><span aria-hidden="true">✓</span>{{ copy.retained }}</span>
      </div>
      <div class="memory-agent-picker" role="group" :aria-label="copy.choose">
        <button v-for="agent in agents" :key="agent" type="button" :aria-pressed="selected === agent" @click="selected = agent">{{ agent }}</button>
      </div>
      <figcaption id="memory-caption">{{ copy.caption }}</figcaption>
    </figure>
  </section>
  <div class="landing-principles">
    <span><span aria-hidden="true">◉</span>{{ copy.local }}</span>
    <span><span aria-hidden="true">⌘</span>{{ copy.portable }}</span>
    <span><span aria-hidden="true">◇</span>{{ copy.control }}</span>
  </div>
</template>
