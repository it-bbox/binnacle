# 05: The Next action and the Suggested step

Status: READY
Triage: ready-for-agent
Blocked by: 02, 04
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** the main screen answers what to type next. It shows the roadmap's Next action with its command, and beside it Binnacle's Suggested step, labelled as Binnacle's calculation. A focus that ends without a command, or names finished work, is an attention item, and `/binnacle:product` ends with both. Decided in the spec, under *The Next action* and *The Suggested step*, and in ADR-0032.

- [ ] The roadmap parser reads the Next action from the focus's last paragraph, when that paragraph starts with `Next action:` and ends with an inline code span. The code span is the command, and the text before it is the description.
- [ ] `next_action.missing` is raised when there is no focus, or when its last paragraph is not shaped that way.
- [ ] `next_action.stale` is raised when the command names a `DONE` or `CANCELLED` Task, by ticket path, id, issue URL or `#number`.
- [ ] `packages/core` gives the Suggested step by the spec's eight rules, in order, with provenance `calculated`.
- [ ] A Product session's active run never triggers the first rule.
- [ ] Under any other `workflow.provider`, the Suggested step gives no command.
- [ ] The snapshot gains `next`: the Next action or `null`, and the Suggested step.
- [ ] The Overview shows each project's Next action with its command and a copy button. Beside it is the Suggested step, labelled as Binnacle's calculation, with its command and a copy button when it has one.
- [ ] The `product` skill ends with the Next action and its command, then the Suggested step, labelled.
- [ ] Tests through the daemon seam cover the parser's cases, both attention items, and each rule on a fixture where exactly that rule applies.
