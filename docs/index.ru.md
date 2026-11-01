---
layout: home
sidebar: false
pageClass: landing
title: Binnacle Dev
titleTemplate: false
description: "Binnacle Dev — локальная панель и навыки для разработки с ИИ-агентами. Задачи, контекст проекта и расход токенов в одном месте."
---

<LandingHero>

<div class="landing-badges">

[![CI](https://github.com/it-bbox/binnacle/actions/workflows/ci.yml/badge.svg)](https://github.com/it-bbox/binnacle/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@it-bbox/binnacle)](https://www.npmjs.com/package/@it-bbox/binnacle)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](https://github.com/it-bbox/binnacle/blob/main/LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D24%20%3C27-339933)](https://github.com/it-bbox/binnacle/blob/main/package.json)

</div>

</LandingHero>

<section class="landing-section landing-setup" aria-labelledby="install">
<div>

<p class="section-kicker">Установка</p>

<h2 id="install">Подключите Binnacle к проекту.</h2>

<p>Установите инструмент и выполните эти команды из каталога своего проекта. <code>binn init</code> покажет план настройки и запросит подтверждение. Дашборд откроется в браузере.</p>

<a class="landing-button secondary" href="./quick-start">Быстрый старт <span aria-hidden="true">→</span></a>

</div>
<div>

```bash
npm i -g @it-bbox/binnacle
binn daemon start
binn init
binn dashboard
```

<p>Навыки для вашего ИИ-агента подключаются при настройке. Подходит для нового проекта и существующей кодовой базы.</p>

</div>
</section>

<div class="landing-requirements">

Node.js 24 LTS, на Linux, macOS или Windows. Свободный loopback-порт: дашборд использует `http://127.0.0.1:7717` по умолчанию; с выключенным автозапуском `binn daemon start` берёт другой порт из `BINNACLE_PORT`.

Docker для самого Binnacle не нужен: это один локальный демон, а контейнер добавляет опубликованный порт и второе хранилище в обслуживание — он нужен, только если ваше приложение уже живёт в контейнере.

</div>

<LandingTour />

<ul class="landing-next">
<li><a href="./operations/01-new-project">Руководства ↗</a></li>
<li><a href="./containers-and-mod">Контейнеры и мод ↗</a></li>
<li><a href="./showcase/write-up">Сколько стоила работа над Binnacle ↗</a></li>
<li><a href="https://github.com/it-bbox/binnacle">GitHub ↗</a></li>
<li><a href="https://www.npmjs.com/package/@it-bbox/binnacle">npm ↗</a></li>
</ul>
