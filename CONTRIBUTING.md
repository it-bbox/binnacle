# Contributing

_Русская версия: [CONTRIBUTING.ru.md](CONTRIBUTING.ru.md)._

This page is for developing Binnacle itself. Using Binnacle needs only the [README](README.md)'s install. Every agent working on this repository follows [AGENTS.md](AGENTS.md).

## Stack

- **TypeScript** — all of our own application code;
- **Node.js 24 LTS** — runtime baseline;
- **pnpm** — package manager / workspace;
- **Nuxt** — web dashboard;
- **`node:sqlite`** — local projection/cache, no native modules and no build step;
- **MCP** — agent-facing API, and the stable contract for every harness;
- **local session artifacts** — the primary telemetry source; OpenTelemetry is an optional addition where a harness supports it;
- Markdown/YAML/JSON — portable formats for project knowledge/config.

Python/Go/Rust are not used in our own core. External tools may ship their own runtime (Serena/Graphify, for example); Binnacle only integrates them.

## Repository layout

```text
binnacle/
├── apps/
│   ├── daemon/
│   ├── dashboard/
│   ├── cli/
│   └── devcontainer-feature/
├── packages/
│   ├── core/
│   ├── mcp/
│   ├── telemetry/
│   └── adapters/
├── docs/
├── templates/
├── AGENTS.md
├── CLAUDE.md
└── CONTEXT.md
```

Each package's boundary is in [docs/07-initial-repository-layout.md](docs/07-initial-repository-layout.md).

## From this repository

To develop Binnacle, `binn` comes from a checkout. Link it onto PATH once, from the main checkout rather than a worktree:

```bash
pnpm install
cd apps/cli && pnpm link --global
```

If pnpm has no global bin directory yet, run `pnpm setup` first and open a new shell. Then start the daemon with `binn daemon start` and register the repository with `binn project register`.

The daemon also serves a read-only dashboard at its own address, `http://127.0.0.1:7717/` by default. From a checkout, generate it once in the main checkout with `pnpm dashboard:generate`, and again after pulling a change to `apps/dashboard`. Until then the address answers with a page naming that command.

`binn dashboard` opens the dashboard in the default browser, already authorised; `binn dashboard --print` prints its address with the token, and opens nothing. After the first time, the plain address works as a bookmark in that browser.

### After a pull or a merge

The link runs the CLI out of the main checkout, with that checkout's `node_modules`. So after pulling or merging a change that touches the workspace — a new package, a changed dependency, `pnpm-lock.yaml` — run `pnpm install` in the main checkout again.

Until then a package the CLI now imports is missing there: `binn` fails with `ERR_MODULE_NOT_FOUND`, and every session's MCP tools go with it. Installing in a worktree does not help, since each checkout has its own `node_modules`.

Once `binn init` has installed the `binnacle` plugin, Claude Code loads that installed `binnacle@binnacle` here, not the skills in `.claude/skills/binnacle/`, so a merged change to those skills does not reach a new session by itself. After pulling or merging one, run in the main checkout the first command below, and the other two only when `claude plugin list --json` lists `binnacle@binnacle`:

```bash
pnpm --filter @binnacle/cli run prepare
claude plugin marketplace update binnacle
claude plugin update binnacle@binnacle
```

The first copies the skills into the CLI package and gives the plugin a version drawn from the plugin's files, so it changes whenever a skill does. The other two have Claude Code update its copy to that version.

Every other harness runs the `binnacle-<action>` copy the first command also writes. So when `~/.agents/skills` holds a `binnacle-*` skill, reinstall that copy too, and take it back out of Claude Code. Name after `claude-code` any harness you keep it out of with `binn init --skip-harness`:

```bash
npx skills add ./apps/cli/skills -g -y
npx skills remove -g -a claude-code -s $(ls apps/cli/skills) -y
```

A new session then loads the changed skills. `/binnacle:autopilot` does this itself once, after the last merge of a run whose merges changed them.

## Checking a change

`pnpm typecheck`, `pnpm --filter @binnacle/dashboard typecheck` and `pnpm test` check a change; the dashboard has its own typecheck because it stays on TypeScript 5.x, which `vue-tsc` needs, while the workspace runs 7, and `pnpm test` is offline. The live tests run apart, with `pnpm test:live`:

| Live test | What it needs |
| --- | --- |
| the adapters' | read-only tracker tokens |
| autostart's | a real service manager; it installs a real service, so it runs only where `CI` is set |
| the tarball's | nothing beyond `pnpm install`: it builds, packs and installs the package (*Releasing*, below) |
| the dev container feature's | `docker` and `devcontainer`, the dev container CLI, on PATH, and network: it builds containers with the feature and `binn` from npm (*Releasing*, below) |

CI runs in GitHub Actions on every push to `main` and every pull request (`.github/workflows/ci.yml`), without any secret:

- the typecheck, the dashboard's typecheck and `pnpm test`, on Linux;
- the autostart and tarball live tests, on Linux, macOS and Windows runners.

The adapters' live tests, which need tokens, and the dev container feature's do not run there.

## Releasing

Binnacle is published to npm as one package, `@it-bbox/binnacle`, whose version is `apps/cli/package.json`'s (ADR-0044). The workspace's own packages stay private.

