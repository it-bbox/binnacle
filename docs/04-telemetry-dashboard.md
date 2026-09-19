# Telemetry and Dashboard

## Purpose

Measure AI-development behavior without pretending all providers expose identical data.

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

Dashboard should eventually surface warnings for long Product sessions using available signals such as token/context growth and compaction events.

Thresholds are configuration, not universal truths.

## Historical import

Where local session parsers/tools can import historical Claude/Codex usage, old records may be assigned to project-level `unassigned` when exact task attribution cannot be proven.
