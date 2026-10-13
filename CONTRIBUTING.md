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
│   └── cli/
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

The daemon also serves a read-only dashboard at its own address, `http://127.0.0.1:7717/` by default. Generate it once in the main checkout with `pnpm dashboard:generate`, and again after pulling a change to `apps/dashboard`; until then the address answers with a page naming that command. `binn dashboard` opens the dashboard in the default browser, already authorised, and `binn dashboard --print` prints its address without opening anything. After the first time, the plain address works as a bookmark in that browser.

### After a pull or a merge

The link runs the CLI out of the main checkout, with that checkout's `node_modules`. So after pulling or merging a change that touches the workspace — a new package, a changed dependency, `pnpm-lock.yaml` — run `pnpm install` in the main checkout again. Until then a package the CLI now imports is missing there, `binn` fails with `ERR_MODULE_NOT_FOUND`, and every session's MCP tools go with it. Installing in a worktree does not help: each checkout has its own `node_modules`.

Once `binn init` has installed the `binnacle` plugin, Claude Code loads that installed `binnacle@binnacle` here, not the skills in `.claude/skills/binnacle/`, so a merged change to those skills does not reach a new session by itself. After pulling or merging one, run in the main checkout the first command below, and the other two only when `claude plugin list --json` lists `binnacle@binnacle`:

```bash
pnpm --filter @binnacle/cli run prepare
claude plugin marketplace update binnacle
claude plugin update binnacle@binnacle
```

The first copies the skills into the CLI package and gives the plugin a version drawn from the plugin's files, so it changes whenever a skill does; the other two have Claude Code update its copy to that version. Every other harness runs the `binnacle-<action>` copy the first command also writes, so when `~/.agents/skills` holds a `binnacle-*` skill, reinstall that copy too, and take it back out of Claude Code, naming after `claude-code` any harness you keep it out of with `binn init --skip-harness`:

```bash
npx skills add ./apps/cli/skills -g -y
npx skills remove -g -a claude-code -s $(ls apps/cli/skills) -y
```

A new session then loads the changed skills. `/binnacle:autopilot` does this itself once, after the last merge of a run whose merges changed them.

## Checking a change

`pnpm typecheck` and `pnpm test` check a change. `pnpm test` is offline; the live tests run apart with `pnpm test:live`: the adapters', which need read-only tokens, and the autostart one, which installs a real service and so runs only where `CI` is set. CI runs the typecheck and the tests in GitHub Actions on every push to `main` and every pull request (`.github/workflows/ci.yml`), without any secret, so without the adapters' live tests, and the live autostart test with the real service manager on Linux, macOS and Windows runners.

## binn in the Claude Code desktop app

`pnpm setup` puts its global bin directory on PATH in your shell's startup file, such as `~/.bashrc`, which the Claude Code desktop app does not read, so in the desktop app `.mcp.json` cannot find `binn`. Make `binn` visible there with a wrapper script named `binn`, made executable, in a directory already on the app's PATH — `~/.local/bin` on Linux:

```sh
#!/bin/sh
exec "$HOME/.local/share/pnpm/binn" "$@"
```

The path is pnpm's global bin directory, written out because the app has no `$PNPM_HOME` either: take it from `echo $PNPM_HOME` in a shell where pnpm works; on Linux it defaults to `~/.local/share/pnpm`. A symlink to pnpm's `binn` does not work instead: that file is a shim that finds the CLI relative to its own location, and through a symlink it resolves from the link's directory and finds nothing.

## The repository's `.mcp.json`

The committed `.mcp.json` runs `binn mcp`, so every Claude Code session opened in this repository, in the main checkout or in a worktree, has Binnacle's MCP tools with no per-session setup. It names the linked `binn` and not a path inside the working tree on purpose: in a worktree, a path would run that branch's half-finished code, and a broken branch would take the Product session's tools down with it. With the daemon stopped the server still connects, and each tool answers with an error naming `binn daemon start`.
