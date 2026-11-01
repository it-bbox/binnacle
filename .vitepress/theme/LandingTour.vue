<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useData } from 'vitepress'
import overviewLight from '../../assets/tour/overview-light.jpg'
import overviewDark from '../../assets/tour/overview-dark.jpg'
import boardLight from '../../assets/tour/board-light.jpg'
import boardDark from '../../assets/tour/board-dark.jpg'
import usageLight from '../../assets/tour/usage-light.jpg'
import usageDark from '../../assets/tour/usage-dark.jpg'
import attentionLight from '../../assets/tour/attention-light.jpg'
import attentionDark from '../../assets/tour/attention-dark.jpg'

const { lang } = useData()
const selected = ref(0)
const copy = computed(() => lang.value.startsWith('ru') ? {
  kicker: 'Что показывает Binnacle', title: 'Задачи, расход и активность агентов.',
  intro: 'Выберите раздел: каждый экран отвечает на свой вопрос о работе над проектом.',
  steps: [
    { title: 'Обзор — что делать дальше', text: 'Следующий шаг из плана, прогресс эпика и задачи, которые уже можно начать.', alt: 'Обзор Binnacle: следующий шаг, прогресс эпика, готовые задачи и текущая работа.' },
    { title: 'Задачи — что готово и что ждёт', text: 'Доска задач с зависимостями и состояниями. Отдельно видно, где требуется ваше решение.', alt: 'Доска задач Binnacle с колонками готовности, работы и завершения.' },
    { title: 'Расход — куда уходят токены', text: 'Входные и выходные токены, кеш, разбивка по моделям и задачам. Отсутствующие метрики отмечены как «нет данных».', alt: 'Расход Binnacle: токены по видам, моделям и задачам на демонстрационных данных.' },
    { title: 'Внимание — что требует проверки', text: 'Проблемы по проектам, текущие и недавние запуски. Можно увидеть, где работа остановилась или требует вмешательства.', alt: 'Внимание Binnacle: проблемы проектов, текущие и недавние запуски.' },
  ],
  sample: 'Настоящий интерфейс · демонстрационные данные', enlarge: 'Увеличить снимок', close: 'Закрыть', previous: 'Предыдущий снимок', next: 'Следующий снимок',
} : {
  kicker: 'Inside Binnacle', title: 'Tasks, token usage and agent activity.',
  intro: 'Choose a section. Each screen answers a different question about the work.',
  steps: [
    { title: 'Overview — what to do next', text: 'The next action from your plan, epic progress and tasks that are ready to start.', alt: 'Binnacle overview: next action, epic progress, ready tasks and current work.' },
    { title: 'Tasks — what is ready and what is waiting', text: 'A task board with dependencies and states. Decisions waiting for you are shown separately.', alt: 'Binnacle task board with ready, in-progress and completed work.' },
    { title: 'Usage — where tokens go', text: 'Input, output and cached tokens, broken down by model and task. Missing metrics stay marked as no data.', alt: 'Binnacle usage: tokens by kind, model and task using sample data.' },
    { title: 'Attention — what needs checking', text: 'Project issues, current runs and recent activity. See where work has stalled or needs your involvement.', alt: 'Binnacle attention: project issues, current runs and recent activity.' },
  ],
  sample: 'Actual interface · sample data', enlarge: 'Enlarge screenshot', close: 'Close', previous: 'Previous screenshot', next: 'Next screenshot',
})
// Follow the site's selected theme before hydration and after a manual switch.
const images = [
  { light: overviewLight, dark: overviewDark },
  { light: boardLight, dark: boardDark },
  { light: usageLight, dark: usageDark },
  { light: attentionLight, dark: attentionDark },
]
const lightbox = ref<HTMLDialogElement>()
let previousOverflow = ''
// Safari does not focus a clicked link, so the dialog cannot return focus to it on its own.
let trigger: HTMLElement | null = null
function openLightbox(event: MouseEvent) {
  if (!lightbox.value || lightbox.value.open) return
  trigger = event.currentTarget as HTMLElement
  previousOverflow = document.body.style.overflow
  lightbox.value.showModal()
  document.body.style.overflow = 'hidden'
}
function restoreScroll() {
  document.body.style.overflow = previousOverflow
  trigger?.focus()
}
function moveScreenshot(direction: number) {
  selected.value = (selected.value + direction + images.length) % images.length
}
onBeforeUnmount(() => {
  if (lightbox.value?.open) {
    lightbox.value.close()
    restoreScroll()
  }
})
</script>

<template>
  <section class="landing-section landing-tour" aria-labelledby="see-the-work">
    <div class="landing-demo-main">
      <div>
        <p class="section-kicker">{{ copy.kicker }}</p>
        <h2 id="see-the-work">{{ copy.title }}</h2>
        <p class="section-description">{{ copy.intro }}</p>
        <div class="tour-steps" role="group" :aria-label="copy.title">
          <button v-for="(step, index) in copy.steps" :key="index" type="button" :aria-pressed="selected === index" aria-controls="tour-screen" @click="selected = index">
            <span class="tour-number" aria-hidden="true">0{{ index + 1 }}</span>
            <span><strong>{{ step.title }}</strong><span class="tour-description">{{ step.text }}</span></span>
          </button>
        </div>
      </div>
      <figure id="tour-screen" class="tour-screen" aria-live="polite">
        <div class="demo-window">
          <div class="demo-window-bar"><span aria-hidden="true">● ● ●</span><span>{{ copy.sample }}</span></div>
          <a v-for="theme in (['light', 'dark'] as const)" :key="theme" :class="`tour-${theme}`" :href="images[selected]![theme]" aria-haspopup="dialog" @click.prevent="openLightbox" :aria-label="copy.enlarge">
            <img :src="images[selected]![theme]" :alt="copy.steps[selected]!.alt" loading="lazy" width="1280" height="720">
          </a>
        </div>
        <figcaption><span>0{{ selected + 1 }} / 04</span><a v-for="theme in (['light', 'dark'] as const)" :key="theme" :class="`tour-${theme}`" :href="images[selected]![theme]" tabindex="-1" @click.prevent="openLightbox">{{ copy.enlarge }} <span aria-hidden="true">⤢</span></a></figcaption>
      </figure>
    </div>
    <dialog ref="lightbox" class="tour-lightbox" aria-labelledby="lightbox-title" @close="restoreScroll" @click.self="lightbox?.close()" @keydown.left.prevent="moveScreenshot(-1)" @keydown.right.prevent="moveScreenshot(1)">
      <div class="lightbox-content">
        <header class="lightbox-toolbar">
          <span id="lightbox-title">{{ copy.steps[selected]!.title }}</span>
          <button type="button" autofocus @click="lightbox?.close()">{{ copy.close }} <span aria-hidden="true">×</span></button>
        </header>
        <img v-for="theme in (['light', 'dark'] as const)" :key="theme" :class="`tour-${theme}`" :src="images[selected]![theme]" :alt="copy.steps[selected]!.alt" loading="lazy" width="1280" height="720">
        <div class="lightbox-navigation">
          <button type="button" :aria-label="copy.previous" @click="moveScreenshot(-1)">←</button>
          <span aria-live="polite">0{{ selected + 1 }} / 04</span>
          <button type="button" :aria-label="copy.next" @click="moveScreenshot(1)">→</button>
        </div>
      </div>
    </dialog>
  </section>
</template>
