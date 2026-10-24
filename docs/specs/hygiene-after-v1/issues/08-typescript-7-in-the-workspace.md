# 08: TypeScript 7 in the workspace

Status: DONE
Triage: ready-for-agent
Blocked by: 01, 02, 03, 04, 05, 06, 07
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer, DevOps

**What to build:** the workspace compiles with TypeScript 7, which closes Dependabot's pull request #4 (spec, *TypeScript 7*; product inbox, *TypeScript 7*). The root `typescript` moves to `^7`. `apps/dashboard` keeps `^5.9` while `vue-tsc` cannot run on 7, and `.github/dependabot.yml` ignores `typescript` `>=6` for it, with a comment beside the one for `@types/node` saying when to lift it; if `vue-tsc` already runs on 7 when the ticket starts, the dashboard moves too and no ignore is added. If the workspace cannot compile on 7 within the ticket, the reason is written, the pull request stays open, and the ticket is `DONE` with that finding.

- [ ] `pnpm typecheck`, the dashboard's typecheck and `pnpm test` pass on the branch, in CI too.
- [x] `pnpm typecheck`'s time before and after is written under `## Comments`.
- [x] `.github/dependabot.yml` carries the dashboard's rule, or the ticket says why none is needed.

## Comments

- **`vue-tsc` does not run on 7**, checked when the ticket started: `vue-tsc` 3.3.13, the latest, finds its compiler by reading `typescript/lib/tsc.js` and patching it, and TypeScript 7.0.2's `tsc.js` is a shim that starts the native binary; `require('typescript')` gives only `version`. Run against 7, `vue-tsc --noEmit` stops with "Failed to locate tsc module path from shim". So the root moves to `^7.0.0` and `apps/dashboard` keeps `^5.9.0`.
- **`pnpm typecheck`'s time**, wall clock on the owner's machine (24 cores), the same 501 files: before, on 5.9.3, 2.43 s to 2.74 s over four runs; after, on 7.0.2, 0.52 s to 0.73 s over three, about four times faster. `tsc --extendedDiagnostics` on 7 gives 0.32 s of compiler time. The dashboard's `nuxt typecheck`, on 5.9.3 either way, takes about 3.8 s.
- Decisions where the ticket is silent:
  - **The ignore holds the root's `typescript` too.** Dependabot updates the whole pnpm workspace from its one npm entry at `/`, and moves every manifest that names a dependency in the same pull request, as #4 did with both `package.json` files; its `ignore` has no directory of its own. So the rule `typescript` `>=6` sits in that entry and stops Dependabot proposing any `typescript` past 7.0.2 for the root as well, until it is lifted. The comment in `.github/dependabot.yml` says so and when to lift it: once `vue-tsc` runs on 7, the dashboard moves to `^7` and the rule goes. Ignoring only majors instead would let a 7.x pull request rewrite the dashboard's `^5.9.0`, which breaks its typecheck.
  - `apps/cli/test/security-policy.test.ts` pins it: the root is on 7, and the ignore is there exactly while the dashboard is below 6, so moving the dashboard without lifting the rule fails the suite.
- Pull request #4 is closed once this branch is merged: Dependabot closes it itself when `main` carries 7.0.2, or the owner closes it.
  - **CI runs the dashboard's typecheck**, `pnpm --filter @binnacle/dashboard typecheck`, after `pnpm typecheck` in the `check` job: it ran in neither before, and the first criterion asks for it in CI. `apps/cli/test/ci-workflow.test.ts` pins the step, and `CONTRIBUTING.md` and its Russian twin name it.
- The first criterion holds on the branch: `pnpm typecheck`, `pnpm --filter @binnacle/dashboard typecheck` and `pnpm test` (904 tests) pass. Its CI part is the owner's, once the branch is pushed:
  1. Push `feat/typescript-7-in-the-workspace`, or merge it, and open the CI run in GitHub Actions.
  2. In the `check` job, `pnpm typecheck` prints nothing and passes, `pnpm --filter @binnacle/dashboard typecheck` passes, and `pnpm test` passes; `autostart-live` and `tarball-live` pass on all three runners.
  3. Once `main` carries it, pull request #4 is closed, by Dependabot or by hand.
  4. On Dependabot's next npm pull request, check that it does not touch `typescript` in either `package.json` (Review, finding 3).

### Review

Against `main`, in a sub-agent, on the standards and the spec, and DevOps's concerns. Typecheck, the dashboard's typecheck and the full suite pass; one author, no attribution, no dependency beyond the one the ticket moves.

1. **The dashboard's typecheck did not run in CI**, which the first criterion and the spec's testing decision ask for. **Fixed**: a step in `.github/workflows/ci.yml`'s `check` job, pinned in `apps/cli/test/ci-workflow.test.ts`, named in both `CONTRIBUTING` pages.
2. The test of the Dependabot rule in `apps/cli/test/security-policy.test.ts` is surface the spec's testing decision does not ask for. **Kept**: it fails when the dashboard moves without lifting the rule, which would otherwise freeze the root's `typescript` unnoticed, and it follows the file's tests of `dependabot.yml`.
3. Which version Dependabot reads for a dependency at 7.0.2 in one manifest and 5.9.3 in another cannot be checked offline; read as 5.9.3, a 5.9.x patch could rewrite the root's `^7.0.0`. **Left**: unlikely while 5.9 gets no patch, and seen in that pull request's diff; step 4 of the script above checks it.
4. The reviewer confirmed that `vue-tsc` 3.3.13 fails on TypeScript 7 with "Failed to locate tsc module path from shim", and that the ignore can only sit in the `/` entry: an entry of its own for `/apps/dashboard` would not stop the `/` one rewriting the dashboard, and `exclude-paths` would stop its other dependencies too. No finding.

#### DevOps

None. The lockfile adds `typescript` 7.0.2 and its native binaries as optional dependencies, the CI runners' `linux-x64`, `darwin-arm64` and `win32-x64` among them, with no install script, so `--frozen-lockfile` and pnpm's build-script gate are unaffected. Nothing at runtime or in packaging loads `typescript`: tests run through Node's type stripping and `apps/cli` builds with esbuild.
