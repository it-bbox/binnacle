# 02: binn init writes a confirmed plan by its identifier

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** `binn init --apply <id> [--window <days|all>] [path]`, the non-interactive form ADR-0037 calls for. It works the plan out again with the same window. If the plan's identifier is `<id>`, it writes the plan without a terminal, exactly as a confirmed interactive run does, then runs the tracker check and prints the Summary. If the identifier differs, it exits 3 with `init.plan_changed` on stderr and writes nothing. ADR-0026's run-time guards are unchanged.

- [ ] `--apply` with the `id` from `--plan --json` writes the plan with stdin not a terminal and prints the Summary.
- [ ] `--apply` after a file in the plan was created or changed exits 3 with `init.plan_changed` and writes nothing.
- [ ] `--apply` with a made-up identifier, or with a different `--window` than the plan's, writes nothing.
- [ ] Plain `binn init` with stdin not a terminal still writes nothing (the ADR-0034 test, kept as is).
- [ ] The CLI help names `--apply`. ADR-0037's consequence is noted where `docs/03-mcp-and-skills.md` or the operations docs describe how init confirms.

## Comments
