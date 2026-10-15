# 03: Security basics and the worktree setting in the audit

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** `binn audit` gains the `security` area, after `secrets`, and one check in `git-and-tracker` (spec, *Security basics*, *Git*).

- The lockfile: with a package manifest, a lockfile of npm, pnpm, Yarn, Bun, Cargo, Go, Poetry, uv, Pipenv, Bundler or Composer is `ok`, none is a `gap`; with no manifest there is no finding.
- Dependency updates: `.github/dependabot.yml` or `.yaml`, or a Renovate configuration in any place Renovate reads, is `ok`; none is a `gap` recommending Dependabot or Renovate.
- `SECURITY.md` at the root, in `.github/` or in `docs/` is `ok`; none is a `gap` saying what the file is for.
- `extensions.worktreeconfig` true with no `config.worktree` in the common Git directory or any worktree's is a `gap` naming Antigravity as the harness it breaks, with the `git config --unset extensions.worktreeconfig` command; with a `config.worktree`, or the setting off, `ok`.

- [x] Through `binn audit --json`: a manifest without a lockfile is a `gap`; no manifest gives no lockfile finding; Dependabot and Renovate fixtures are `ok`; `SECURITY.md` in each of the three places is `ok`.
- [x] A fixture with `extensions.worktreeconfig` set and no `config.worktree` is a `gap` naming Antigravity and the unset command; with a `config.worktree` it is `ok`.
- [x] The audit on this repository gives no gap in `security`.

## Comments

- Codes: `security.lockfile` (no finding without a manifest), `security.updates`, `security.policy`, and `security.files`, `unknown`, only when `git ls-files` fails; `git.worktree_config` in `git-and-tracker`, `ok` when the setting is off, `unknown` when Git cannot read it. `security()` is in `apps/cli/src/audit-files.ts` on the same `tracked()` list as `docker()` and `secrets()`; `worktreeConfig()` is in `apps/cli/src/audit.ts`.
- Decisions where the ticket is silent: only tracked files count, so an ignored lockfile or an untracked `dependabot.yml` is a gap; a manifest is matched with its own ecosystem's lockfiles (`package.json` with npm's, pnpm's, Yarn's or Bun's; `pyproject.toml` with Poetry's or uv's), found in its directory or any directory above it, so a workspace member is covered by the lockfile at the root; Renovate's places are those of docs.renovatebot.com, *Configuration options* (read 2026-10-15), `jsonc` included, and `package.json`'s `renovate` key; `SECURITY.md` is matched in any case, as GitHub does.
- Known ceiling: a `go.mod` with no dependency has no `go.sum` and still reads as a gap.
- For ticket 04 (the plan): none of these findings is closed by `binn init`.
- For ticket 11 (the exit demonstration): the owner's checkout has `extensions.worktreeconfig` set with no `config.worktree`, so `git.worktree_config` is a gap there today, in `git-and-tracker`, not in the three new areas. `git config --unset extensions.worktreeconfig` clears it; it is the owner's to run.

### Review

Against `main`, in a sub-agent, on the standards and the spec. Typecheck and the 844 tests pass; each criterion maps to a test, and the security checks read only the `git ls-files` list.

1. **The setting was read from every config scope** (`apps/cli/src/audit.ts`, `worktreeConfig`): a global `extensions.worktreeConfig`, which Git ignores, read as a gap whose unset command changes nothing. **Fixed**: `git config --local`; a test sets it globally and expects `ok`.
2. **The common Git directory was read with a second `git rev-parse`** where `readGitLocation` in `@binnacle/adapters` already resolves it. **Fixed**: it is reused.
