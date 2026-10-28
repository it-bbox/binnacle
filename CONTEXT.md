# Project Context

## Canonical terms

### Binnacle
The product name. A binnacle is the stand that holds a ship's compass in front of the helm: it does not steer and does not choose the course, it keeps the instruments readable for whoever does. The name is a standing constraint on scope — see `docs/adr/ADR-0009-product-name.md`. CLI: `binn`. Daemon: `binnd`. Packages: `@binnacle/*`.

### AI Engineering Control Plane
The product category. A local layer on top of an existing AI-development workflow. It does not replace coding agents, Git, the tracker or CI. It stores/projects project state, produces snapshots, collects telemetry and exposes MCP/UI/CLI interfaces.

This term replaced the earlier "AI Development Control Plane". Both named the same thing; "Engineering" is the canonical form and the one used in public positioning.

### Project Brain
The sum of a project's long-lived knowledge and current state: docs, ADRs, specs, tracker, Git/CI state and code intelligence. It is not one file and not one database.

### Standard setup
The Project Brain Binnacle sets up and uses by default (`docs/baseline.md`, ADR-0035): docs, ADRs and `CONTEXT.md`, a GitHub or GitLab tracker, Matt Pocock Skills, Ponytail, Serena, Graphify, Context7 and ast-grep, with Obsidian as the human view. `binn init` installs what is missing. Each part stays replaceable: Binnacle's core works without any of them, and a project lacking one is an incomplete Standard setup, not a broken one.

### Project registry
The list of repository paths registered with Binnacle on one machine. It is canonical — no source outside Binnacle records that this machine tracks a given path — so it is a file, not a table, and the `Project` table is a projection of it (`docs/adr/ADR-0019-registry-is-a-file.md`).

### Checkout
One working directory of a repository: the registered one, or a linked worktree of the same repository (`git worktree add`), which has its own branch, HEAD and dirty state and shares the repository's Git common directory. Git facts always describe the caller's checkout and say which one it is. A separate repository nested inside a project is not a checkout of it.

### Product Steward
A permanent logical role, but not a permanent chat. A new Product session must rebuild the current picture from a Product Snapshot.

### Product Snapshot
A compact projection of current project state for a fresh Product session: milestone, roadmap position, active tasks, blockers, pending decisions, recent durable decisions, Git/CI state and usage.

### Next action
The step the roadmap's current focus ends with, and the command the owner types to take it. The Product session writes it: it is the course, and Binnacle only reads it.

### Suggested step
Binnacle's own reading of what comes next, computed from the Tasks, their AgentRuns and the roadmap's epic statuses, and labelled as a calculation. It stands beside the Next action and never replaces it: the Next action comes first, and the Suggested step offers the other ways to go on as a list of up to three alternatives, each with its reason — wait for a Task being worked on, a second Task beside it, one Task by hand, the whole epic with autopilot — leaving out any whose command is the Next action's, so none when it agrees with the Next action. A Next action that is missing, or names work already done, is an attention item.

### Conflict risk
Binnacle's calculation, from the Graphify graph, of how likely two ready or in-flight Tasks are to collide if run together: high when they touch a module in common, medium when their modules are neighbours in the graph, low otherwise, and unknown when either touches no module of the graph — never guessed low. A module is a file of the graph. A Task on a branch touches what its branch changed; one without, what its ticket names. The Suggested step offers a second Task in parallel only at low risk, and autopilot starts two Tasks together only at low risk, running any other pair one after the other; Binnacle itself blocks nothing.

### Parallel limit
How many Tasks autopilot works on at once: a number, or *auto*, which runs side by side every Task whose pairs are all at low Conflict risk, up to four, and one at a time when the risk cannot be assessed. A property of the machine, 2 unless set; a project's manifest may set its own, which wins for that project (ADR-0041).

### Autostart
The user's own service manager starting the Binnacle daemon at login, and again when it stops, for one Binnacle home. With it on, starting and stopping the daemon go through the service manager; with it off, the daemon runs only while started by hand (ADR-0043).

### Current Epic
The epic the dashboard and the Suggested step treat as the one under way: the one furthest along, the first at the furthest status present in the order `in progress`, `tickets`, `spec`, `not started`, the roadmap's order deciding only between epics at the same status. A `done` epic is never current, so there is none when every epic is done. The snapshot names it as `roadmap.current`, and the board shows its Tasks unless another epic is picked.

