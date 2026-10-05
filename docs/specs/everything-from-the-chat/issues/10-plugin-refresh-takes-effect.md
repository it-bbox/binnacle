# 10: Refreshing the binnacle plugin takes effect

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** a defect found in epic 9's exit demonstration (2026-10-05). The installed `binnacle@binnacle` has version `unknown`, because the packaged plugin's manifest names none. `claude plugin update binnacle@binnacle` then answers "refreshed from source" but leaves the cache at `~/.claude/plugins/cache/binnacle/binnacle/unknown/` as it was, so skills merged since the first install never reach a session: on 2026-10-05 the cache still held six skills while the package held twelve, and `/binnacle:init` did not exist. Only `claude plugin uninstall` then `install` brought them. Give the packaged plugin a version that changes whenever its skills change, written by `pnpm --filter @binnacle/cli run prepare`, so that the three refresh commands the README, the development workflow and autopilot's step 7 name (stories 43 to 48) really refresh it. No new step for the owner.

- [x] The packaged plugin's manifest carries a version that differs whenever a skill's text differs, and stays the same when none does.
- [x] A test in `apps/cli/test/pack.test.ts` holds that: changing one skill's text changes the version.
- [x] The README, `README.ru.md` and `docs/workflow/02-development-workflow.md` still name the same three commands, and say nothing that is no longer true.
- [x] By hand: after a change to a `SKILL.md`, the three refresh commands leave that change in the installed copy, and a new session runs it. The steps are recorded under `## Comments`.

## Comments

Decided without the owner: the version is the first 12 hex digits of a SHA-256 over every file of the plugin's source, path and content, the form of the commit ids Claude Code already uses as versions for a plugin from a Git marketplace. So a change to `plugin.json`'s description refreshes the plugin too, which the owner also wants installed; nothing else in the source changes it.

### By hand: a changed SKILL.md reaches the installed copy and a new session

Half checked on the branch, under a throwaway `HOME` inside the worktree, with Claude Code 2.1.285: a plugin packaged without a version installed as `unknown`; after a change to `skills/status/SKILL.md`, the three refresh commands answered "updated from unknown to 3fa8bb36ceb4" and the new cache directory held the change; a second change moved it to another version; with no change, `claude plugin update` answered "already at the latest version". The owner's own install was not touched.

Left to the owner: that a new session runs the change, which needs the real Claude Code and its installed `binnacle@binnacle`. In the main checkout, after the merge, on a throwaway branch:

```bash
pnpm --filter @binnacle/cli run prepare
claude plugin marketplace update binnacle
claude plugin update binnacle@binnacle      # first time: "updated from unknown to <version>"
echo '<!-- refresh check -->' >> .claude/skills/binnacle/skills/status/SKILL.md
pnpm --filter @binnacle/cli run prepare
claude plugin marketplace update binnacle
claude plugin update binnacle@binnacle      # "updated from <version> to <another>"
grep -rl 'refresh check' ~/.claude/plugins/cache/binnacle/binnacle/   # the new version's SKILL.md
```

Then start a new session and run `/binnacle:status`: the skill text it loaded ends with the marker. Afterwards restore `.claude/skills/binnacle/skills/status/SKILL.md` and run the three refresh commands again.

### Review

Code review against `main`, both axes.

Standards:
- Fixed: the new test read the written manifest's version twice in the same long expression; one local helper now does it.
- Kept: `preparePlugin` both copies the plugin and returns its version; the doc comment says so, and the name matches the `prepare` script it serves.
- Kept: the pack test compares the packed version with `preparePlugin`'s own answer. It proves the pack ran the script; the version's behaviour is the new test's job.
- Kept: the manifest path is spelled in `prepare.ts` and in the test, as the test already spells the source's paths.

Spec:
- Fixed: the READMEs said the version is drawn from the skills' text; it is drawn from every file of the plugin, which they now say.
- Fixed: the hand check's steps are recorded above; its new-session half stays unticked, for the owner.
- Kept: the ADR-0027 consequence, which the ticket does not ask for, holds the durable reason the build writes a version.
- Kept: `docs/workflow/02-development-workflow.md` and autopilot's step 7 are unchanged; what they say of `prepare` stays true.

### The owner's half, 2026-10-05

Held in epic 9's exit demonstration (ticket 08): autopilot merged ticket 11 and refreshed the plugin to `8a90bc379176`, and the next session ran ticket 11's `/binnacle:init` from that version.
