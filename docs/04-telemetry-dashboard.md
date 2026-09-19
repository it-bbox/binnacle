# Telemetry and Dashboard

## Purpose

Measure AI-development behavior without pretending all providers expose identical data.

## Primary source

Local session artifacts written by each harness are the primary telemetry source; OpenTelemetry is an optional addition where a harness supports it (ADR-0011). Artifacts exist without any configuration by the user and cover work already done, which is why they come first.

Aggregation semantics differ between harnesses and belong to the adapter contract: some report per-message deltas, others running totals. Adding them the same way double-counts.

## Canonical identity dimensions

Every known AgentRun should identify where possible:

- project;
- task;
- run;
- role;
- harness (`claude-code`, `codex`, `gemini-cli`, etc.);
- provider (`anthropic`, `openai`, `zai`, `google`, `local`, etc.);
- model;
- profile/account category;
- branch/worktree;
- start/end time.

A harness and provider are separate concepts. Example: Claude Code may be used with a non-Anthropic backend/profile.

## Usage fields

Nullable by design:

- input tokens;
- cached input/read tokens;
- cache creation tokens where provider reports them;
- output tokens;
- reasoning/thought tokens where available;
- provider-reported cost;
- tool calls;
- MCP calls;
- subagent activity;
- compaction events;
- duration.

Each metric should carry provenance where relevant:

- `measured`;
- `provider_reported`;
- `calculated`;
- `estimated`.

Do not invent unavailable fields.

## The dashboard is read-only in v1

It shows what is happening. Decisions are made in conversation with an agent, which is the product's whole thesis. Actions can be added later to a read-only design; removing them is harder.

## Main dashboard views for v1

### Overview

- active projects;
- current runs;
- attention items;
- usage today/week;
- provider/model distribution.

### Project

- tasks;
- runs;
- reviews;
- usage;
- active/blocking state.

### Task

- AgentRun timeline;
- implementation usage;
- review usage;
- correction/rework usage;
- questions/answers;
- branch/worktree.

## High-value derived metrics

Derived metrics must be labeled as Binnacle calculations.

- tokens per completed task;
- runs per task;
- rework share;
- first-pass review acceptance;
- context growth;
- usage before first edit (context acquisition proxy);
- usage by role/provider/model;
- weekly burn trend.

Never optimize a single metric in isolation. Token reduction that increases rework/regressions is not a win.

## Product session health

Harnesses signal context exhaustion in incompatible ways. Claude Code emits an explicit compaction boundary carrying an `auto` or `manual` trigger; Codex emits no such event and instead rotates a context-window identifier; a newer agent may expose nothing at all.

Binnacle normalises these into one signal, **context pressure**: cumulative input over the session plus explicit compaction markers where they exist, each carrying its provenance per ADR-0007. Where a harness reveals nothing, the signal is absent rather than guessed.

It surfaces as an attention item suggesting `/checkpoint`. Thresholds are configuration, not universal truths.

## Historical import

Session archives are large — hundreds of megabytes per harness is normal. `binn init` reports what it found and how far back it goes, then asks how much to import: a recent window, everything, or nothing. It never silently spends minutes parsing on first run.

Records whose task attribution cannot be proven are kept at project level as `unassigned` rather than guessed.
