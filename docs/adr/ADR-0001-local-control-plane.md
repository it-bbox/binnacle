# ADR-0001: Local Control Plane, Not Autonomous Orchestrator

**Status:** Accepted

## Context

The goal is to improve context continuity, visibility and cost control without recreating opaque multi-agent orchestration where the user loses track of what agents are doing.

## Decision

Build a local Control Plane. V1 is manual-first. It may recommend roles/actions but cannot autonomously spawn full AgentRuns, merge or deploy.

## Consequences

- user remains in control;
- execution is inspectable;
- less hidden token fan-out;
- some actions require explicit approval and are therefore less "magical".