### Vault projection
The daemon's one-way rendering of a project's Project Brain into the owner's Obsidian vault, under `Projects/<Project>/`, from the default branch as committed, with the last snapshot and daily served and Graphify's report beside it (ADR-0036). The vault is a per-machine setting, never committed. Every note it writes is marked as generated, with its source file and commit, and it writes, rewrites and deletes only notes so marked; a note the human wrote is never touched, and an edit to a generated note is overwritten, never synced back. It is derived: deleting it loses nothing.

### Person's language
The language a person reads Binnacle in: the conversation's in the chat, the system locale's in a terminal, the browser's or the chosen one on the dashboard. Text for a person is in it; text written into a repository is not (ADR-0045).

### Repository language
The language a project's documentation is written in, stated in its manifest. What Binnacle and its skills write into the repository is in it, whatever the person's language; the markers Binnacle parses stay English in every one (ADR-0045).

### Harness
The coding client a run happens inside: Claude Code, Codex, Gemini CLI and others. A harness is not a provider — the same harness can be pointed at different backends.

### Provider
The backend serving the model to a harness: Anthropic, OpenAI, Z.ai, Google, a local runtime. GLM is a provider, not a harness.

### Harness support level
How far Binnacle can see into a given harness, graded rather than binary:

1. **Context** — the harness can call an MCP server, or run `binn` in a shell (ADR-0039). This is the only requirement for a harness to count as supported, and it needs no adapter.
2. **Attribution** — a session artifact carries a working directory and a session identifier.
3. **Usage** — that artifact also carries token counts.
4. **Live** — the harness exposes a stream that can be observed while it runs.

### Session artifact
What a harness writes to local disk about a session. The primary source of telemetry, because it exists without configuration and covers work already done.

### Context pressure
The normalised signal for a session outgrowing its context: the context its latest call read (input, cached input and cache creation together), and the compactions seen in it — Claude Code's compaction boundaries with their trigger, Codex's change of context window — each with its provenance. Harnesses express this differently; the signal is normalised, the underlying values are never invented, and where a harness reveals neither it is absent. An active Product session over the threshold for its model, or compacted since the last checkpoint, raises an attention item suggesting a checkpoint.

### AgentRun
One concrete run of a coding agent in a given role, harness/provider/model/profile. A single Task may have several AgentRuns.

An AgentRun observed in a session artifact is one unbroken stretch of a session in one checkout on one branch: a session that switches branch becomes two AgentRuns, each attributed on its own. A subagent's session is an AgentRun of its own, linked to the run that started it. Its role comes from its branch and that branch's history, never from what the agent wrote — the default branch is Product work; a ticket's branch is implementation, except for a Review run or a Rework run; anything else is unknown. A run whose records cross the point where its role changes is split there, as at a change of branch. An observed AgentRun has no lifecycle state, because an artifact cannot tell a finished run from an abandoned one; whether it is active is read from its latest activity.

### Review run
An AgentRun in the reviewer's role: a subagent run on a Task's branch that starts after the branch's first commit changing anything but its ticket. A forge's review leaves no such run, so a Task reviewed on GitHub or GitLab has none. It is Binnacle's calculation.

### Rework run
Implementation work on a Task's branch after its first Review run ends; for a Task with no Review run, after the commit that first records its Review; on GitHub or GitLab, after the first review on the Task's pull or merge request that requested changes. It is what a review cost in fixes, and the rework share and first-pass review acceptance are read from it. It is Binnacle's calculation.

### Unassigned
Usage attributed to a Project but to no Task, because no branch mapping to a Task can be proven for it. It is a first-class outcome, never a guess.

### Vision
The project's purpose, audience and limits — what it is, for whom, and what it leaves out — in the owner's words, at `<knowledge.docs>/vision.md`. `/binnacle:roadmap` reads it, or asks for it and writes it on the owner's yes, and proposes the roadmap's epics from it. It is not a Spec, which describes one epic's intended behaviour.

### Spec
A durable document describing intended behaviour. It lives in Git, next to the code it describes.

### Ticket
A unit of work. It lives in the project's tracker, and references its Spec. A Spec is not a Ticket and a Ticket is not a Spec.

### Ticket header
The `Status:`, `Blocked by:` and `Spec:` lines at the top of a ticket, with an optional `Roles:` line, whether it is a Markdown file or the body of a GitHub or GitLab issue. It is where a Task's state, dependencies and spec are read from on every tracker. On a remote tracker, closing the issue outranks the `Status:` line (ADR-0024).

