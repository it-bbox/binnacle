# Product inbox

Ideas the owner wants a Product session to weigh. None is decided: each goes to `/grill-with-docs` before it becomes a spec, a ticket, a *Later* item in `docs/roadmap.md` or a rejection, and is removed from here when it does (`docs/workflow/01-product-workflow.md`).

## Traced requirements, blind acceptance and cheaper runs (2026-10-09)

**Planned on 2026-10-22:** ideas 1 and 2, and items 4 and 6 below, into epic 26; items 1, 2, 3, 5 and 8 into epic 25; item 7 into epic 22.

Two ideas could close a gap here, where a spec's link to its brief and its tickets is prose:

1. **Requirements traced end to end.** The brief is split into numbered requirements, recorded word for word. Every requirement has a section of the spec and a task, every task a requirement, which catches work nobody asked for, and only the owner can drop a requirement. Here a story of a spec could carry a number that its tickets and their criteria name, and the snapshot or `binn audit` could report a story with no ticket and a ticket with no story.
2. **Blind acceptance.** At the end, a separate agent checks the result against the owner's original words only, without the spec, so that what was lost on the way from brief to spec to tickets shows. Here an epic's exit demonstration could start from such a check against the grilling's record.

### More, 2026-10-22

Both ideas above have a detail worth keeping: commits carry a `Requirements: R02` trailer, so `git log --grep="R02"` finds every change a requirement caused, and the blind acceptance runs from a clean clone, which catches an unrecorded dependency or a step only this machine knows. What else could apply here, the cost levers first:

1. **A model per ticket.** A ticket says `Model: strong` or `ordinary`, and an ordinary one runs on a cheaper model. In the week to 2026-10-22, 1795 of Binnacle's 1797 usage records were `claude-opus-5-5`. A `Model:` line that `/binnacle:autopilot` passes to the agent it starts may be the largest saving available; usage by Task shows it. In Claude Code, an agent definition in the `binnacle` plugin can name its own model, and the harness can set one model for every sub-agent: two ways to put a review or an exploration on a cheaper model without touching the developer's.
2. **Review where it pays.** A point review could run only for the foundation ticket and tickets whose own code is sign-in, keys, money or deleting data, after the commit and without holding the next tickets, with one review of the whole branch at the end. Here every ticket is reviewed before `DONE`; in the same week review and rework took about 26% of cached input, rework (47M) more than review (37M). Measure per epic before changing anything.
3. **Ticket size by volume.** About 3,000 changed lines per agent, at most 12 tickets per run: every ticket is a cold start of 60–100K tokens or more, and a fine cut buys spend, not safety. Binnacle has 220 tickets over 19 epics, each a fresh session; usage by Task can show what a cold start costs here.
4. **A short return contract with a red proof.** An agent reports in at most 25 lines: status, files, tests, interfaces, concerns, and `REDPROOF`, how each new test failed before the code, which shows it could fail at all. It fits `/binnacle:task run`'s report.
5. **A list of excuses and red flags**, read on a failed gate and before the report: "the agent could not, I will finish it myself" and the like, each with why it fails.
6. **A depth checklist for a spec.** First run, empty, wrong input, failure, interruption, growth, permissions, aftermath. Material for *Binnacle's own planning skills* below.
7. **"Waiting for you" as a state.** The dashboard's header could change colour while a run waits for the owner, with working time excluding the wait. Binnacle has `pendingDecisions`; the dashboard and the mod below could show it this way.
8. **Autopilot reads no full diff.** An orchestrator that sees only `--stat` keeps its context small, since a diff read on one ticket stays in its context for the rest of the run. `/binnacle:autopilot`'s step 9 reads `git diff main...<branch>`; scope and dependencies could be checked from `--name-only` and the lockfile alone.

Not to take: rounds of questions (the owner grills one question at a time), parallel agents in one working tree (a worktree each is safer), and a run the owner never watches (ADR-0022).

## A Binnacle mod for Claude Code (2026-10-11)

**Planned as epic 22 on 2026-10-22.**

**Decided by the owner on 2026-10-11: after the release**, in the roadmap's *Later*; kept here for its grilling.

