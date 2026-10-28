# 07: A trap as a checkpoint target

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`
Roles: Developer, Reviewer

**What to build:** `/binnacle:checkpoint` can promote a trap, a non-obvious fact that already cost time, such as a command that must run before another or a version pin (spec, *A trap as a checkpoint target*; product inbox, *Session start, agent configuration and traps*, idea 3). The promotion types gain `trap`; its target is the project's instruction file at the repository root, `AGENTS.md` when it exists, else `CLAUDE.md`, else none, by the rule `instructionSets` applies, so a `CLAUDE.md` that imports `AGENTS.md` names `AGENTS.md`. `checkpoint.record` accepts it. The skill writes a trap as one line, on the owner's yes like every promotion, and shows one with no target as having no place here.

- [ ] Through `checkpoint.prepare`: the `trap` target is `AGENTS.md` with `AGENTS.md` alone or imported by `CLAUDE.md`, `CLAUDE.md` alone, and null with neither.
- [ ] Through `checkpoint.record`: `{ "type": "trap", "path": "AGENTS.md" }` is accepted.
- [ ] `/binnacle:checkpoint`'s text, the MCP tool's description of `promoted` and `docs/02-project-brain.md`'s promotion rule name the sixth kind; the copies match the plugin (`apps/cli/test/pack.test.ts`).
