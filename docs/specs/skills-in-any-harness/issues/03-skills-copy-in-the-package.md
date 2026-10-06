# 03: The package carries a binnacle-<action> copy of the skills

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** the package build, which already copies the `binnacle` plugin into the package with a version drawn from its files, also writes the copy the `skills` CLI installs into other harnesses (spec, *The skills copy*): one folder per plugin skill named `binnacle-<action>`, its `SKILL.md` with `name: binnacle-<action>`, every `/binnacle:<action>` in the text rewritten to `binnacle-<action>`, the plugin's version under `metadata`, and the Claude Code-only frontmatter fields `disable-model-invocation` and `argument-hint` dropped. The plugin stays the single source.

- [x] The package's tests check: one folder per plugin skill, folder and `name` matching, no `/binnacle:` left in any text, the plugin's version in every `metadata`, no Claude Code-only field.
- [x] The packed package contains the copy, as it contains the plugin.
- [x] `binnacle-help` in the copy lists the skills by their `binnacle-<action>` names.

## Comments

### Decisions

- **Where the copy lives**: `apps/cli/skills/`, beside `apps/cli/plugin/`, written by the same `prepare` script and ignored as the plugin is. `pnpm install` and `pnpm pack` run it, so the linked CLI and the tarball both carry it; ticket 04's `npx skills add` takes this directory.
- **How**: `prepareSkills(source, target, version)` in `apps/cli/src/prepare.ts` takes the version `preparePlugin` returns, so the copy's `metadata` and the plugin's manifest always carry the same one. It renames the frontmatter's `name`, drops the `disable-model-invocation` and `argument-hint` lines, appends `metadata:` with `version` quoted (a string, as Agent Skills' map wants, even for an all-digit hash), and rewrites every `/binnacle:<action>` in the file. It deletes the target first, so a skill removed from the plugin leaves the copy.
- **Tests**: `apps/cli/test/pack.test.ts` builds the copy as a function and checks the folders, names, version, dropped fields, no `/binnacle:`, a body otherwise unchanged and `binnacle-help`'s list; the packing test checks the tarball's `skills/` file by file against a fresh build.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings:

1. **A `SKILL.md` without a closing `---`** made `indexOf` return -1 and the copy came out half-renamed, with no error. **Fixed**: the build throws, naming the file, and a test holds it.
2. **A `metadata:` already in a source frontmatter** would give a duplicate key. **Kept**: no skill has one, and none is planned.
3. **No directory filter** over the plugin's `skills/`: a stray file would fail the build with `ENOENT`. **Kept**: the packing test already names the plugin's twelve skills exactly, and a failed build is the right answer to a stray file.
4. **The test repeats the rename's regular expression** to compare bodies. **Kept**: the name, version, dropped fields, `/binnacle:` and `binnacle-help` checks are independent of it; the body check only says nothing else moved.
5. **`filesUnder` repeats the listing in `preparePlugin`**. **Kept**: a test helper, three lines.

**Spec: every criterion implemented, no scope creep.** Findings:

1. **`help`'s description says "which /binnacle skill to use when"**, which the `/binnacle:<action>` rewrite does not touch, so the copy keeps a Claude Code-only phrase. **Left** to ticket 01, which rewrites the skills' text in the plugin (and runs in parallel); the copy picks the new text up on the next build.
2. **A multi-line `argument-hint` would leave a tail.** **Kept**: every value is one line, as in the plugin's other fields.
3. **The copy's shape suits tickets 04 and 06**: one `binnacle-<action>/SKILL.md` per skill under one directory, and the same version as the plugin.
