# 10: Refreshing the binnacle plugin takes effect

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** a defect found in epic 9's exit demonstration (2026-10-05). The installed `binnacle@binnacle` has version `unknown`, because the packaged plugin's manifest names none. `claude plugin update binnacle@binnacle` then answers "refreshed from source" but leaves the cache at `~/.claude/plugins/cache/binnacle/binnacle/unknown/` as it was, so skills merged since the first install never reach a session: on 2026-10-05 the cache still held six skills while the package held twelve, and `/binnacle:init` did not exist. Only `claude plugin uninstall` then `install` brought them. Give the packaged plugin a version that changes whenever its skills change, written by `pnpm --filter @binnacle/cli run prepare`, so that the three refresh commands the README, the development workflow and autopilot's step 7 name (stories 43 to 48) really refresh it. No new step for the owner.

- [ ] The packaged plugin's manifest carries a version that differs whenever a skill's text differs, and stays the same when none does.
- [ ] A test in `apps/cli/test/pack.test.ts` holds that: changing one skill's text changes the version.
- [ ] The README, `README.ru.md` and `docs/workflow/02-development-workflow.md` still name the same three commands, and say nothing that is no longer true.
- [ ] By hand: after a change to a `SKILL.md`, the three refresh commands leave that change in the installed copy, and a new session runs it. The steps are recorded under `## Comments`.

## Comments