### Task
Binnacle's view of a Ticket: its identity, title, lifecycle state and dependencies. The Ticket is canonical; a Task has no existence of its own and is always re-read from the tracker. On the local Markdown tracker its identity is `<spec-slug>/<NN>`, because ticket numbers are unique only within one Spec.

### Task brief
What a session needs to start one Task: its fields, its dependencies with their titles and states, its spec's path, the ticket body without comments, its roles, its questions and answers, its pull or merge request with its CI state, and the branch name that maps to it. It is compact by construction; the comments and the spec are read separately, when needed.

### Epic brief
What an epic's grilling decided, in the owner's words: `docs/specs/<epic>/brief.md`, in five parts — the problem, the outcome wanted, who it concerns, the systems it touches, constraints and open questions — which `/to-spec` starts from. Not a Task brief, which is what a session needs to start one Task.

### BLOCKED
A Task state: work started and now waits on something. It is not the same as an Unmet dependency, and a snapshot reports the two separately.

### Unmet dependency
A Ticket this Task is declared to be blocked by, which is not yet done. A Task with one can be in any state, `READY` included.

### In progress
A Task in flight by its state (`ACTIVE`, `BLOCKED`, `READY_FOR_REVIEW`, `APPROVED` or `MERGE_READY`), or a `READY` Task with an AgentRun attributed to it. The second is Binnacle's reading of the runs: it is shown as such and never written back to the ticket. In the Product Snapshot a merge ends it: a run that started before the latest `git merge` of the Task's branch into the default branch, as this clone's reflog records it, no longer counts, and one that starts after it does. A branch squashed, merged on the forge, or merged by a commit of its own after a conflict leaves no such entry and keeps its runs. Usage keeps every run.

### Review
One review of a Task's work: its findings, and what was fixed or kept. It is recorded in the ticket, under a `### Review` heading.

### Question
A question about a Task that only the owner can answer, recorded in its ticket under a `### Question` heading in `## Comments`, or as an issue comment that starts with one. After its text it lists its options, each with its cost, the recommended one first; the asker writes them. It is unanswered until an Answer follows it. On the local tracker it is read from the Task's branch while that branch is unmerged, since the session that asks works there (ADR-0040).

### Answer
The owner's reply to a Question, one of its options or the owner's own words, recorded right after it under a `### Answer` heading, or as the next issue comment that starts with one. A human writes it, from the chat through `/binnacle:answer` or by hand; an agent never does.

### Waiting for the owner
What only the owner can move: the unanswered Questions, the Tasks waiting for an approval — `READY_FOR_REVIEW`, which the owner moves to `APPROVED` or back — and the `ready-for-human` Tasks ready to start. An approval is a status change the owner makes, never Binnacle.

### Roles
The roles a Task needs, from the `Roles:` line of its ticket header, written by `/to-tickets` or the owner: Developer, Reviewer, Architect, QA, Security, DevOps or Analyst. A ticket without the line needs a Developer and a Reviewer. Beside them Binnacle gives its suggested roles, each with its reason and labelled as its calculation; a suggestion never changes the line, and Binnacle starts no one.

### CI state
The outcome of the checks a forge reports for a commit, read from GitHub or GitLab with the read-only token: passing, failing, running, or none reported. Binnacle reads it for the default branch and for each open pull or merge request, and never runs CI itself.

### Audit
A read-only reading of a Git repository, run by `binn audit`, that says what is in place, what is missing and what cannot be told, and recommends the next step for each. It needs no registration, no daemon and no manifest; it writes nothing, uses no network and gives no overall score. Applying a recommendation is the human's, and `binn init` stays the only writer.

### Finding
One result of an audit: a check code, the area it belongs to, a status, the reason and, unless the status is `ok`, a recommendation. The status is `ok`; `gap`, a file or setting looked for and found absent or wrong; or `unknown`, an answer the files cannot give. The two are never mixed.

### Stranded document
A tracked Markdown or text file outside Binnacle's places whose name or directory says a plan, a spec, a decision, a TODO, notes, a backlog, a design, an RFC, a PRD or a roadmap, or an ADR directory other than `<knowledge.docs>/adr/`. Binnacle's places are the root's README, licence, changelog, contributing and security files, the instruction files, `CONTEXT.md`, and under `<knowledge.docs>` its `roadmap.md`, `vision.md`, `product-inbox.md`, `specs/`, `adr/` and `agents/`. The audit lists each as `unknown`, since where it belongs is judgement; `/binnacle:roadmap` proposes a place for it — a spec, an ADR, the context file, the product inbox, the roadmap, or stale — and moves nothing without the owner's yes.

