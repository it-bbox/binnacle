---
layout: home
sidebar: false
pageClass: landing
title: Binnacle Dev
titleTemplate: false
description: "Binnacle Dev is a local app and skills for working with coding agents: tasks, project context and token usage in one place."
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

<p class="section-kicker">Installation</p>

<h2 id="install">Connect Binnacle to your project.</h2>

<p>Install the tool and run these commands from your project directory. <code>binn init</code> shows a setup plan and asks for confirmation. The dashboard opens in your browser.</p>

<a class="landing-button secondary" href="./quick-start">Read the quick start <span aria-hidden="true">→</span></a>

</div>
<div>

```bash
npm i -g @it-bbox/binnacle
binn daemon start
binn init
binn dashboard
```

<p>Skills for your coding agent are connected during setup. Works with new projects and existing codebases.</p>

</div>
</section>

<div class="landing-requirements">

Node.js 24 LTS, on Linux, macOS or Windows. A free loopback port: the dashboard uses `http://127.0.0.1:7717` by default; with autostart off, `binn daemon start` takes another port from `BINNACLE_PORT`.

Docker is not needed for Binnacle itself: it is one local daemon, and a container adds a published port and a second home to look after — use it only when your app already runs in one.

</div>

<LandingTour />

<ul class="landing-next">
<li><a href="./operations/01-new-project">User guides ↗</a></li>
<li><a href="./containers-and-mod">Containers & the mod ↗</a></li>
<li><a href="./showcase/write-up">What Binnacle's own work cost ↗</a></li>
<li><a href="https://github.com/it-bbox/binnacle">GitHub ↗</a></li>
<li><a href="https://www.npmjs.com/package/@it-bbox/binnacle">npm ↗</a></li>
</ul>
