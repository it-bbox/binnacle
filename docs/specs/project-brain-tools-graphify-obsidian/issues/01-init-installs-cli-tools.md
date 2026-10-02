# 01: `binn init` installs Graphify, Serena and ast-grep

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the first part of the Standard setup that `binn init` installs: the three tools that are executables, Graphify and Serena through `uv tool install` and ast-grep through npm. Init gains one table of the Standard setup's tools, beside its harness table: how each is detected, its prerequisite, its install command. Later tickets add their rows and columns to it. Detection reuses the audit's capability reading, moved where both commands reach it, not copied. A missing tool's install commands go into the one plan (ADR-0034) and run after the one yes, each reported in the Summary. A tool already on PATH is reported and left alone. A tool the manifest declares `false` under `capabilities` is not proposed. Without `uv`, init names the command that installs it and leaves Serena and Graphify out of the plan; it never installs `uv` and never runs an installer script. A manifest that init creates declares `capabilities` for each tool it installs or finds. Take the exact install commands from each tool's current docs through Context7.

- [x] A missing tool appears in the plan with its exact command and is installed after a yes, the fake installer on PATH recording the call.
- [x] A tool already on PATH is reported as found, and nothing is installed for it.
- [x] A tool declared `false` under `capabilities` is not proposed.
- [x] Without `uv` on PATH, the plan leaves Serena and Graphify out, and the output names `uv`'s install command.
- [x] ast-grep is detected by `ast-grep` only: an `sg` on PATH is not taken for it.
- [x] One failed install is reported in the Summary, and the rest of the plan still runs.
- [x] A declined plan, and a stdin that is not a terminal, install nothing.
- [x] A manifest init creates declares the tools under `capabilities`.
- [x] The audit's capability findings are unchanged by the shared detection.
- [x] `docs/operations/03-external-tools.md` and `docs/operations/05-installation-checklist.md` say what init installs; README and `README.ru.md` where they describe init.

## Comments

### For the next tickets

- The tool table is `TOOLS` in `apps/cli/src/tools.ts`, with `declaredCapabilities` and `onPath`; the audit reads its Serena, Graphify and Context7 rows through `AUDITED` in `audit-tools.ts`, so a row added there gets no audit check until it is named. Context7 has a row with no `executable` or `install`: ticket 02 adds its registration column. The audit's MCP registration reading (`sources`, `registeredIn` in `audit-tools.ts`) is still there; ticket 02 moves it into `tools.ts` when init needs it.
- Graphify is installed as `uv tool install graphifyy`, as its current README says. Graphify's docs still mention a `graphifyy[mcp]` extra for its MCP server (`05-installation-checklist.md`); ticket 02 decides whether the install needs it.
- The tool step runs after the instructions step and before the plan, so the installs follow every other write in the plan. Ticket 04's `.gitignore` append and first build go after them, in the same step or a later one.
- Questions answered in the smallest way the spec allows: a capability declared `true` or `optional` but not on PATH is still proposed (only `false` replaces a tool, ADR-0035); a missing `npm` is a prerequisite like `uv`, named and its tool left out; `uv` is named with `pipx install uv`, `brew install uv` or `winget install --id=astral-sh.uv -e`, never with its installer script.

### Review

`/code-review` against `main`, both axes.

- **Fixed:** an install ran `npm` without a shell, so Windows, where it is `npm.cmd`, could not start it (Node refuses `.cmd` without a shell). Installs now run their command string through the shell; the strings are the table's own. The list of tools a new manifest declares was named `installed` though it includes the ones found: renamed `toDeclare`. Detection by PATH alone is marked with a `ponytail:` comment.
- **Kept:** a new manifest declares `true` for a tool whose install is in the plan, even if that install then fails, since the manifest is shown in the plan before anything runs; the failure is in the Summary. The audit's subset as a list of names (`AUDITED`) rather than a column, and the optional `executable`/`install` columns that Context7 lacks: ticket 02 fills them. Only the manifest reading is shared with the audit for now; the audit has no PATH check to share.
- **Left:** the existing `spawnSync('claude', …)` calls have the same Windows issue only if Claude Code ships as a `.cmd`; not this ticket's change. A failed install's Summary line gives the command and not the reason; the installer's own output is shown above it. No test drives a missing `npm` alone; every test without a fake `npm` covers it through the plan.