### Migration plan
The audit's findings that are not `ok`, ordered into numbered steps: first what `binn init` closes, then the secrets, then the rest in the order of the areas. Each step names its findings and what to do. It is an order of advice, never a score and never a fix: every step is the human's to carry out.

### Checkpoint
An operation that persists only the new durable delta from the current session into canonical project sources. It is not a retelling of the whole chat. The calling session writes the delta after the human confirms it; Binnacle computes what to consider and records that the checkpoint happened, and writes nothing into the repository itself.

### Scratch workspace
The ephemeral working space of the current task/run. It is not long-term memory, it is not the tracker, and it never holds the only copy of anything durable.

### Manual-first
In v1 the system analyses and recommends actions, but does not start full AgentRuns, merges or releases without an explicit human decision. Binnacle also never invokes a model itself.

### Autopilot
A human-started skill that runs the remaining tickets of one already planned epic to the end: one agent per ticket, each branch verified before it is merged. Starting it is the explicit human decision for that epic's AgentRuns and merges. It stops at any question only the owner can answer, and never plans an epic or moves to the next one (ADR-0022).

## Russian words

Each term's Russian word, the one Binnacle uses for a Russian-speaking person in the chat, in `binn` and on the dashboard, and `@binnacle/core`'s wording of the daemon's messages (ADR-0045). Commands, paths, Task ids, branch names, model names, a file's own markers such as `Status: DONE`, and the names Binnacle, Graphify, Obsidian, Serena and the harnesses are never translated.

| Term | Russian |
|---|---|
| Task | задача |
| Epic | эпик |
| Current Epic | текущий эпик |
| Next action | следующий шаг |
| Suggested step | предложенный шаг |
| Product Snapshot | снимок проекта |
| Product session | продуктовая сессия |
| Product Steward | продуктовый агент |
| roadmap | роадмап |
| Spec | спецификация |
| Ticket | тикет |
| Epic brief | бриф эпика |
| Task brief | бриф задачи |
| Vision | видение |
| Backlog | бэклог |
| Ready | готова к старту |
| In progress | в работе |
| BLOCKED | заблокирована |
| Review | ревью |
| Done | готово |
| Unmet dependency | невыполненная зависимость |
| Question | вопрос |
| Answer | ответ |
| Waiting for the owner | ждёт владельца |
| Conflict risk | риск конфликта |
| Parallel limit | лимит параллельной работы |
| Checkout | рабочая копия |
| Harness | клиент агента |
| Provider | провайдер |
| AgentRun | запуск |
| Review run | запуск ревью |
| Rework run | доработка |
| Unassigned | без задачи |
| Roles | роли: разработчик, ревьюер, архитектор, тестировщик, безопасность, DevOps, аналитик |
| CI state | состояние CI |
| Audit | аудит |
| Finding | находка |
| Migration plan | план перехода |
| Stranded document | бесхозный документ |
| Checkpoint | чекпойнт |
| Autopilot | автопилот |
| Autostart | автозапуск |
| Vault projection | проекция в Obsidian |
| Context pressure | заполненность контекста |
| Session artifact | файл сессии |
| Harness support level | уровень поддержки |
| Project registry | реестр проектов |
| Project Brain | знания проекта |

The roadmap's statuses read не начат, спецификация, тикеты, в работе, готов. A Task's states read бэклог (`BACKLOG`), готова (`READY`), в работе (`ACTIVE`), заблокирована (`BLOCKED`), на ревью (`READY_FOR_REVIEW`), одобрена (`APPROVED`), готова к слиянию (`MERGE_READY`), слита (`MERGED`), готово (`DONE`), отменена (`CANCELLED`). CI reads проходит, падает, идёт, нет проверок; a finding reads в порядке, пробел, неизвестно. Git's words take their usual Russian, ветка and коммит; `worktree` stays.

## Current product boundary

Binnacle v1 = Project + Task + AgentRun + Review + Snapshots + Telemetry + Human approvals + Adapters.

Binnacle reads the tracker and never writes to it. Anything beyond that boundary is treated as an integration or a post-MVP capability.
