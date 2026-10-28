# 07: A trap as a checkpoint target

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`
Roles: Developer, Reviewer

**What to build:** `/binnacle:checkpoint` can promote a trap, a non-obvious fact that already cost time, such as a command that must run before another or a version pin (spec, *A trap as a checkpoint target*; product inbox, *Session start, agent configuration and traps*, idea 3). The promotion types gain `trap`; its target is the project's instruction file at the repository root, `AGENTS.md` when it exists, else `CLAUDE.md`, else none, by the rule `instructionSets` applies, so a `CLAUDE.md` that imports `AGENTS.md` names `AGENTS.md`. `checkpoint.record` accepts it. The skill writes a trap as one line, on the owner's yes like every promotion, and shows one with no target as having no place here.

- [x] Through `checkpoint.prepare`: the `trap` target is `AGENTS.md` with `AGENTS.md` alone or imported by `CLAUDE.md`, `CLAUDE.md` alone, and null with neither.
- [x] Through `checkpoint.record`: `{ "type": "trap", "path": "AGENTS.md" }` is accepted.
- [x] `/binnacle:checkpoint`'s text, the MCP tool's description of `promoted` and `docs/02-project-brain.md`'s promotion rule name the sixth kind; the copies match the plugin (`apps/cli/test/pack.test.ts`).

## Comments

- **For the next tickets:** `promotionTargets` in `apps/daemon/src/checkpoint.ts` takes the caller's checkout and names `AGENTS.md` when it exists there, else `CLAUDE.md`, else null, read from the working tree. The exit demonstration's checkpoint proposing a trap should see it under `targets` as `{ "type": "trap", "path": "AGENTS.md" }` on this repository.
- **Decision:** the target is read by existence, without calling `instructionSets`. For every case the spec names, the set rule gives the same file: `CLAUDE.md` importing `AGENTS.md` names `AGENTS.md`, `AGENTS.md` importing `CLAUDE.md` leads its set, and two unlinked files name `AGENTS.md` by "when it exists". `instructionFiles` lives in the CLI, which the daemon does not import.
- **Decision:** a trap with no target needs no wording of its own: step 3's paragraph on a null `path` already shows the decision and says it cannot be written here.

### Review

Reviewed against `main` in a sub-agent, on the project's standards and the ticket's spec. Every criterion holds; nothing blocks.

- `apps/daemon/src/checkpoint.ts`, `promotionTargets`'s doc comment said every harness reads `AGENTS.md`; Claude Code reads it only through an import. Fixed: it says so.
- `/binnacle:checkpoint`, step 1: with the daemon down, the list of places a decision belongs left out the instruction file. Fixed: it names `AGENTS.md` else `CLAUDE.md`, and `apps/cli/test/pack.test.ts` pins it.
- Both root files present without an import: a trap in `AGENTS.md` does not reach Claude Code. Kept: the spec's rule is "`AGENTS.md` when it exists"; `binn audit` already reports two unlinked files as a decision to make.
- `['AGENTS.md', 'CLAUDE.md']` also appears in `apps/cli/src/layout.ts`. Kept: two names, in two packages that do not depend on each other.
