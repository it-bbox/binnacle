---
name: help
description: Explain in plain words, in the language the user writes in, what Binnacle is, which /binnacle skill to use when, and the usual order of a day. Calls no tool, runs no command and needs no daemon.
disable-model-invocation: true
---

Answer in the language the user writes in, in plain words: translate the guide below, but keep the skill names and commands as they are. Call no tool and run no command: the guide is all here, and it needs no daemon. Give it whole, then stop.

## What Binnacle is

Binnacle keeps track of a software project for you and your coding agent: where the work stands, what changed since you last looked, and what can start next. It reads your Git repository and your tracker, and if it is not running, the project is developed the normal way.

## Setting up

- `/binnacle:audit` — see what a repository has and lacks for Binnacle, before changing anything.
- `/binnacle:init` — set a repository up: shows the whole plan, and writes it only after your yes.
- `/binnacle:daemon` — start, stop or check Binnacle's background service (`start`, `stop`, `status`).
- `/binnacle:register` — tell the running service about this repository.
- `/binnacle:status` — check in a few lines that this project and this checkout are seen as you expect.
- `/binnacle:dashboard` — open the dashboard in the browser.

## A day's work

- `/binnacle:product` — start your session: where the project stands and what comes next.
- `/binnacle:daily` — what changed since your last daily and what needs your attention.
- `/binnacle:task` — the brief for one ticket, ending with the command that starts it.
- `/binnacle:checkpoint` — at the end of a session, save the decisions it made into the project's documents.

## Planning

New or large work goes `/grill-with-docs` → `/to-spec` → `/to-tickets`: talk the idea through, write it up as a spec, slice it into tickets. Those three skills come from Matt Pocock's skills, not from this plugin.

- `/binnacle:autopilot` — once an epic is sliced into tickets, finish it: one agent per ticket, stopping at any question only you can answer.
- `/binnacle:help` — this guide.

## The usual order of a day

`/binnacle:product`, the work, `/binnacle:checkpoint`. Start with `/binnacle:product` to see where things stand, do the work — one ticket per session, on its own branch — and end with `/binnacle:checkpoint` so the next session starts from what this one decided.
