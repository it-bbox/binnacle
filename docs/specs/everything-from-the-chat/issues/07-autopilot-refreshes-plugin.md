# 07: Autopilot refreshes the plugin a merge changed

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** on this repository Claude Code loads the installed `binnacle@binnacle`, which shadows the skills-directory plugin, so a merged skill change does not reach the owner. In autopilot's step 7, only when the project is Binnacle itself and the merge changed `.claude/skills/binnacle/`, after any frozen install and before regenerating the dashboard, autopilot runs `pnpm --filter @binnacle/cli run prepare` in the main checkout. Then, only if `claude plugin list --json` lists `binnacle@binnacle`, it runs `claude plugin marketplace update binnacle` and `claude plugin update binnacle@binnacle`. It reports under *Waiting for the owner* that the plugin was refreshed and that a new session loads it, or why it was skipped, or which command failed. A failure never stops the run. The development workflow (*On this repository*) and the README's `pnpm install` paragraph, in English and Russian, name the same steps for a merge done by hand.

- [ ] Autopilot's step 7 and its report say the above. A test in `apps/cli/test/pack.test.ts` holds the wording: only on a change under `.claude/skills/binnacle/`, only with `binnacle@binnacle` listed, and a failure does not stop the run.
- [ ] `docs/workflow/02-development-workflow.md`, `README.md` and `README.ru.md` name the refresh.
- [ ] By hand: a changed `SKILL.md`, refreshed this way, is the one a new session runs. The steps are recorded under `## Comments`.

## Comments
