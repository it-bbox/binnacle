# Quick start

Binnacle is one local daemon and a set of agent skills. Install it, start it, then set the project up with `binn init`.

## Install

```bash
npm i -g @it-bbox/binnacle
binn daemon start
```

`binn daemon start` serves the dashboard at `http://127.0.0.1:7717` by default; another free port comes from `BINNACLE_PORT`. For a one-off run without installing, use `npx -p @it-bbox/binnacle binn`.

## A new project

1. `git init` — create the repository.
2. `binn init` — one plan of everything it sets up, confirmed once.
3. `/binnacle:roadmap` — the vision and the epics.
4. `/binnacle:product` — the first Product session.

Then each epic goes `/grill-with-docs` → `/to-spec` → `/to-tickets`, and each ticket `/binnacle:task run <ticket>`, in a session of its own. In a harness other than Claude Code, each `/binnacle:<action>` is `binnacle-<action>`: see [Working from another harness](operations/06-other-harnesses.md).

## An existing project

1. `binn audit` — read-only findings; it writes nothing.
2. `binn init` — the same one plan.
3. `/binnacle:roadmap` — epics proposed from the code, the history and the docs.
4. `/binnacle:product` — the first Product session.

Nothing is moved or rewritten without your yes.

## Where to go next

- [New project: every step](operations/01-new-project.md)
- [Existing project: every step](operations/02-existing-project-adopt.md)
- [The installation checklist](operations/05-installation-checklist.md)
- [Containers and the Claude Code mod](containers-and-mod.md)