Claude Code's mods (plugins of function hooks, 2.1.295) can draw a pane, a band above the prompt, the status line and toasts, add slash commands, and call the `binnacle` MCP server's tools themselves. The owner wants an optional Binnacle mod, off by default and switched on and off by the user, **after the release**:

- the status line per chat: the session's Task and role, its tokens and context, and the usage limits' windows where the harness passes them to the status line;
- a *Waiting for you* band, shown only when there is something: unanswered questions, `main`'s CI failing, a stale Next action;
- a pane with a compact snapshot and buttons that put a command (`/binnacle:answer`, `/binnacle:autopilot`, `/binnacle:checkpoint`) in the prompt for the human to send;
- toasts on a change: CI failed, a question answered, context pressure.

Read-only and silent without the daemon; Claude Code only, beside the skills (ADR-0039); likely inside the `binnacle` plugin (ADR-0023, ADR-0027). A new surface, so an ADR first.

## Binnacle's own planning skills (2026-10-11)

**Planned as epic 26 on 2026-10-22.**

Planning runs on Matt Pocock Skills today: `/grill-with-docs`, `/to-spec` and `/to-tickets`, which `binn init` installs and the workflow depends on (ADR-0035). They are good and maintained, but the owner hears from developers that not all of them like these skills. After the release, Binnacle could ship its own skills for the same chain, written for its formats: grilling against the Project Brain, a spec, tickets with `Roles:`, dependencies and criteria, and whatever else planning needs. Not now: Matt Pocock Skills stay for v1. The owner, 2026-10-12, grilling epic 19: Binnacle should not ask its users to run someone else's skills for its own work. The ticket command comes first, `/binnacle:task run` in epic 19; planning follows after the release.

The course "Один как команда" already tells participants that planning uses Matt Pocock Skills for now and that Binnacle's own skills will come later, without a date. Its prompts and templates do not depend on either, so the switch would not break it.

## A smarter conflict risk (2026-10-12)

**Planned into epic 26 on 2026-10-22**, where `/to-tickets` is replaced.

The conflict risk beside the parallel limit reads a ready Task's modules only from the file names its ticket writes (`conflictRisk`, `packages/core/src/impact.ts`). Epic 19's tickets name commands and behaviour, not files, so every pair came out `unknown` and autopilot ran them one after the other. A new project gets the opposite: with no graph `impact` is unavailable, the number alone decides, and every ready ticket runs side by side whatever it touches. Neither is right.

Ways to weigh:

- `/to-tickets` writes the modules a ticket expects to touch;
- a ticket's commands and terms are matched to modules through the graph's labels, not only file names (`binn audit` → `apps/cli/src/audit.ts`);
- before the run, an agent estimates the touched modules, as a calculated reading;
- without a graph, a cautious fallback instead of a full parallel run;
- while tickets run, the files each agent's worktree has already changed: two working sets that start to overlap are a risk the graph could not see before the start.

## Stricter autopilot and review (2026-10-15)

**Planned on 2026-10-22:** ideas 1, 7 and 8 into epic 26; ideas 2, 3, 6, 9 and 12 into epic 25.

**Planned on 2026-10-28:** idea 5 into epic 26. Ideas 4, 10 and 11 wait here.

Ideas to weigh, most useful first:

