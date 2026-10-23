# 08: TypeScript 7 in the workspace

Status: READY
Triage: ready-for-agent
Blocked by: 01, 02, 03, 04, 05, 06, 07
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer, DevOps

**What to build:** the workspace compiles with TypeScript 7, which closes Dependabot's pull request #4 (spec, *TypeScript 7*; product inbox, *TypeScript 7*). The root `typescript` moves to `^7`. `apps/dashboard` keeps `^5.9` while `vue-tsc` cannot run on 7, and `.github/dependabot.yml` ignores `typescript` `>=6` for it, with a comment beside the one for `@types/node` saying when to lift it; if `vue-tsc` already runs on 7 when the ticket starts, the dashboard moves too and no ignore is added. If the workspace cannot compile on 7 within the ticket, the reason is written, the pull request stays open, and the ticket is `DONE` with that finding.

- [ ] `pnpm typecheck`, the dashboard's typecheck and `pnpm test` pass on the branch, in CI too.
- [ ] `pnpm typecheck`'s time before and after is written under `## Comments`.
- [ ] `.github/dependabot.yml` carries the dashboard's rule, or the ticket says why none is needed.
