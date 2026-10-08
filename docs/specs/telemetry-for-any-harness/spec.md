# Spec: Telemetry for any harness

Status: READY
Triage: ready-for-agent

Epic 10 of v1, as defined in `docs/05-mvp-plan.md` phase 10, ADR-0038, ADR-0014 and decision 15 (`docs/08-open-questions.md`). Exit criterion, restated while specifying: on the owner's machine, after one `binn init`, a session in each of Claude Code, Codex, Gemini CLI, opencode, Antigravity, ZCode and pi on one project appears in the snapshot and the dashboard with the support level each harness can reach; a session of a harness that exports OpenTelemetry shows as running before its artifact is written, and is counted once; a Task with a Review and fixes after it shows its implementation, review and rework usage apart; a long Product session raises the context-pressure attention item; and the usage page shows tokens per completed Task before and after Ponytail. The phase was grilled on 2026-10-02; the owner confirmed this spec's test seams and the source of Ponytail's date on 2026-10-07, recorded under *Further Notes*.

## Problem Statement

The owner works in one project from many harnesses in turn: Claude Code desktop, Codex CLI and desktop, ZCode (the GLM client), Antigravity, Gemini CLI, opencode and pi. Binnacle counts two of them. It reads Claude Code's and Codex's session artifacts, one reader each, and every other harness's work is invisible: no runs, no usage, no support level above 1. A reader per harness never catches up with that list; OpenTelemetry was meant for it and was deferred (ADR-0011, ADR-0038).

Even for the two it reads, Binnacle answers "not available" where the owner most wants an answer. A Task's usage is one number: the work that wrote it, the review that checked it and the fixes after the review are not told apart, so the rework a change cost cannot be seen. A run's context is not measured, so a Product session that has grown until its harness compacted it, or is about to, gives no warning, though `/binnacle:checkpoint` exists for exactly that moment. And the owner adopted Ponytail to spend fewer tokens per Task without knowing whether it did.

Runs show as running only once their artifact has a record, minutes after the work began, and level 4 of ADR-0014, Live, is reached by no harness.

## Solution

**OpenTelemetry in.** The daemon accepts OTLP over HTTP, JSON-encoded, at its local address. `binn init` configures the export in every detected harness that supports it — Claude Code, Codex and Gemini CLI — in the harness's own user-scope settings, pointed at the daemon, inside its one plan and its one confirmation. Any harness that exports OpenTelemetry is counted without an adapter of its own. An event becomes a usage record with the same fields as an artifact's, never its content; a harness that exports tokens reaches level 3 through it, and its running sessions are seen as they happen, which is level 4.

**Artifacts stay, and grow.** Session artifacts remain the source of history before the export was configured, of a session's checkout and branch, and of harnesses without OpenTelemetry. Binnacle adds readers for Gemini CLI, opencode, Antigravity, ZCode and pi. A call seen through both an artifact and OpenTelemetry is counted once.

**Which harness gives what**, as found while specifying (each ticket confirms it against a real install):

| Harness | OpenTelemetry | Session artifacts | Reachable level |
| --- | --- | --- | --- |
| Claude Code (CLI and desktop) | yes: `claude_code.api_request` events with token counts; enabled by `CLAUDE_CODE_ENABLE_TELEMETRY` and the `OTEL_*` variables in its settings' `env` | read today | 4 |
| Codex (CLI and desktop) | yes: `codex.sse_event` events with token counts; the `[otel]` table of its `config.toml`, `otlp-http`, protocol `json` | read today | 4 |
| Gemini CLI | yes: `gemini_cli.api_response` events with token counts; the `telemetry` block of its settings, protocol `http` | a new reader | 4 |
| opencode | no export documented | a new reader: its local message records carry token counts | 3 |
| Antigravity | no: it has no exporter, only hooks, and exposes no per-call tokens (a flat-rate quota) | a new reader: its conversations are encrypted, and its window state names each one's workspace (ticket 06) | 2: session and directory, no model or tokens |
| ZCode | not documented | a new reader: an opencode-like SQLite database whose `model_usage` table has per-call tokens (ticket 06) | 3 |
| pi | none built in: its extensions could add one, `binn init` installs none | a new reader: its session JSONL files, to be confirmed against an install | 3 if its records carry tokens |