1. **A tests-first run before the developer.** A separate agent writes the ticket's acceptance tests from the ticket alone and proves they fail for the expected reason, a recorded expected-red, before any production code exists; the developer's run then makes them pass. Today tests-first lives inside the developer's own session, which can bend a test to fit its code.
2. **Hard stops for autopilot.** Binnacle shows runs per Task and the rework share but stops nothing. Past a threshold of rework runs, a ticket could stop under *Waiting for the owner* with its reason instead of another correction run; review iterations could have a cap, and every CI job one retry budget across runs.
3. **Classes of a red CI.** An infrastructure failure (runner lost, registry or network) is retried within the budget; a failed test is never retried, since a green rerun on the same commit is flaky evidence, not a pass; an unknown cause is treated as the change's. Binnacle reads a Task's CI; what autopilot does on red is not written down.
4. **A complexity gate in review.** A complexity reading of the touched code is recorded before development, and review checks it did not grow. A calculated reading that sits well beside Ponytail.
5. **Tests on the instructions themselves.** Checks over Binnacle's own skills and instruction files: a length budget for each skill description and for all of them together, a size limit for a router entrypoint, every reference file named with the condition that loads it, no procedure copied into two places. They would catch drift and duplication without a reviewer. Beside these static checks, a skill's behaviour can be pinned by recorded scenarios replayed against it, each step labelled with what the skill must do, so that a regression such as a Russian report's wrong agreement fails a test.
6. **Machine-readable markers.** `### Question` and `### Answer` are already parsed. A parsable first line for a Review's verdict, a stop and a rework, such as `REVIEW:<task>:<run>:<iteration>:<verdict>`, would make first-pass review acceptance and stop reasons exact, counted without a model.
7. **Delivery signals at slicing.** `/to-tickets` could ask whether a ticket changes a schema, stored data, an API or consumer contract, or background processing; such a ticket carries a rollout step.
8. **A check belongs to a role that can perform it.** Each check in a ticket names the role that performs it, and grilling asks whether that role can: a "before" screenshot can only be taken where the old version still runs, test accounts on a stage only by whoever administers it. A check handed to a role that cannot do it stalls the ticket.
9. **Do not rerun what is stale.** Autopilot already rebases a branch before merging. The same rule could cover any rerun: an artifact older than a threshold, or a branch behind `main`, is rebuilt first, and a failure of an old artifact is not reported as an unavailable environment.
10. **An external cause re-checks itself.** An item under *Waiting for the owner* with an external cause carries a checkable condition (the stage answers, `main`'s CI is green) that the daemon reads, and clears itself when it holds.
11. **Autonomy counts people, not only stops.** A Task finished without a stop can still have needed a person at several steps. An autonomy reading would count human interventions per Task.
12. **Stop reasons from facts.** An agent's explanation of why it stopped is often not the root. Stop reasons should come from what Binnacle reads (CI, runs, markers), and the agent's text stays text.

Not to take: running without a human by default, which ADR-0022 rules out; and a fixed pipeline of roles for every Task, since roles are recommended per Task.

## Session start, agent configuration and traps (2026-10-23)

**Planned on 2026-10-28:** idea 1 into epic 22, idea 2 as epic 27.

Two ideas, each to be built Binnacle's way:

1. **Where the project stands, at a session's start.** A fresh session knows nothing until someone runs `/binnacle:product`. A `SessionStart` hook in the `binnacle` plugin could add two or three lines from the snapshot: the current epic, what waits for the owner, and the Next action with its command. Bounded in size, silent without the daemon, and off with one setting; progressive disclosure, not the whole snapshot. A candidate for epic 22.
2. **The agent's own configuration in `binn audit`.** The audit reads the project's code, secrets and supply chain, not what drives the agents: `.mcp.json` and each harness's MCP settings, hooks and the commands they run, permission modes that skip approval, and secrets or tokens written into `AGENTS.md`, `CLAUDE.md` or a skill. A new area, read-only as every audit check, which also reports when the harnesses of one project register different MCP servers. Not planned: epic 20 left it out (its spec's `## Risks`).

Not to take: a catalogue of hundreds of skills and agents, learned "instincts" injected into a session without the owner's yes, and a desktop dashboard beside the web one.

## Showcase and launch (2026-10-23)

**Planned as epic 24 on 2026-10-23**, after the mod (the owner).

