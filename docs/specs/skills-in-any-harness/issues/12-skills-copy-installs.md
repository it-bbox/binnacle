# 12: The package's skills copy installs whole with the documented command

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** the reinstall of the package's `binnacle-<action>` copy after a merge (ticket 07) works as written, and installs every skill of the copy. On 2026-10-10 an autopilot run merged ticket 11 and then failed that reinstall; debugging it with the owner found two bugs.

- **The documented source is read as a GitHub repository.** `npx skills add apps/cli/skills -g -y` is taken by the `skills` CLI for the shorthand `owner/repo`: it tries to clone `https://github.com/apps/cli.git` and fails with "Authentication failed". `./apps/cli/skills` installs, as the owner verified. The command is written so in `docs/workflow/02-development-workflow.md`, *Per ticket* step 4, which autopilot follows after each merge of its own, and in `README.md` and `README.ru.md`. `binn init` is not affected: it passes the copy's absolute path (`planSkillSet` in `apps/cli/src/init.ts`).
- **`binnacle-status` is skipped on install.** `prepareSkills` copies each skill's frontmatter as it is, and `status`'s description holds `project_status tool: the project`. The `skills` CLI reads frontmatter as strict YAML, which rejects `: ` inside a plain scalar ("Nested mappings are not allowed in compact mappings"), so it skips that skill, and `binn audit` then reports the set as partly missing for good. The copy writes every description as a quoted scalar, so any description the plugin's skills hold, now or later, parses.

- [ ] `docs/workflow/02-development-workflow.md`, `README.md` and `README.ru.md` give the reinstall's source as `./apps/cli/skills`, and the package's wording test holds it.
- [ ] Every `SKILL.md` of the package's copy has frontmatter that parses as strict YAML, with each description the plugin's, word for word; a test holds it.

## Comments

- The owner asked for this fix directly in the chat on 2026-10-10, after the failed reinstall, so this ticket is written on its own branch by the session that implements it, not by a Product session.
- Ticket 07's *Decisions* still quote the old command. It is left as the history of a closed ticket: the rule it names lives in the development workflow, which this ticket corrects.

### Review

`mattpocock-skills:code-review` against `main` (765500e), both axes, its sub-agents in the foreground. Standards: no documented standard broken; five smells and three edge cases of the quoting. Spec: both criteria met, no scope creep; two findings, on descriptions no skill holds yet.

Standards:

1. `prepareSkills`'s replacer names its argument `text`, which shadows the whole `SKILL.md` text a few lines up. To fix: name it `value`.
2. The test renames `/binnacle:<action>` with the same `replaceAll` twice in a row. To fix: one local `renamed` in the test.
3. The test borrows the daemon's `yaml` through `createRequire`, so a CLI test depends on the daemon's dependencies. Kept: the brief forbade a new dependency, the daemon's parser is the strict reader the `skills` CLI is, and the comment says so.
4. A skill with no `description` would compare `undefined` with `undefined` and pass. To fix: assert the plugin's description is there first.
5. The new comment in `prepare.ts` is one long line. Kept: the file's other comments run as long.
6. A block description (`description: >` or `|`, or one on the following lines) would be written as `">"` with its text left dangling. To fix: the build fails on a description that is not on its own line, as it fails on a skill without frontmatter.
7. A partly quoted value such as `"Foo" bar` is left as it is. Kept: it is not YAML in the plugin either, and the strict parse in the test fails on it.
8. A trailing ` # comment` or trailing spaces would end up inside the quoted text, where plain YAML drops them. Kept: no description holds either, and Claude Code reads the plugin's text as it is.

Spec:

9. The same as 6: the ticket says any description "now or later" parses, and a block one would lose its text. To fix: as 6.
10. The test compares the parsed description with the plugin's raw line, so a block one would pass (`">"` reads as `>`) and a missing one too. To fix: 4 and 6 close both; a description quoted in the plugin would fail the test loudly rather than pass, so that comparison is kept.