**Review and rework usage.** A run on a Task's branch is in one of three roles beside `product` and `unknown`: `implementation`, `review` or `rework`. A review run is one in the reviewer's role: a subagent run on the Task's branch that starts after the last commit on that branch changing anything but its ticket, and ends by the commit that first records the ticket's Review. A rework run is implementation work on the Task's branch after its first Review, or, on GitHub or GitLab, after a review on the Task's pull or merge request requested changes. A run whose records cross such a point is split there, as a run is split where its branch changes. The Task, the snapshot's usage and the dashboard show the three apart, and the rework share and first-pass review acceptance of `docs/04-telemetry-dashboard.md` follow from them, all labelled as calculated.

**Context growth and pressure.** Each run carries its context growth: the context its first and its latest call read (input, cached input and cache creation together) and the largest, calculated. Each session carries the one normalised signal of decision 15, context pressure: its latest call's context and the compactions seen in it — Claude Code's compaction boundaries with their trigger, Codex's rotation of its context-window identifier — each with its provenance; where a harness reveals neither, the signal is absent rather than guessed. An active Product session whose pressure crosses the project's threshold, or that has compacted since the project's last checkpoint, raises the attention item `context.pressure`, which suggests `/binnacle:checkpoint`. The threshold is configuration.

**Ponytail's effect.** Binnacle takes the date of the first commit whose instruction files name Ponytail as the day it was enabled in the project, and shows tokens per completed Task for Tasks completed before and after it, labelled as calculated. With no such commit, or no completed Task on one side, the comparison says why it has none.

## User Stories

