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

## Comments

- **`vue-tsc` does not run on 7**, checked when the ticket started: `vue-tsc` 3.3.13, the latest, finds its compiler by reading `typescript/lib/tsc.js` and patching it, and TypeScript 7.0.2's `tsc.js` is a shim that starts the native binary; `require('typescript')` gives only `version`. Run against 7, `vue-tsc --noEmit` stops with "Failed to locate tsc module path from shim". So the root moves to `^7.0.0` and `apps/dashboard` keeps `^5.9.0`.
- **`pnpm typecheck`'s time**, wall clock on the owner's machine (24 cores), the same 501 files: before, on 5.9.3, 2.43 s to 2.74 s over four runs; after, on 7.0.2, 0.52 s to 0.73 s over three, about four times faster. `tsc --extendedDiagnostics` on 7 gives 0.32 s of compiler time. The dashboard's `nuxt typecheck`, on 5.9.3 either way, takes about 3.8 s.
- Decisions where the ticket is silent:
  - **The ignore holds the root's `typescript` too.** Dependabot updates the whole pnpm workspace from its one npm entry at `/`, and moves every manifest that names a dependency in the same pull request, as #4 did with both `package.json` files; its `ignore` has no directory of its own. So the rule `typescript` `>=6` sits in that entry and stops Dependabot proposing any `typescript` past 7.0.2 for the root as well, until it is lifted. The comment in `.github/dependabot.yml` says so and when to lift it: once `vue-tsc` runs on 7, the dashboard moves to `^7` and the rule goes. Ignoring only majors instead would let a 7.x pull request rewrite the dashboard's `^5.9.0`, which breaks its typecheck.
  - `apps/cli/test/security-policy.test.ts` pins it: the root is on 7, and the ignore is there exactly while the dashboard is below 6, so moving the dashboard without lifting the rule fails the suite.
- Pull request #4 is closed once this branch is merged: Dependabot closes it itself when `main` carries 7.0.2, or the owner closes it.
- CI runs `pnpm typecheck` and `pnpm test`, not the dashboard's typecheck, which `pnpm --filter @binnacle/dashboard typecheck` runs locally.
