# 12: Context pressure and its attention item

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** the Claude Code and Codex readers report compaction markers — Claude Code's compaction boundaries with their trigger, Codex's change of context-window identifier — beside their records, never content. Each session carries its context pressure: its latest call's context and its compactions, with provenance. The manifest gains `telemetry.context_pressure.tokens` (default 150 000). The snapshot raises `context.pressure` for an active Product run whose session crosses it or has compacted since the last recorded checkpoint, suggesting `/binnacle:checkpoint` (spec, *Context pressure*).

- [ ] Reader tests: the compaction markers of Claude Code and Codex.
- [ ] Daemon process tests: `context.pressure` raised by the threshold and by a compaction after the last checkpoint; not raised for a harness with no signal; the manifest's threshold read.
- [ ] The dashboard shows the attention item as any other.

## Comments
