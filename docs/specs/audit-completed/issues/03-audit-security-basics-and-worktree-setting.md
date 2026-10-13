# 03: Security basics and the worktree setting in the audit

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** `binn audit` gains the `security` area, after `secrets`, and one check in `git-and-tracker` (spec, *Security basics*, *Git*).

- The lockfile: with a package manifest, a lockfile of npm, pnpm, Yarn, Bun, Cargo, Go, Poetry, uv, Pipenv, Bundler or Composer is `ok`, none is a `gap`; with no manifest there is no finding.
- Dependency updates: `.github/dependabot.yml` or `.yaml`, or a Renovate configuration in any place Renovate reads, is `ok`; none is a `gap` recommending Dependabot or Renovate.
- `SECURITY.md` at the root, in `.github/` or in `docs/` is `ok`; none is a `gap` saying what the file is for.
- `extensions.worktreeconfig` true with no `config.worktree` in the common Git directory or any worktree's is a `gap` naming Antigravity as the harness it breaks, with the `git config --unset extensions.worktreeconfig` command; with a `config.worktree`, or the setting off, `ok`.

- [ ] Through `binn audit --json`: a manifest without a lockfile is a `gap`; no manifest gives no lockfile finding; Dependabot and Renovate fixtures are `ok`; `SECURITY.md` in each of the three places is `ok`.
- [ ] A fixture with `extensions.worktreeconfig` set and no `config.worktree` is a `gap` naming Antigravity and the unset command; with a `config.worktree` it is `ok`.
- [ ] The audit on this repository gives no gap in `security`.