1. As the owner, I want Binnacle to count my sessions in every harness I use, so that a project's usage is not just Claude Code's and Codex's.
2. As the owner, I want `binn init` to configure the OpenTelemetry export in every detected harness that supports it, in the same plan and the same confirmation as the rest, so that I do not edit three settings files by hand.
3. As the owner, I want the export configured at user scope, so that the repository is not written for it.
4. As the owner, I want `binn init` to leave alone a harness whose export already points elsewhere, and say so, so that my own collector keeps working.
5. As the owner, I want `binn init`'s plan to show each harness's export change before it is made, so that I approve exactly what is written.
6. As the owner, I want a harness that cannot export OpenTelemetry named in `binn init`'s Summary with the reason, so that I know why it is counted from its files or not at all.
7. As the owner, I want the daemon to accept OpenTelemetry on its own address, so that nothing else has to run.
8. As the owner, I want a harness that exports to an absent daemon to keep working, so that Binnacle stays optional.
9. As the owner, I want only metadata and token counts kept from an event, never a prompt, a response or a tool's input, so that the privacy of artifacts holds for OpenTelemetry too.
10. As the owner, I want a call seen through both OpenTelemetry and its artifact counted once, so that turning the export on does not double my usage.
11. As the owner, I want a session's history from before the export was configured still read from its artifacts, so that turning the export on loses nothing.
12. As the owner, I want a running session of an exporting harness shown as running from its first call, so that I see what runs now, not minutes later.
13. As the owner, I want each harness's support level to rise to 4 once it exports, so that the dashboard says honestly what Binnacle sees.
14. As the owner, I want an event that names no project kept until its session's artifact or working directory names one, so that nothing is attributed by guess.
15. As a Gemini CLI user, I want my sessions read from Gemini CLI's files, so that my history before the export counts.
16. As an opencode user, I want my sessions read from opencode's files with their tokens, so that opencode reaches level 3 without OpenTelemetry.
17. As an Antigravity user, I want my sessions attributed to the project from Antigravity's files, so that my work there shows as runs, even without tokens.
18. As a ZCode user, I want ZCode's sessions read once its files are understood, so that my GLM work counts.
19. As the owner, I want a harness whose files Binnacle cannot read to say why in its support level, as Claude Code's and Codex's do, so that a gap is never a silent zero.
20. As the owner, I want every token count from a new harness to carry its provenance, so that a calculated difference is never shown as reported.
21. As the owner, I want a count a harness does not report shown as not reported, never zero, so that ADR-0007 holds for the new harnesses.
22. As the owner, I want provider and model kept apart for every harness, as ADR-0004 says, so that GLM through ZCode is a provider, not a harness.
23. As the owner, I want a Task's usage split into implementation, review and rework, so that I see what the review and the fixes after it cost.
24. As the owner, I want a review run recognised from the branch and the ticket's history, not from what the agent wrote, so that it works in every harness.
25. As the owner, I want a run that crosses the first Review split at it, so that one long session is not counted wholly as implementation or wholly as rework.
26. As a user of GitHub or GitLab issues, I want rework counted after a review that requested changes on the Task's pull or merge request, so that remote trackers get it too.
27. As the owner, I want the rework share and first-pass review acceptance on the usage page, labelled as Binnacle's calculation, so that I can tell whether cheaper Tasks cost more fixes.
28. As the owner, I want the snapshot's usage by role to list review and rework, so that a fresh session sees them without opening the dashboard.
29. As the owner, I want `task_get` and the dashboard's Task page to show review and rework usage instead of "not available", so that the Task's cost is whole.
30. As the owner, I want each run's context growth, so that I see which runs read the most.
31. As the owner, I want a session's context pressure, normalised across harnesses with its provenance, so that Claude Code's compactions and Codex's context rotations mean the same thing.
32. As the owner, I want an attention item when a Product session's context crosses the threshold or has compacted since the last checkpoint, so that I run `/binnacle:checkpoint` before the session forgets.
33. As the owner, I want the threshold in the manifest, so that I tune it to my models.
34. As the owner, I want no pressure shown for a harness that reveals nothing about its context, so that silence is not read as health.
35. As the owner, I want tokens per completed Task before and after Ponytail, labelled as calculated, so that I know whether Ponytail paid off.
36. As the owner, I want Ponytail's date taken from the first commit whose instruction files name it, so that I declare nothing.
37. As the owner, I want the comparison to say why it has none when a side is empty, so that an empty chart is explained.
38. As a dashboard user, I want the new metrics on the pages that already show usage, so that nothing moves.
39. As an agent in a fresh session, I want the snapshot to stay compact with the new fields, so that progressive disclosure holds.
40. As the owner, I want the documentation to list each harness's level and how it is reached, so that a new user knows what to expect.
41. As the owner, I want `binn audit`'s telemetry readiness to report whether each detected harness exports to Binnacle, so that the audit and `binn init` agree.
42. As the owner, I want the exit demonstration run on my machine with every harness I use, so that the epic ends on real data.
43. As a pi user, I want my sessions read from pi's files with their tokens, so that pi, which many developers now use, counts as the other harnesses do.

## Implementation Decisions

