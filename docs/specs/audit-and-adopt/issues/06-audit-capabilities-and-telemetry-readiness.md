# 06: The audit reads Serena, Graphify and Context7, and telemetry readiness

Status: READY
Triage: ready-for-agent
Blocked by: 03
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** the last two areas of `binn audit`. Serena, Graphify and Context7: whether each looks configured, from configuration files only, in the repository (`.binnacle/project.yaml`'s `capabilities`, which is the repository's own declaration, `.mcp.json`, `.codex/config.toml`, `.serena/` and the like) and in the user-scope files only where a harness defines one. Nothing found is `unknown`, not `gap`, since the tool may be configured in user settings, and the finding names the files it looked in. Telemetry readiness: whether the session artifacts Binnacle reads, Claude Code's and Codex's, exist on this machine for this repository, by counting sessions without reading their content. A machine with none is `unknown` or an `ok` that says no work has been recorded yet, never a `gap`.

- [ ] A fixture with a tool's configuration file gets `ok` for it, and one without any gets `unknown`, naming the files looked in.
- [ ] A declared capability in `.binnacle/project.yaml` is taken as the declaration and not re-derived.
- [ ] Session artifacts are counted for the repository with no content read, and none found is not a `gap`.
- [ ] A test points the harnesses' artifact roots at an empty directory, as the init tests do, so that this machine's own sessions are never shown.
