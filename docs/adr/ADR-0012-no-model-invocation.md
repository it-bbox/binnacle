# ADR-0012: Binnacle Never Invokes a Model

**Status:** Accepted

## Context

Several operations look as if they want a model: proposing what belongs in `CONTEXT.md` at checkpoint time, summarising a delta, phrasing an attention item. Binnacle runs on other people's machines with other people's API keys.

## Decision

No Binnacle operation calls a language model. Operations return **facts** and **candidates**; prose is written by whichever agent session called the operation, and any write to a canonical source happens only after explicit human confirmation.

## Rationale

- A tool that spends the user's tokens invisibly is a tool the user cannot budget for, which contradicts the purpose of measuring spend in the first place.
- It keeps Binnacle out of provider/model/key management entirely, so `AGENTS.md` §3 holds: Binnacle is never a required runtime.
- Determinism: the same state produces the same snapshot, which makes snapshot quality measurable.

## Consequences

- `checkpoint.prepare` returns a computed delta plus typed promotion candidates, not a written summary.
- Snapshot truncation is deterministic: fixed sections with per-section item limits and a remainder count, never model-side compression.
- Binnacle ships no API keys, no provider SDKs and no prompt templates.
