# 07: Autopilot refreshes the plugin a merge changed

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** on this repository Claude Code loads the installed `binnacle@binnacle`, which shadows the skills-directory plugin, so a merged skill change does not reach the owner. In autopilot's step 7, only when the project is Binnacle itself and the merge changed `.claude/skills/binnacle/`, after any frozen install and before regenerating the dashboard, autopilot runs `pnpm --filter @binnacle/cli run prepare` in the main checkout. Then, only if `claude plugin list --json` lists `binnacle@binnacle`, it runs `claude plugin marketplace update binnacle` and `claude plugin update binnacle@binnacle`. It reports under *Waiting for the owner* that the plugin was refreshed and that a new session loads it, or why it was skipped, or which command failed. A failure never stops the run. The development workflow (*On this repository*) and the README's `pnpm install` paragraph, in English and Russian, name the same steps for a merge done by hand.

- [x] Autopilot's step 7 and its report say the above. A test in `apps/cli/test/pack.test.ts` holds the wording: only on a change under `.claude/skills/binnacle/`, only with `binnacle@binnacle` listed, and a failure does not stop the run.
- [x] `docs/workflow/02-development-workflow.md`, `README.md` and `README.ru.md` name the refresh.
- [ ] By hand: a changed `SKILL.md`, refreshed this way, is the one a new session runs. The steps are recorded under `## Comments`.

## Comments

### By hand: a refreshed skill is the one a new session runs

Left to the owner: it needs a real Claude Code with `binnacle@binnacle` installed, which an agent may not update. In the main checkout, on a throwaway branch:

```bash
claude plugin list --json | grep -c '"binnacle@binnacle"'   # 1: installed
echo '<!-- refresh check -->' >> .claude/skills/binnacle/skills/status/SKILL.md
pnpm --filter @binnacle/cli run prepare
grep -c 'refresh check' apps/cli/plugin/skills/status/SKILL.md   # 1: copied into the package
claude plugin marketplace update binnacle
claude plugin update binnacle@binnacle
grep -rl 'refresh check' ~/.claude/plugins/cache/binnacle/   # the installed copy holds it
```

Then start a new session and run `/binnacle:status`: the skill text it loaded ends with the marker. Afterwards restore `.claude/skills/binnacle/skills/status/SKILL.md` and run the three refresh commands again.

### Review

Code review against `main`, both axes.

Standards:
- Fixed: the READMEs gave the three commands as one block and said only afterwards that two of them need `binnacle@binnacle` listed; the condition now comes before the block.
- Fixed: the rule against changing settings carried a second carve-out beside its "except as step 7 allows"; removed, the one exception covers it.
- Fixed: the workflow said "and" between the two plugin commands where the skill says "then".
- Kept: the commands appear in the skill, the workflow and both READMEs. The ticket asks for each of them to name the steps.
- Kept: the test matches a whole sentence of the skill, as the file's other wording tests do.
- Left: the reviewer counted an ADR-0023 amendment among the copies; this branch changes no ADR, so there is nothing to act on.

Spec:
- Fixed: the docs said autopilot refreshes "after each merge it makes"; they now say after a merge of its own that changed the skills (story 45).
- Fixed: step 7 now says to report a skipped refresh, as it does for the daemon and the dashboard (story 47), and a failure is reported with the commands run before it (story 46); the test holds the latter.
- Kept: the README's steps are a paragraph of their own after the `pnpm install` one, which the ticket names; that paragraph stays about `node_modules`.
- Kept: the hand check stays unticked, with its script above.
