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
