# 09: /binnacle:audit runs the audit from the chat

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** the owner asked on 2026-10-02 that everything be done from the chat, without going back and forth to a terminal. A new skill in the `binnacle` plugin, `/binnacle:audit [path]`, runs `binn audit --json` on the path, the current repository by default, and presents its findings in the chat: grouped by area, the gaps first with their recommendations, then what is `unknown` and why, then a count of what is `ok`. It writes nothing and fixes nothing. Where a recommendation names `binn init`, it says so, and that running init is the human's. If `binn` is not on the harness's PATH, it says so and gives the README's setup section, as the other skills do. The skill works without the daemon, as the command does.

- [ ] `/binnacle:audit` with no argument audits the current repository; with a path, that path.
- [ ] The findings are shown grouped by area, gaps first with their recommendations, then `unknown` with its reason, then the number of `ok`.
- [ ] Nothing is written, and no recommendation is carried out.
- [ ] A missing `binn` and an audit that could not run (its non-zero exit) are each reported with their reason.
- [x] The skill ships in the plugin beside the others, and the plugin's packaging test covers it.
- [x] `docs/03-mcp-and-skills.md`, which says the audit is not a skill, and the README's skill list, mirrored in `README.ru.md`, name `/binnacle:audit`.

## Comments

### Decisions

- **The skill** is `.claude/skills/binnacle/skills/audit/SKILL.md`, beside the other five, with the same frontmatter (`disable-model-invocation: true`, `argument-hint: "[path]"`). It runs `binn audit --json` once, or `binn audit <path> --json`, and calls no MCP tool, so it works with the daemon stopped. A missing `binn` (`command not found`, exit 127) points to the README's *Install* and *From this repository* sections; any other non-zero exit is reported with its code and stderr. An `unknown` is shown with its recommendation too, since the spec gives every one a recommendation.
- **The packaging test** now names the plugin's six skills exactly, so a skill missing from the source, or one added without the test, fails it; the loop after it already checks that each file is packed unchanged.
- **The README has no list of skills.** The smallest place that names `/binnacle:audit` is *Existing project: the short path*, beside `binn audit`, mirrored in `README.ru.md`. `docs/03-mcp-and-skills.md` names it in its list of actions and among the namespaced commands, and no longer says the audit is not a skill. The plugin's description names it. ADR-0023's list of actions is left as written, as it was for `/binnacle:task`.
- **Checked against the command** (temporary `BINNACLE_HOME`): on this worktree the JSON is `{ root, findings }` with two gaps (`tracker.token`, `structure.ci`) and one unknown (`tracker.token_works`), each with a recommendation; on a directory that is not a Git repository the exit is 3, with a `binn: ... works on a Git repository` line on stderr.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.**

1. **The description ended "Writes nothing" where the siblings say "changes nothing"; the opening line repeated the closing rule.** **Fixed**: the description ends "changes nothing", and the opening line only says the skill needs no daemon.
2. **The skills doc repeated the skill's presentation order.** **Fixed**: one line of purpose, as the other actions have.
3. **The plugin's description read awkwardly.** **Fixed.**
4. **The packaging test hard-codes the list of skills (possible Shotgun Surgery).** **Kept**: the ticket asks the packaging test to cover the new skill, and a named list is what makes a dropped skill fail it.
5. **The skills appear in three different orders across plugin.json, the doc and the test.** **Left**: cosmetic.

**Spec: every criterion met in the text; the ticket was not yet `DONE`.**

1. **Not `DONE`.** **Fixed** by the last commit.
2. **"for most gaps and unknowns", against the spec's recommendation on every gap and unknown.** **Fixed.**
3. **The `ok` count "per area if it fits" left a judgement to the model.** **Fixed**: only the number.
4. **"Offer to explain a finding" and the pointer to *From this repository*.** **Kept**: small, and read-only.
5. **Exit 127 depends on the shell.** **Kept**: any other wrapping falls to the non-zero branch, which still gives a reason.

### Left for the owner

The first four criteria are the skill's behaviour in a chat, which an agent cannot start: the skill has `disable-model-invocation: true`. In a Claude Code session in the main checkout, after the branch is merged:

```text
/binnacle:audit                 # this repository: gaps by area with recommendations, then unknown with its reason, then the number of ok
/binnacle:audit ../some-repo    # that path; a recommendation naming binn init is said to be the human's
/binnacle:audit /tmp            # not a Git repository: exit 3 and its reason, nothing else
```

Then `git status` shows nothing written. For a missing `binn`, run `/binnacle:audit` in a session started with a PATH that has no `binn` (for example `PATH=/usr/bin:/bin claude`): it says so and points to the README's setup section. Ticket 08's first criterion runs the same skill.
