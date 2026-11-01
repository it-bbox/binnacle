<script setup lang="ts">
import { computed, ref } from 'vue'
import { useData } from 'vitepress'
import boardLight from '../../assets/tour/board-light.jpg'
import boardDark from '../../assets/tour/board-dark.jpg'
import taskLight from '../../assets/tour/task-light.jpg'
import taskDark from '../../assets/tour/task-dark.jpg'
import commandLight from '../../assets/tour/command-light.jpg'
import commandDark from '../../assets/tour/command-dark.jpg'

const { lang } = useData()
const selected = ref(0)
const copy = computed(() => lang.value.startsWith('ru') ? {
  kicker: 'От плана к работе', title: 'Выберите задачу. Передайте её агенту.',
  intro: 'Пример: в интернет-магазине готова корзина. Следующий шаг — проверка формы заказа. Выберите шаг, чтобы посмотреть, как это устроено.',
  steps: [
    { title: 'Найдите задачу, которую можно начать', text: 'Доска показывает готовность и зависимости. Проверку формы уже можно делать; отправка чека ждёт её завершения.', alt: 'Доска Example shop: проверка формы готова к старту, отправка чека заблокирована зависимостью.' },
    { title: 'Проверьте требования и контекст', text: 'В карточке — условия задачи, критерии готовности, зависимость и ссылка на спецификацию. Всё прочитано из файлов проекта.', alt: 'Карточка проверки формы с выполненной зависимостью, ролями и критериями готовности.' },
    { title: 'Скопируйте команду в чат агента', text: 'Вы запускаете навык в новой сессии. Binnacle передаёт агенту бриф задачи, чтобы ему не пришлось восстанавливать план по переписке.', alt: 'Команда навыка для выбранной задачи и подтверждение её копирования.' },
  ],
  sample: 'Настоящий интерфейс · пример проекта', enlarge: 'Открыть снимок крупнее ↗',
} : {
  kicker: 'From plan to implementation', title: 'Choose a task. Hand it to your agent.',
  intro: 'An example shop has a working cart. Checkout validation is next. Select a step to see how the handoff works.',
  steps: [
    { title: 'Find a task that is ready to start', text: 'The board shows readiness and dependencies. Checkout validation can start; the receipt must wait until it is done.', alt: 'Example shop board: checkout validation is ready; sending the receipt is blocked by a dependency.' },
    { title: 'Check the requirements and context', text: 'The task brings together acceptance criteria, a dependency and its specification. All read from the project files.', alt: 'Checkout validation task with its completed dependency, roles and acceptance criteria.' },
    { title: 'Copy the command into your agent’s chat', text: 'You run the skill in a fresh session. Binnacle supplies a task brief so the agent can pick up the plan without reconstructing it from chat history.', alt: 'The skill command for the selected task, with confirmation that it was copied.' },
  ],
  sample: 'Actual interface · example project', enlarge: 'Open full-size screenshot ↗',
})
// CSS follows VitePress's root theme class before hydration as well as after a manual switch.
const images = [
  { light: boardLight, dark: boardDark },
  { light: taskLight, dark: taskDark },
  { light: commandLight, dark: commandDark },
]
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
          <a v-for="theme in (['light', 'dark'] as const)" :key="theme" :class="`tour-${theme}`" :href="images[selected]![theme]" target="_blank" rel="noopener" :aria-label="copy.enlarge">
            <img :src="images[selected]![theme]" :alt="copy.steps[selected]!.alt" loading="lazy" width="1280" height="720">
          </a>
        </div>
        <figcaption><span>0{{ selected + 1 }} / 03</span><a v-for="theme in (['light', 'dark'] as const)" :key="theme" :class="`tour-${theme}`" :href="images[selected]![theme]" target="_blank" rel="noopener">{{ copy.enlarge }}</a></figcaption>
      </figure>
    </div>
  </section>
</template>
