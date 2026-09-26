# 03: What's next: the Next action and Binnacle's alternatives

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/dashboard-design-and-languages/spec.md`

**What to build:** the Overview opens on "What's next". The roadmap's Next action leads, and under "or" come Binnacle's alternatives, each with a title and a reason in the chosen language. An alternative that agrees with the Next action is left out. The Suggested step becomes a list of alternatives in the snapshot, and `/binnacle:product` offers the same choice. Decided in the spec, under *The Suggested step becomes alternatives*, and in ADR-0032.

- [ ] The Suggested step's pure function keeps its eight rules and their order, and returns up to three alternatives. Each has `kind` (`wait`, `parallel`, `resume`, `autopilot`, `byHand`, `blocked`, `close`, `plan` or `finished`), `tasks`, `command` or none, an English `description`, and provenance `calculated`.
- [ ] Rule 1 gives `wait`, followed by `parallel` when `tasks.parallel.free` is at least one and Ready to start is not empty. Rule 3 gives `autopilot` and `byHand`. The other rules give one alternative each.
- [ ] `parallel` and `byHand` carry the Task's start command when exactly one Task is ready. With several, they name them and carry no command.
- [ ] An alternative whose command equals the Next action's is left out. Without a Next action, none is left out.
- [ ] Under any `workflow.provider` but `matt-pocock`, no alternative has a command.
- [ ] The snapshot's `next.suggested` is replaced by `next.alternatives`, a list, or `available: false` with the tracker's reason.
- [ ] Tests through the daemon seam cover:
  - each rule;
  - `wait` with and without `parallel`;
  - one ready Task and several;
  - `autopilot` beside `byHand`;
  - the agreement filter, with and without a Next action;
  - another workflow;
  - at most three alternatives.
- [ ] The Overview's "What's next" block shows the Next action, labelled "From the roadmap", with its command and a copy button. A warning sits inside the block when `next_action.missing` or `next_action.stale` is raised.
- [ ] Under "or", labelled "Binnacle's calculation", each alternative has a title and a reason written by the page from `kind` and `tasks` in the current language, and its command with a copy button when it has one.
- [ ] With no alternatives left, only the Next action shows.
- [ ] The `product` skill ends with the Next action and its command, then each alternative, labelled as Binnacle's.
- [ ] `docs/03-mcp-and-skills.md` describes `next.alternatives`, and `CONTEXT.md`'s *Suggested step* agrees with it.
