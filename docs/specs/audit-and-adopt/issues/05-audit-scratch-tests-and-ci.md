# 05: The audit reads .scratch, tests, CI and structure

Status: DONE
Triage: ready-for-agent
Blocked by: 03
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** two more areas of `binn audit`. `.scratch`: whether it exists and whether Git ignores it, a `.scratch` that is not ignored as a gap, a `.scratch` that holds the only copy of something durable, a spec or a ticket not tracked anywhere else, as a gap (ADR-0005, ADR-0017), and no `.scratch` as an `ok` and nothing more. Tests, CI and structure: whether the repository has a test setup and a CI configuration, and whether it is a workspace of packages or a single package, all from files that are there. Nothing is run: not the tests, not CI.

- [x] A fixture whose `.scratch` Git does not ignore gets a gap, and one whose `.scratch` is ignored does not.
- [x] A fixture whose `.scratch` holds the only copy of a spec gets a gap that says what to move into Git.
- [x] A repository with no `.scratch` gets an `ok`.
- [x] Test setup, CI configuration and the project's shape are reported from files, and nothing is executed to find them.

## Comments

### Decisions

- **Where things live.** The two areas are `scratch()` and `structure()` in `apps/cli/src/audit-files.ts`, joined in `audit()`'s one array; the finding type is unchanged.
- **Check codes.** `scratch.exists`, `scratch.ignored`, `scratch.durable`; `structure.tests`, `structure.ci`, `structure.shape`. No `.scratch` gives `scratch.exists` as `ok` and nothing more.
- **Ignored.** `git check-ignore -q -- .scratch/probe`, the only thing run (Git, read-only, with the audit's Git timeout); a rule naming the directory or its contents both count.
- **Durable (the rule).** `.scratch` holds the only copy when a Markdown file under it, on a path with a whole word `spec`, `specs`, `ticket(s)`, `issue(s)` or `prd` (split on `/ - _ .`), has no file of the same name anywhere under `docs/specs/`. The gap lists those paths and says to move them to `docs/specs/<slug>/` and `docs/specs/<slug>/issues/`. A namesake counts as the copy; content is not compared, and a tracker is not asked (the audit makes no network call).
- **Tests** are found from a `test` script in `package.json` that is not npm's placeholder, a test-runner configuration file (vitest, jest, playwright, pytest, tox, phpunit, karma), or a `test/`, `tests/`, `__tests__/` or `spec/` directory. **CI** from `.github/workflows/*.yml`, `.gitlab-ci.yml`, `.circleci/config.yml`, `Jenkinsfile` and three others. **Shape**: a workspace file (`pnpm-workspace.yaml`, `lerna.json`, `nx.json`, `turbo.json`) or `workspaces` in `package.json` is a workspace; otherwise a package manifest is a single package; neither is `unknown`. Missing tests or CI is a `gap`; none of it is executed.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.**

1. **`EXIT,type` lost a space in an import.** **Fixed.**
2. **Finding literals repeat `code` and `area` in the ok and gap branches.** **Left**, as in tickets 03 and 04.
3. **`files()` is a second directory walker beside `layout.ts`.** **Kept**: it needs recursion with a depth cap, which `layout.ts` does not.
4. **The lists of test, CI and manifest files reach past TypeScript.** **Kept**: cheap data; the audit is for any repository.
5. **`audit-files.ts` holds two areas.** **Kept**: one file of file-based checks beside `audit.ts`.

**Spec:**

1. **The `spec|ticket|issue|prd` match was a substring**, so `inspect-notes.md` was a false gap, against "does not invent work". **Fixed**: whole words; a test covers it.
2. **The `git check-ignore` call had no timeout.** **Fixed**: it uses the Git timeout.
3. **A ticket mirrored in a tracker still counts as the only copy.** **Left**: no network in the audit; the gap says what to move.
4. **An invalid `package.json` reads as no test script.** **Left**: it falls back to the other signals and is not reported separately.
5. **A symlinked directory in `.scratch` is not followed, and the walk stops at depth 6 and skips `node_modules`.** **Left**: a ceiling for a read-only audit.
6. **Vitest or Jest declared only in `package.json` dependencies is not seen.** **Left**: files named for a setup are the signal.
7. **A `.scratch` ignored by a narrow pattern (`.scratch/*.md`) is judged on one probe path.** **Left**.

Typecheck is clean, and the full suite passes: 406 of 406.
