# 06: Checkpoint prepare and record

Status: READY
Triage: ready-for-agent
Blocked by: 05
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

**What to build:** before a Product session closes, it asks Binnacle what changed since the last checkpoint and where each kind of durable decision belongs in this project, promotes what the human confirms with its own tools, and then records that the checkpoint happened. Binnacle computes and records; it writes nothing into the repository (ADR-0020). Decided in the spec, under *Checkpoint*.

- [ ] `checkpoint.prepare` returns the delta since the most recent `checkpoint` event, computed by the same code as the daily and with the same fallback.
- [ ] It returns the promotion targets — vocabulary, trade-off, new work, product rule, position — each with this project's path from the manifest's `knowledge` section and tracker.
- [ ] It returns the attention items, and records nothing.
- [ ] `checkpoint.record` takes the promoted items as `{ type, path }` pairs and records a `checkpoint` event carrying the caller's HEAD and those items.
- [ ] For each listed path with uncommitted changes, `checkpoint.record` returns a diagnostic.
- [ ] The next `checkpoint.prepare`, and the next `daily.get`, start from the recorded head.
- [ ] No file is written and no commit is made by Binnacle anywhere in this flow.
- [ ] `checkpoint_prepare` and `checkpoint_record` are exposed over MCP, mapped one-to-one.
- [ ] The `checkpoint` event is tier 2 and survives a schema rebuild.
- [ ] Tests through the daemon seam cover the targets and their paths, a record, a record with an uncommitted promoted path, and the next prepare starting from the recorded head.

## Comments
