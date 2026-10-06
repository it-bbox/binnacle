# 03: The package carries a binnacle-<action> copy of the skills

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** the package build, which already copies the `binnacle` plugin into the package with a version drawn from its files, also writes the copy the `skills` CLI installs into other harnesses (spec, *The skills copy*): one folder per plugin skill named `binnacle-<action>`, its `SKILL.md` with `name: binnacle-<action>`, every `/binnacle:<action>` in the text rewritten to `binnacle-<action>`, the plugin's version under `metadata`, and the Claude Code-only frontmatter fields `disable-model-invocation` and `argument-hint` dropped. The plugin stays the single source.

- [ ] The package's tests check: one folder per plugin skill, folder and `name` matching, no `/binnacle:` left in any text, the plugin's version in every `metadata`, no Claude Code-only field.
- [ ] The packed package contains the copy, as it contains the plugin.
- [ ] `binnacle-help` in the copy lists the skills by their `binnacle-<action>` names.
