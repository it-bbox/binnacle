# 10: Dependabot's npm updates

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`
Roles: Developer, Reviewer, DevOps

**What to build:** this repository's Dependabot updates npm again (spec, *Dependabot*). Its first npm update failed with `unknown_error`. Read the failed job's log through `gh`, find the cause, and fix `.github/dependabot.yml` or whatever the log points to; the pnpm workspace and its root lockfile are the first suspects. The pull request Dependabot opens after the fix can be seen only once `main` is pushed, which is the owner's; the exit demonstration checks it.

- [ ] The ticket's comments quote the cause from the log, without any token.
- [ ] The fix is in the branch, and the configuration still covers npm and GitHub Actions weekly.
- [ ] The comments say what the owner should see after the push: an npm update pull request, or the job's new log.

## Comments

### The cause

The failed job is the *Dependabot Updates* run `npm_and_yarn in /. - Update #1624714610` of 2026-10-13, read with `gh run view 38388313611 --log`. Dependabot ran pnpm 10.34.5 (`packageManager`) as

```
pnpm update @iconify-json/lucide@1.2.142 --lockfile-only --no-save -r --config.minimum-release-age=4320
```

and pnpm refused:

```
ERR_PNPM_NO_MATURE_MATCHING_VERSION  Version 3.3.13 (released 2 days ago) of vue-tsc does not meet the minimumReleaseAge constraint
This error happened while installing a direct dependency of /home/dependabot/dependabot-updater/repo/apps/dashboard
```

The same error ended each of the four updates in the group (`@iconify-json/lucide`, `typescript`, `marked`, `@types/node`), and Dependabot recorded it as `unknown_error`. The log holds no token.

`4320` minutes is Dependabot's cooldown: three days, its default when `dependabot.yml` names none (`DEFAULT_COOLDOWN_DAYS` in dependabot-core's `updater/lib/dependabot/job.rb`), which it hands to pnpm as `minimum-release-age`. pnpm 10 has no lenient mode for that gate: a recursive update re-resolves the workspace, and any version it lands on inside the window fails the whole command. `apps/dashboard` asked for `vue-tsc ^3.3.13`, two days old then, which only 3.3.13 satisfied. Neither the workspace layout nor `directory: /` was at fault: Dependabot read the root lockfile and all eight projects.

It is not a one-off. Replaying the same command on today's lockfile, in a copy of the manifests, fails the same way on another entry: `unhead` 3.4.3, two days old, locked as a dependency of `nuxt`. A lockfile entry younger than three days at the moment Dependabot runs fails every npm update.

### Decisions

- **The workspace resolves nothing younger than the cooldown.** `pnpm-workspace.yaml` sets `minimumReleaseAge: 4320`, so a local `pnpm add`, `pnpm update` or a manifest edit resolves only versions at least three days old, and no entry inside Dependabot's window reaches the lockfile. Checked on a copy: the lockfile resolved afresh under that setting passes Dependabot's exact command; `pnpm install --frozen-lockfile`, which CI runs, does not resolve and is unaffected, as are the entries already locked.
- **`dependabot.yml` names npm's cooldown, `default-days: 3`,** Dependabot's present default, so a change of that default cannot widen its window past the workspace's again. The comment at the top says to change both together, and `apps/cli/test/security-policy.test.ts` fails when the two disagree. `github-actions` keeps the default: pnpm plays no part there.
- **Not taken:** turning the cooldown off (`exclude: ["*"]`), which drops the delay on new releases rather than fix the lockfile; and moving to pnpm 11.3 or later, on which Dependabot trusts the existing lockfile and relaxes the gate, a change of the project's package manager that the ticket does not ask for.
- **The lockfile is not touched.** `unhead` 3.4.3 is older than three days before the next weekly run.
- **A version younger than three days can no longer be added here** without waiting or naming it in `minimumReleaseAgeExclude`; pnpm's error says so. That is the cost of the gate.

### After the push

Once `main` is pushed with this change, the owner should see, within the week (or at once from *Insights* → *Dependency graph* → *Dependabot* → `npm` → *Check for updates*):

1. A *Dependabot Updates* run `npm_and_yarn in /.` that ends in success: `gh run list --workflow "Dependabot Updates" --limit 5`.
2. One pull request from Dependabot, the `minor-and-patch` group for npm, and a pull request of its own for each major update with no cooldown left (for example `typescript` 7 or `@types/node` 26), each running CI.
3. If the run fails again, its log, `gh run view <id> --log`, with the `ERR_PNPM_…` line near `record_update_job_unknown_error`; a `NO_MATURE_MATCHING_VERSION` there means an entry younger than three days reached the lockfile some way other than pnpm resolving it here.
