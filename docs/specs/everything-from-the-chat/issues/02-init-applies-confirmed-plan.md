# 02: binn init writes a confirmed plan by its identifier

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** `binn init --apply <id> [--window <days|all>] [path]`, the non-interactive form ADR-0037 calls for. It works the plan out again with the same window. If the plan's identifier is `<id>`, it writes the plan without a terminal, exactly as a confirmed interactive run does, then runs the tracker check and prints the Summary. If the identifier differs, it exits 3 with `init.plan_changed` on stderr and writes nothing. ADR-0026's run-time guards are unchanged.

- [x] `--apply` with the `id` from `--plan --json` writes the plan with stdin not a terminal and prints the Summary.
- [x] `--apply` after a file in the plan was created or changed exits 3 with `init.plan_changed` and writes nothing.
- [x] `--apply` with a made-up identifier, or with a different `--window` than the plan's, writes nothing.
- [x] Plain `binn init` with stdin not a terminal still writes nothing (the ADR-0034 test, kept as is).
- [x] The CLI help names `--apply`. ADR-0037's consequence is noted where `docs/03-mcp-and-skills.md` or the operations docs describe how init confirms.

## Comments

### For the next tickets

- **The call.** `binn init --apply <id> [--window <days|all>] [path]` must be given the `--window` and the path the plan was shown with: without `--window` it takes the default, as `--plan` does, and another window is another plan. It asks nothing and does not show the plan again.
- **On success** it exits 0 and prints what an interactive run prints after a yes: what init says outside the plan, the tracker check, and the Summary.
- **On a different plan** it exits 3, prints `binn: init.plan_changed: …` on stderr and nothing about the plan on stdout, and writes and runs nothing but the read-only `claude plugin list --json`. Ticket 03's skill runs `--plan --json` again to show the new plan.
- **An empty plan** applies as "There is nothing to write.", then the tracker check and the Summary, as at a terminal.
- **Usage.** `--apply` with `--plan` or `--json`, or with an empty id, is a usage error, exit 2.

### Decided while implementing

- **"After a file in the plan was … changed."** The id is the hash the spec defines, of the root and each item's heading and body, so a change is refused when it changes what the plan shows: an item that appears, leaves or reads differently. The test's changed file is the issue tracker file gaining its Ticket header section, which takes that item out of the plan. A change to a file that leaves every item as shown, such as an edit in the middle of a file the plan appends to, gives the same id, and the human's yes still covers exactly what is written. ADR-0026's run-time guards are unchanged and apply within the `--apply` run. The Spec review agreed this is within the spec ("the plan's identifier as a hash of what is shown, so that no state is kept between the two calls").

### Review

Code review against `main` on two axes, Standards and Spec. No hard violations, and no missing requirement.

- Fixed: "There is nothing to write." was checked in both `confirmPlan` and `applyPlan`. It is now said once in `init`, after the id check and before either form confirms or applies.
- Fixed: the forms that ask nothing were rebuilt from `planOnly` and `apply` in three conditions. One `asks` names them.
- Fixed: `initOptions`'s usage check packed five clauses into one line. It reads as two.
- Fixed: the reach of the id, the same plan shown giving the same id, is noted beside the check.
- Kept: `--apply` with `--plan`, or with an empty id, as a usage error with its own test. It follows ticket 01's usage rules.
- Left: `{ plan, apply, window }` is written out in `bin.ts` and again in `init`'s options. It predates this ticket, which adds one field, and exporting a type for one caller adds surface.
- Left: the run's three forms are two fields, not one mode type. `asks` covers the places that needed it, and a union would be more than this needs.