Binnacle has 4 stars on 2026-10-23, and its repository has no description, no topics and no image in the README: a visitor from a post sees a wall of text. Projects of its kind grow through a storefront that shows the tool in seconds, launch posts close together (GitHub's trending list counts stars over a day or two), listings where people look for tools, and write-ups with real data. Binnacle's own usage data is the material others do not have: what 220 tickets cost and where the tokens went.

The epic is what the repository can carry: the description and topics, a demo and dashboard screenshots in the README, the Claude plugin marketplace, MCP directories, awesome lists, npm keywords, a write-up and a launch checklist. Posting on Reddit, Hacker News, X, Habr and Telegram is the owner's. A subreddit of its own waits until users ask questions; until then GitHub Discussions is the place for them.

## A first reader's path to installing (2026-10-24)

**Planned into epic 24 on 2026-10-24.**

A developer who studied Binnacle before installing it read the docs written for agents, found them long, and set about working out a way of his own to install it, in Docker, before trying the one command the README gives. He asked whether the daemon takes port 80 and whether a project's paths would break in a container. What it shows:

- **The human path is not obvious first.** One install command, `binn init`, then everything from the agent's skills, should be what a visitor sees before any reference page; the docs under `docs/` are for agents and need not be read. The storefront and the site of epic 24 are where this lands.
- **Say why not Docker.** The daemon reads the harnesses' session artifacts in the home directory and the projects' checkouts through Git and Graphify; `binn init` writes the harnesses' user-scope settings; and the harness itself starts `binn mcp` on the host, so Node is needed there anyway. A container would add mounts at identical paths and remove no requirement. One sentence in the README, in both languages, saves the next reader the detour.
- **The requirements up front**: Node 24 LTS, and the loopback port, `127.0.0.1:7717` by default, changed with `BINNACLE_PORT`.
- **To check**: whether autostart's service keeps a `BINNACLE_PORT` other than the default; the daemon and `binn mcp` already follow it through the runtime file.

## Left after epic 20's tickets (2026-10-25)

Found while epic 20's tickets ran, not planned yet:

- Dependabot's `typescript` rule holds the root's 7.x updates too, since one npm entry moves both manifests; 7.x patches are taken by hand until `vue-tsc` runs on 7.

## Binnacle in a dev container (2026-10-25)

**Planned as epic 23 on 2026-10-28.**

**A candidate for the next epic, or a ticket of its own** (2026-10-26): the developer below ran it in a container by patching the code, so the bind address is a real block, not a wish.

A developer who keeps every project's development, its harness included, in a container of its own, about 20 of them, and nothing on the host, asked how to run Binnacle that way. A single Binnacle container reaching the others cannot work in v1: the daemon reads the harness's session artifacts and the checkout from disk, the harness starts `binn mcp` as a local stdio process, and the daemon binds loopback only and refuses a `Host` other than the address it bound. So Binnacle goes inside each app container, beside the harness, which nothing describes yet. What it needs:

- **A guide**: Node 24 and `npm i -g @it-bbox/binnacle` in the image; `binn daemon start` at the container's start, since there is no service manager for autostart; `~/.binnacle` and the harness's home (`~/.claude`, `~/.claude.json`) on a volume, so that a rebuild keeps the registration and the MCP settings; `binn init` once per project. Perhaps a dev container feature that does all of it.
- **The dashboard from the host.** A published port does not reach a daemon bound to the container's loopback, and the `Host` check refuses a forwarded port with another number. Today it takes host networking with its own `BINNACLE_PORT` per container, or a forward that keeps the port number, such as an editor's dev container forwarding; neither is checked. A bind address and the allowed `Host` values set by the user, without weakening the token every dashboard call carries, would make it a published port. Binding `0.0.0.0` inside a container is the norm and safe, since the container's network is isolated: the exposure is decided where the port is published. So the guide publishes it on the host's loopback only, `127.0.0.1:7717:7717`: a bare `7717:7717` publishes it on every interface of the host, to the local network, and Docker writes its own iptables rules, which bypass `ufw`. Three things stay as they are: the token on every call but `/health` and telemetry; the `Host` and `Origin` checks, which stop DNS rebinding from a page in the browser, not a hostile Wi-Fi; and the OpenTelemetry endpoint, which takes no token because a harness's exporter cannot send one, and so must never reach a network.
- **What the developer found, 2026-10-25.** Host networking works for one container only: with several, it breaks the containers' routing. A reverse proxy on the host does not help, since the host's loopback is not the container's. In the end he patched the hard-coded `127.0.0.1` to `0.0.0.0` at install, which every package update undoes. A proxy inside the container, rewriting `Host` and `Origin` to `127.0.0.1:7717`, is untried. The smallest fix: a `BINNACLE_HOST` for the bind address and a list of allowed `Host` values, with a test, the token and the `Origin` check unchanged.
- **One view over many daemons.** Each container runs its own daemon and dashboard, so 20 projects are 20 dashboards. Whether a dashboard can list other daemons, read-only, is to weigh against principle 3 and ADR-0020.
- **The footprint**: one daemon read about 160 MB of memory with five projects, and its home about 59 MB, on the owner's machine; twenty running at once is a cost worth stating in the guide, measured, not assumed.
