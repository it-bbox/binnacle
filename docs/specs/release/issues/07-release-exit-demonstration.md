# 07: The exit demonstration of epic 17

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06
Spec: `docs/specs/release/spec.md`

**What to build:** epic 17's exit criterion, by the owner (spec, the exit criterion, *Further Notes*).

- [x] CI's package job is green on Linux, macOS and Windows at `main`'s head.
- [x] The owner publishes `@it-bbox/binnacle@0.1.0` from the built package's directory.
- [x] In a clean environment — a temporary prefix and home, or a container — `npm i -g @it-bbox/binnacle` from the registry, then `binn init` in a new project, `binn daemon start` and the dashboard work.
- [ ] The README and the guides read well on GitHub, in English and in Russian.
- [ ] `it-bbox/binnacle` is public; private vulnerability reporting and Dependabot alerts are on.

## Comments

### Decisions

- **CI.** Run `CI` at `515d9d2`, `origin/main`'s head when the package was built: `check`, `tarball-live` and `autostart-live` green on `ubuntu-latest`, `macos-latest` and `windows-latest`. `main`'s one newer commit, `27f1938`, is the roadmap only, unpushed.
- **Published.** `npm publish --dry-run` first, then the owner's `npm publish --access public` from `apps/cli/dist/`, 76 files, 816 kB. npm refused the first try with `E403` until the account had 2FA, and showed `0.0.0-stage` as `latest` for about four minutes before `0.1.0`.
- **The clean environment is a container**, `node:24-slim` with only `git` and `curl` added, so nothing on the owner's machine was touched. From the registry:
  - `npm i -g @it-bbox/binnacle`, then `binn --version` prints `0.1.0`.
  - `binn daemon start` and `status` answer on `127.0.0.1:7717`; `binn daemon stop` stops it.
  - `/` is the generated dashboard, not the "has not been generated" page, and its `_nuxt` script and stylesheet load; `/attention/`, `/projects/`, `/usage/` and `/settings/` return 200. `/ops/project.list` returns 200 with the token from `binn dashboard --print`, 401 without it.
  - In a new repository, `binn init --plan --json`, then `--apply`, exits 0: it writes the manifest, the agent docs, `AGENTS.md`, `docs/specs/` and the roadmap, registers the project and installs ast-grep. It skips autostart (no systemd), the harnesses (none installed), Serena and Graphify (no `uv`).
  - `binn project list`, `binn call project_detect`, `binn audit` and `ast-grep --version` answer.
- **Dashboard in a browser** was not opened: the container has none. Its pages and its API answering with the token is what a browser loads; the owner opens it at the demonstration.

### Found on the way

- npm 11.19 warns that `@ast-grep/cli`'s postinstall is "not yet covered by allowScripts" when `binn init` installs it. `ast-grep --version` works today; a later npm that blocks the script may break that install. For the product inbox.
- `binn project register` without a manifest still points to `templates/project/project.yaml.example` (ticket 06, *For the owner*); seen again from the registry.
- The plugin's skills in `0.1.0` still say "*From this repository* until the npm package is published"; the next version can drop the clause.

### For the owner

The two criteria left are yours:

1. **Public and its settings.** `it-bbox/binnacle` is public, and Dependabot alerts are on (`gh api -i repos/it-bbox/binnacle/vulnerability-alerts` answers 204). Left: *Settings* → *Advanced Security* (formerly *Code security and analysis*) → *Private vulnerability reporting* → *Enable*; `gh api repos/it-bbox/binnacle/private-vulnerability-reporting` then says `"enabled": true`. Ticket 02's *For ticket 07* has the checks from another account and the Dependabot graph.
2. **Read on GitHub.** Push `main` first, since GitHub shows `origin/main`. Then open `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and the guides in `docs/operations/`, each with its `.ru.md` twin: each reads in short paragraphs, lists and tables, and its links open. The npm page of `@it-bbox/binnacle` now links a public repository.

### Review

A sub-agent reviewed the branch against `main` on both axes.

**Standards**

1. **One ten-line paragraph** for the clean install. **Fixed**: a list.
2. **Facts it could not see** (`binn daemon stop`, the dry run's 76 files, `0.0.0-stage`). **Kept**: each is in this session's output.
3. **Two names for one settings page** against ticket 02. **Fixed**: both named.
4. Authorship, subject, roadmap untouched, the code's claims: no finding.

**Spec**

1. **A 200 does not prove the dashboard**: the daemon's "has not been generated" page also answers 200 with the same title. **Fixed**: checked again from the registry; `/` is the generated page and its `_nuxt` assets load.
2. **"At `main`'s head"** while `main` has one unpushed roadmap commit. **Kept**: the package was built at `515d9d2`, `origin/main`'s head, and the commit changes no code.
3. **The owner's checks were thin**: visibility only, and the guides without `CONTRIBUTING.md` and `SECURITY.md`. **Fixed**: the API checks, ticket 02's steps, both pairs and pushing `main` first.