1. **Version.** Raise `version` in `apps/cli/package.json` for every release after `0.1.0`: npm never takes the same version twice.
2. **Check.** `pnpm install`, then `pnpm typecheck` and `pnpm test`.
3. **Build.** `pnpm --filter @binnacle/cli build` runs `nuxt generate` itself, and writes the package to `apps/cli/dist/`:
   - `bin/binn.js` and `bin/binnd.js`, bundled with every dependency;
   - `dashboard/`, the generated dashboard;
   - `plugin/` and `.claude-plugin/marketplace.json`, the plugin and its marketplace;
   - `skills/`, the `binnacle-<action>` copy for other harnesses;
   - `LICENSE`, `README.md` and a `package.json` the build writes.
4. **Test the tarball.** `node --test apps/cli/test/tarball.live.ts` builds, runs `npm pack`, installs the tarball into an empty prefix with a temporary `HOME` and `BINNACLE_HOME`, and drives the installed commands. It needs no network once the workspace is installed. CI's `tarball-live` job runs it on the three platforms; publish only when that job is green at `main`'s head.
5. **Publish.** The owner publishes by hand, so no npm token sits in CI. npm publishes only from an account with two-factor authentication turned on; without it, `npm publish` fails with `E403`. With it, `npm publish` asks for the second factor in the browser: open the link it prints and confirm there. Do not sign in with a recovery code: it puts the account on a 72-hour hold, with no publishing until it ends.

```bash
npm login
cd apps/cli/dist
npm publish --access public
```

`npm view @it-bbox/binnacle version` then prints the version published. A new package can show `0.0.0-stage` as `latest` for a few minutes before its version appears: wait, and look again. To install it from the registry, follow the [installation checklist](docs/operations/05-installation-checklist.md).

### The dev container feature

The dev container feature, `apps/devcontainer-feature/src/binnacle/`, is published to the GitHub Container Registry as `ghcr.io/it-bbox/binnacle/binnacle`, by the owner and by hand, as npm is. It installs `@it-bbox/binnacle` from npm, so publish it after the npm release it needs.

1. **Version.** The feature has its own version, `version` in `devcontainer-feature.json`, apart from npm's. Raise it only when the feature's files change: the patch for a fix, the minor for a new option, the major when an option or a variable it sets is renamed or removed, or a default changes what a container gets. A new npm release alone moves nothing: the `version` option's default, `latest`, takes it at the container's next build. `devcontainer features publish` skips a version already published, so a change without a raised version is never published.
2. **Check.** With `docker` and the dev container CLI (`npm install -g @devcontainers/cli`) installed, `node --test apps/cli/test/devcontainer.live.ts` builds containers with the feature from this checkout and `binn` from npm, so it runs once that npm release is out: `binn` runs, the daemon answers `/health` with its home on the volume, and a container stopped and started again starts its daemon again. Under Docker Desktop on Linux, run it with `TMPDIR` inside the home, such as `TMPDIR=~/.cache/binnacle-live`: its VM mounts nothing from `/tmp`.
3. **Publish.** Sign in to `ghcr.io` with a GitHub token that has `write:packages`, then publish the collection; the CLI tags the version, its minor, its major and `latest`:

```bash
docker login ghcr.io -u <github-user>
devcontainer features publish --registry ghcr.io --namespace it-bbox/binnacle apps/devcontainer-feature/src
```

A package new to `ghcr.io` is private. Where `docker login` cannot store the token, as with a Docker config naming an empty `pass` store, pass it to the CLI instead: `DEVCONTAINERS_OCI_AUTH="ghcr.io|<github-user>|$(gh auth token)" devcontainer features publish …`, after `gh auth refresh -h github.com -s write:packages`.

Once, after the first publish, make `binnacle/binnacle` public in the organisation's packages on GitHub, or no container can pull it; the organisation must allow public packages first, under its *Packages* settings. `devcontainer features info manifest ghcr.io/it-bbox/binnacle/binnacle:1` then prints what was published.

## binn in the Claude Code desktop app

`pnpm setup` puts its global bin directory on PATH in your shell's startup file, such as `~/.bashrc`, which the Claude Code desktop app does not read, so in the desktop app `.mcp.json` cannot find `binn`. Make `binn` visible there with a wrapper script named `binn`, made executable, in a directory already on the app's PATH — `~/.local/bin` on Linux:

```sh
#!/bin/sh
exec "$HOME/.local/share/pnpm/binn" "$@"
```

The path is pnpm's global bin directory, written out because the app has no `$PNPM_HOME` either: take it from `echo $PNPM_HOME` in a shell where pnpm works; on Linux it defaults to `~/.local/share/pnpm`.

A symlink to pnpm's `binn` does not work instead: that file is a shim that finds the CLI relative to its own location, and through a symlink it resolves from the link's directory and finds nothing.

## The repository's `.mcp.json`

The committed `.mcp.json` runs `binn mcp`, so every Claude Code session opened in this repository, in the main checkout or in a worktree, has Binnacle's MCP tools with no per-session setup.

It names the linked `binn`, not a path inside the working tree, on purpose: in a worktree, a path would run that branch's half-finished code, and a broken branch would take the Product session's tools down with it. With the daemon stopped the server still connects, and each tool answers with an error naming `binn daemon start`.
