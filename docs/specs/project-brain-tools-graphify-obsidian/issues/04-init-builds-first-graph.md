# 04: `binn init` ignores the graph and builds the first one

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** a project that leaves `binn init` with a graph. In the one plan, after the installs: an append to `.gitignore` for Graphify's output directory, unless Git already ignores it, then the first graph build with Graphify's code-only extraction, which needs no API key and calls no model (ADR-0012). The build runs only when Graphify is installed or was just installed by the plan, and the capability is not `false`. A failed build is reported in the Summary with Graphify's reason, and the daemon builds it later (ticket 05).

- [ ] Without the output directory ignored, the plan appends it to `.gitignore`, under ADR-0026's append rule.
- [ ] With it already ignored, `.gitignore` is not touched.
- [ ] After a yes, the fake `graphify` is called with the code-only extraction in the repository root, after the installs.
- [ ] A failing fake is reported in the Summary with its reason, and the rest of the plan has run.
- [ ] Graphify declared `false`, or left out for a missing `uv`, means no `.gitignore` line and no build.
- [ ] `docs/operations/03-external-tools.md` says init builds the first graph, code-only.

## Comments