- **OTLP receiver.** The daemon's HTTP server accepts `POST /v1/logs` with OTLP JSON (`application/json`), the encoding every harness above can export over HTTP. `/v1/metrics` and `/v1/traces` are answered with success and not stored: logs carry the per-call events, and metrics would count the same calls again. A request in another encoding is refused with 415 and counted in the harness's support reason. The receiver binds where the daemon binds, local only.
- **Events to records.** A per-harness mapping, beside the artifact readers, turns one event into one `UsageRecord`: `claude_code.api_request`, `codex.sse_event` carrying token counts, `gemini_cli.api_response`. Session id, model, timestamp and token counts are taken; every other attribute — prompts, responses, tool input — is dropped before storing, whatever the harness was told to export. Each count keeps the provenance its harness gives it (`provider_reported`, or `calculated` where Binnacle derives it, as for Codex's input less cached input). A record's source, artifact or OpenTelemetry, is stored with it.
- **Harnesses.** The `Harness` union grows by `gemini-cli`, `opencode`, `antigravity`, `zcode` and `pi`; each has a name, an artifact root the daemon's runtime knows, and a support level computed as today, with level 4 when the harness's OpenTelemetry records have arrived within the active window.
- **Attribution.** An OpenTelemetry record takes its working directory from the event where the harness exports one, else from its session's artifact records. Until either names one, it is stored without a project and is in no project's usage; once its session is attributed, the daemon attributes it the same way. Its branch, as every record's, comes from its checkout's reflog (ADR-0030).
- **Counted once.** Within one session, an OpenTelemetry record and an artifact record are the same call when the harness's request or message id matches, where it exports one; otherwise when model and every token count match and their timestamps are within a few seconds. The artifact record is kept, the OpenTelemetry one dropped from totals; unmatched OpenTelemetry records count. This is decided per record, so a session read from both mid-way is never counted twice.
- **New artifact readers**, in the adapters package, each a pure function from bytes and a position to records, as `readClaudeCode` and `readCodex` are: Gemini CLI's session files, opencode's message records, Antigravity's and ZCode's local sessions, pi's session files. Each reads only metadata and counts, stops at a line or file it cannot read with the reason, and maps a count it does not have to null. Antigravity and ZCode first need their formats: a ticket for the owner records, on the owner's machine, where each keeps its sessions and a redacted sample of their fields, and the reader is built from that sample.
- **`binn init`'s telemetry step.** For each detected harness that exports OpenTelemetry, the plan shows the change to its user-scope settings — Claude Code's settings `env` (`CLAUDE_CODE_ENABLE_TELEMETRY`, `OTEL_LOGS_EXPORTER=otlp`, `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`, the endpoint), Codex's `[otel]` table, Gemini CLI's `telemetry` block — pointed at the daemon's address, with prompt logging left off. A harness already exporting elsewhere is left as it is and named. The step runs after the one confirmation, records each outcome in the Summary, and a harness without an export is named with its reason. `binn audit`'s telemetry readiness reads the same settings.
- **Roles.** `RunRole` becomes `product | implementation | review | rework | unknown`. The daemon reads, per Task with runs, the times of its branch's commits that change files other than its ticket and of the commit that first adds `### Review` under the ticket's `## Comments`; on GitHub or GitLab, the reviews on the pull or merge request whose head is the Task's branch, with the read-only token the tracker already uses. `observedRuns` takes these points and starts a new run where a record's role differs from the one before it. Every role is labelled as calculated.
- **Derived metrics.** `usage.get`'s `derived` gains, each labelled as calculated: `reworkShare` (rework tokens over the Task's implementation and rework tokens, per completed Task and their mean), `firstPassAcceptance` (the share of completed Tasks with a Review and no rework run), `contextGrowth` per run (first, latest and largest context of its calls), and `ponytail` (the date, its commit, and the mean tokens per completed Task before and after, or the reason there is none). A Task's usage gains its totals by role.
- **Context pressure.** Per session, the latest call's context and the compactions read from its artifact: Claude Code's compaction boundary records with their trigger, Codex's change of context-window identifier. The readers report these as markers beside their records, never content. The manifest gains `telemetry.context_pressure.tokens`, a threshold on the latest call's context, absent meaning a default of 150 000. The snapshot raises `context.pressure` for each active Product run whose session crosses it or has a compaction after the project's last recorded checkpoint, naming the session, its context and the marker, and suggesting `/binnacle:checkpoint`.
- **Ponytail's date.** The first commit on the default branch that adds the word Ponytail to the project's instruction files, read as one set as the audit reads them (`AGENTS.md`, `CLAUDE.md` and what they import). A Task is before or after it by the date of the commit that set it `DONE`.
- **Snapshot and dashboard.** The snapshot's usage keeps its shape and lists the new roles in `byRole`; the dashboard's Task page replaces its two "not available" lines with review and rework usage, the usage page shows the new derived metrics under its calculated heading, and each harness's level as today. Both languages of the dashboard get the new strings.
- **Documentation.** `docs/04-telemetry-dashboard.md` loses its "not available" lines for review and rework and describes the roles and context pressure; `docs/03-mcp-and-skills.md` and the README with `README.ru.md` list the harnesses and their levels; `CONTEXT.md` defines review run, rework run and context pressure if they are not already terms there.

## Testing Decisions

