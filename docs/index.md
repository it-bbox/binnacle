---
layout: home
sidebar: false
pageClass: landing
title: Binnacle Dev
titleTemplate: false
description: "A local, provider-agnostic AI Engineering Control Plane: project memory, workflow and observability across coding agents."
---

<script setup>
import demo from '../assets/demo.gif'
import overview from '../assets/overview.png'
import tasks from '../assets/tasks.png'
import usage from '../assets/usage.png'
import attention from '../assets/attention.png'
</script>

<LandingHero />

<div class="landing-badges">

[![CI](https://github.com/it-bbox/binnacle/actions/workflows/ci.yml/badge.svg)](https://github.com/it-bbox/binnacle/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@it-bbox/binnacle)](https://www.npmjs.com/package/@it-bbox/binnacle)
[![license](https://img.shields.io/badge/license-Apache--2.0-blue)](https://github.com/it-bbox/binnacle/blob/main/LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D24%20%3C27-339933)](https://github.com/it-bbox/binnacle/blob/main/package.json)

</div>

<section class="landing-section" aria-labelledby="see-the-work">

<div class="landing-demo-main">
<div>

<p class="section-kicker">A clear view of the work</p>

<h2 id="see-the-work">Less catching up. More moving forward.</h2>

<p class="section-description">Know what is ready, what is running and what needs your decision. Binnacle brings the project's state into view, so a fresh session can start from the work already done.</p>

<div class="landing-notes">
<div><strong>Keep the context.</strong><p>Decisions live in Markdown, Git and your tracker. Chats can end without taking the project with them.</p></div>
<div><strong>See where the effort goes.</strong><p>Tasks, agent activity and token usage share one view. Missing metrics stay missing.</p></div>
<div><strong>Stay at the helm.</strong><p>You choose the work and start the agents. Binnacle keeps the instruments in view.</p></div>
</div>

</div>
<div class="demo-window">
<div class="demo-window-bar"><span aria-hidden="true">● ● ●</span><span>Binnacle / dashboard demo</span></div>

<img :src="demo" alt="Binnacle's dashboard in action: the overview, a project's board, a ticket, usage and attention" loading="lazy" width="1280" height="800">

</div>
</div>

</section>

<section class="landing-section" aria-labelledby="project-in-focus">

<p class="section-kicker">The project, in focus</p>

<h2 id="project-in-focus">The details behind the next step.</h2>

<p class="section-description">A board for the work, a view of usage and a place for what needs attention. Open a screenshot to take a closer look.</p>

<div class="landing-gallery">
<figure class="landing-shot">

<a :href="overview" class="screenshot-link"><img :src="overview" alt="The overview: what is next, the epics' progress and what is running now" loading="lazy"></a>

<figcaption><strong>Overview.</strong> The next step, progress and running work.</figcaption>
</figure>
<figure class="landing-shot">

<a :href="tasks" class="screenshot-link"><img :src="tasks" alt="A project's board: the current epic's tickets in four columns" loading="lazy"></a>

<figcaption><strong>Tasks.</strong> What can start and what is waiting.</figcaption>
</figure>
<figure class="landing-shot">

<a :href="usage" class="screenshot-link"><img :src="usage" alt="Usage: tokens by kind, by model, by task and by role" loading="lazy"></a>

<figcaption><strong>Usage.</strong> Where the tokens and rework went.</figcaption>
</figure>
<figure class="landing-shot">

<a :href="attention" class="screenshot-link"><img :src="attention" alt="Attention: what is running now and what ran recently" loading="lazy"></a>

<figcaption><strong>Attention.</strong> What needs a human decision.</figcaption>
</figure>
</div>

</section>

<section class="landing-section landing-setup" aria-labelledby="install">
<div>

<p class="section-kicker">One local daemon. Your project.</p>

<h2 id="install">Start where you already work.</h2>

<p>Install Binnacle, then run <code>binn init</code> in your project. Review one setup plan and continue from your agent's skills.</p>

<a class="landing-button secondary" href="./quick-start">Read the quick start <span aria-hidden="true">→</span></a>

</div>
<div>

```bash
npm i -g @it-bbox/binnacle
binn daemon start
```

<p>New project or an existing codebase. Claude Code, Codex, Gemini and other coding agents.</p>

</div>
</section>

<div class="landing-requirements">

Node.js 24 LTS, on Linux, macOS or Windows. A free loopback port: the dashboard uses `http://127.0.0.1:7717` by default; with autostart off, `binn daemon start` takes another port from `BINNACLE_PORT`.

Docker is not needed for Binnacle itself: it is one local daemon, and a container adds a published port and a second home to look after — use it only when your app already runs in one.

</div>

<ul class="landing-next">
<li><a href="./operations/01-new-project">User guides ↗</a></li>
<li><a href="./containers-and-mod">Containers & the mod ↗</a></li>
<li><a href="./showcase/write-up">What Binnacle's own work cost ↗</a></li>
<li><a href="https://github.com/it-bbox/binnacle">GitHub ↗</a></li>
<li><a href="https://www.npmjs.com/package/@it-bbox/binnacle">npm ↗</a></li>
</ul>
