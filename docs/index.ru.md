---
layout: home
sidebar: false
pageClass: landing
title: Binnacle Dev
titleTemplate: false
description: "Локальный provider-agnostic AI Engineering Control Plane: память проекта, workflow и наблюдаемость поверх coding agents."
---

<script setup>
import demo from '../assets/demo.gif'
import overview from '../assets/overview.png'
import tasks from '../assets/tasks.png'
import usage from '../assets/usage.png'
import attention from '../assets/attention.png'
</script>

<LandingHero />

<section class="landing-section" aria-labelledby="see-the-work">

<p class="section-kicker">Работа как на ладони</p>

<h2 id="see-the-work">Меньше вспоминать. Больше делать.</h2>

<p class="section-description">Что готово к старту, что сейчас в работе и где нужно ваше решение. Binnacle показывает состояние проекта, чтобы новая сессия начинала с того, что уже сделано.</p>

<div class="demo-window">
<div class="demo-window-bar"><span aria-hidden="true">● ● ●</span><span>Binnacle / демонстрация дашборда</span></div>

<img :src="demo" alt="Дашборд Binnacle в работе: обзор, доска проекта, тикет, расход и внимание" loading="lazy" width="1280" height="800">

</div>

<div class="landing-notes">
<div><strong>Сохраняйте контекст.</strong><p>Решения живут в Markdown, Git и трекере. Чат может закончиться, не забрав с собой знания проекта.</p></div>
<div><strong>Видьте, куда уходят усилия.</strong><p>Задачи, активность агентов и расход токенов — в одном месте. Если метрик нет, они так и показаны.</p></div>
<div><strong>Оставайтесь у штурвала.</strong><p>Вы выбираете работу и запускаете агентов. Binnacle держит приборы перед глазами.</p></div>
</div>

</section>

<section class="landing-section" aria-labelledby="project-in-focus">

<p class="section-kicker">Проект в фокусе</p>

<h2 id="project-in-focus">Всё, что стоит за следующим шагом.</h2>

<p class="section-description">Доска задач, картина расходов и то, что требует внимания. Откройте скриншот, чтобы рассмотреть детали.</p>

<div class="landing-gallery">
<figure class="landing-shot">

<a :href="overview" class="screenshot-link"><img :src="overview" alt="Обзор: что дальше, прогресс эпиков и что идёт сейчас" loading="lazy"></a>

<figcaption><strong>Обзор.</strong> Следующий шаг, прогресс и текущая работа.</figcaption>
</figure>
<figure class="landing-shot">

<a :href="tasks" class="screenshot-link"><img :src="tasks" alt="Доска проекта: тикеты текущего эпика в четырёх колонках" loading="lazy"></a>

<figcaption><strong>Задачи.</strong> Что можно начать, а что ждёт.</figcaption>
</figure>
<figure class="landing-shot">

<a :href="usage" class="screenshot-link"><img :src="usage" alt="Расход: токены по видам, моделям, задачам и ролям" loading="lazy"></a>

<figcaption><strong>Расход.</strong> Куда ушли токены и доработка.</figcaption>
</figure>
<figure class="landing-shot">

<a :href="attention" class="screenshot-link"><img :src="attention" alt="Внимание: что идёт сейчас и что шло недавно" loading="lazy"></a>

<figcaption><strong>Внимание.</strong> Где нужно решение человека.</figcaption>
</figure>
</div>

</section>

<section class="landing-section landing-setup" aria-labelledby="install">
<div>

<p class="section-kicker">Один локальный демон. Ваш проект.</p>

<h2 id="install">Начните там, где уже работаете.</h2>

<p>Установите Binnacle, затем запустите <code>binn init</code> в проекте. Проверьте один план настройки и продолжайте через навыки своего агента.</p>

<a class="landing-button secondary" href="./quick-start">Быстрый старт <span aria-hidden="true">→</span></a>

</div>
<div>

```bash
npm i -g @it-bbox/binnacle
binn daemon start
```

<p>Новый проект или готовая кодовая база. Claude Code, Codex, Gemini и другие coding agents.</p>

</div>
</section>

<div class="landing-requirements">

Node.js 24 LTS, на Linux, macOS или Windows. Свободный loopback-порт: дашборд использует `http://127.0.0.1:7717` по умолчанию; с выключенным автозапуском `binn daemon start` берёт другой порт из `BINNACLE_PORT`.

Docker для самого Binnacle не нужен: это один локальный демон, а контейнер добавляет опубликованный порт и второе хранилище в обслуживание — он нужен, только если ваше приложение уже живёт в контейнере.

</div>

<ul class="landing-next">
<li><a href="./operations/01-new-project">Руководства ↗</a></li>
<li><a href="./containers-and-mod">Контейнеры и мод ↗</a></li>
<li><a href="./showcase/write-up">Сколько стоила работа над Binnacle ↗</a></li>
<li><a href="https://github.com/it-bbox/binnacle">GitHub ↗</a></li>
<li><a href="https://www.npmjs.com/package/@it-bbox/binnacle">npm ↗</a></li>
</ul>

<div class="landing-badges">

[![CI](https://github.com/it-bbox/binnacle/actions/workflows/ci.yml/badge.svg)](https://github.com/it-bbox/binnacle/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@it-bbox/binnacle)](https://www.npmjs.com/package/@it-bbox/binnacle)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](https://github.com/it-bbox/binnacle/blob/main/LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D24%20%3C27-339933)](https://github.com/it-bbox/binnacle/blob/main/package.json)

</div>