- A good test drives Binnacle from the outside and checks what a user sees — records stored, runs and their roles, totals, derived metrics, attention items, files `binn init` writes — never a function's internals.
- **The daemon as a process**, as `project.test.ts` and the MCP smoke test start one with a temporary home: OTLP JSON posted to its address, then `usage.get`, `task.get` and `project.snapshot` read back. Cases: each harness's event becomes a record; content attributes are not stored; a call posted and present in its artifact counts once; an event with no known directory is in no project until its session's artifact arrives; a running session shows as active from its event; a harness reaches level 4; another encoding is refused; review, rework and the split of a crossing run on a repository with a Task branch, a Review commit and a fix after it; `context.pressure` raised by a threshold and by a compaction after the last checkpoint, and not raised for a harness with no signal; Ponytail's before and after on a repository whose instruction files gain the word in one commit.
- **The artifact readers as functions** over sample files, as the existing Claude Code and Codex reader tests do: each new harness's records, nulls for counts it lacks, the reason for an unreadable line, and the compaction markers of Claude Code and Codex.
- **`binn init` as a process** with fake harness settings in a temporary home, as `init.test.ts` does: the export added to each supporting harness's user-scope settings after the one yes, an existing exporter left alone and named, a declined plan writing nothing, a harness without export named with its reason, and `--plan --json` carrying the same changes.
- Prior art: `apps/daemon/test` for the daemon process, `packages/adapters/test` for readers, `apps/cli/test/init.test.ts` and `audit.test.ts` for the CLI.

## Out of Scope

- Cost in money: still not available, as today.
- Metrics and traces from OpenTelemetry: logs carry the calls; the others are accepted and dropped.
- OTLP over gRPC and protobuf-encoded OTLP.
- Configuring the export at project scope, or for a harness Binnacle does not detect.
- Roles declared in tickets and Binnacle's role suggestions: epic 11 (`Roles:`).
- CI state and the pull or merge requests themselves in the snapshot: epic 11; this epic reads only the reviews it needs for rework.
- Advanced optimisation rules: still after real measurement (`docs/roadmap.md`, *Later*).

## Further Notes

- **Decisions taken while grilling, on 2026-10-02**, recorded in `docs/05-mvp-plan.md` phase 10 and ADR-0038: OpenTelemetry received by the daemon and configured by `binn init`; artifacts kept; counted once; review and rework usage; context growth and context pressure with its attention item; Ponytail's effect; all labelled as calculated.
- **Decisions taken by the owner on 2026-10-07, while specifying**: the test seams above — the daemon process, the readers as functions, `binn init` as a process — with nothing of phase 10 cut; Ponytail's date from the first commit whose instruction files name it.
- **Found while specifying**: Claude Code, Codex and Gemini CLI export OpenTelemetry logs with per-call token counts over HTTP in JSON; opencode documents no export; Antigravity has no exporter and exposes no per-call tokens; ZCode documents neither, so its formats are established on the owner's machine. Codex's and Claude Code's desktop apps read the same user-scope settings as their CLIs, to be confirmed in the exit demonstration.
- **Decisions taken by the owner on 2026-10-08**: pi joins the harnesses, since many developers now use it, with a reader of its own (ticket 16) and a session in the exit demonstration; the demonstrations run on the owner's machine, whatever its operating system, since every harness here has a Linux build.
- **Found and decided on 2026-10-08, recording ticket 06**: Gemini CLI no longer lets a personal Google account sign in (an API key from Google AI Studio still does), and Antigravity's model API answered every try with a quota error. The owner decided that both Google harnesses are built as specified and marked not verified: their readers and export are tested against samples and sources, and the exit demonstration reports them as not verified rather than holding the epic for them.
- **Defaults taken from the docs and Ponytail, not asked**: JSON over HTTP only, so no OpenTelemetry dependency; the artifact record kept over the OpenTelemetry one, for its checkout and branch; review and rework read from Git and the forge rather than from what an agent wrote; a context-pressure threshold of 150 000 tokens until the manifest says otherwise.
- **The exit demonstration**: on the owner's machine, `binn init` with one yes; one session in each of Claude Code, Codex, Gemini CLI, opencode, Antigravity, ZCode and pi on one repository; the snapshot and dashboard show each with its level, one running before its artifact is written, counted once afterwards; a Task taken through a Review and a fix shows implementation, review and rework apart; a long Product session raises `context.pressure`; the usage page shows Ponytail's before and after.
