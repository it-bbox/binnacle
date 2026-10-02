# 01: `binn init` installs Graphify, Serena and ast-grep

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** the first part of the Standard setup that `binn init` installs: the three tools that are executables, Graphify and Serena through `uv tool install` and ast-grep through npm. Init gains one table of the Standard setup's tools, beside its harness table: how each is detected, its prerequisite, its install command. Later tickets add their rows and columns to it. Detection reuses the audit's capability reading, moved where both commands reach it, not copied. A missing tool's install commands go into the one plan (ADR-0034) and run after the one yes, each reported in the Summary. A tool already on PATH is reported and left alone. A tool the manifest declares `false` under `capabilities` is not proposed. Without `uv`, init names the command that installs it and leaves Serena and Graphify out of the plan; it never installs `uv` and never runs an installer script. A manifest that init creates declares `capabilities` for each tool it installs or finds. Take the exact install commands from each tool's current docs through Context7.

- [ ] A missing tool appears in the plan with its exact command and is installed after a yes, the fake installer on PATH recording the call.
- [ ] A tool already on PATH is reported as found, and nothing is installed for it.
- [ ] A tool declared `false` under `capabilities` is not proposed.
- [ ] Without `uv` on PATH, the plan leaves Serena and Graphify out, and the output names `uv`'s install command.
- [ ] ast-grep is detected by `ast-grep` only: an `sg` on PATH is not taken for it.
- [ ] One failed install is reported in the Summary, and the rest of the plan still runs.
- [ ] A declined plan, and a stdin that is not a terminal, install nothing.
- [ ] A manifest init creates declares the tools under `capabilities`.
- [ ] The audit's capability findings are unchanged by the shared detection.
- [ ] `docs/operations/03-external-tools.md` and `docs/operations/05-installation-checklist.md` say what init installs; README and `README.ru.md` where they describe init.

## Comments
