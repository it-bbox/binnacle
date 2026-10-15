# Installation Checklist

_Русская версия: [05-installation-checklist.ru.md](05-installation-checklist.ru.md)._

From a clean machine to a running daemon, its dashboard and a first project, with a check after each step. To develop Binnacle from a checkout instead, see [CONTRIBUTING.md](../../CONTRIBUTING.md#from-this-repository).

## 1. Prerequisites

| Tool | Needed for | Check |
| --- | --- | --- |
| Node.js 24 | Binnacle runs on it | `node --version` |
| npm | Installing Binnacle; Context7 and ast-grep | `npm --version` |
| Git | Every project | `git --version` |
| `uv` | Optional: Serena and Graphify | `uv --version` |

npm ships with Node.js. `binn init` never installs `uv`; without it, it names the command that does, and leaves Serena and Graphify out ([External tools](03-external-tools.md#what-binn-init-installs)). A GitHub or GitLab remote is recommended, but local Git is enough.

## 2. Install Binnacle

```bash
npm i -g @it-bbox/binnacle
binn --version
```

`binn --version` prints the version installed, such as `0.1.0`. The one package holds `binn`, its daemon `binnd`, the dashboard and the `binnacle` plugin, with no dependency to download (ADR-0044). It runs on Linux, macOS and Windows.

For a one-off look without installing, such as `binn audit`, run `npx -p @it-bbox/binnacle binn audit`. Without `-p`, npx would run another author's package named `binn`. The rest of this checklist assumes the install.

## 3. Start the daemon

```bash
binn daemon start
binn daemon status
```

`binn daemon status` says the daemon is running, prints its `address`, `http://127.0.0.1:7717` by default, and whether autostart is on. One daemon runs per Binnacle home; `binn daemon stop` stops it.

To start it at login, `binn init` asks, yes by default, and `binn daemon autostart on` turns it on at any time (ADR-0043). It goes through your own service manager:

| Platform | Service |
| --- | --- |
| Linux | a systemd user unit |
| macOS | a LaunchAgent |
| Windows | a Task Scheduler task at logon |

`binn daemon autostart off` turns it off. `binn daemon autostart`, with no argument, says whether it is on, off or broken, and for which Binnacle home.

The service starts the daemon with `BINNACLE_HOME` and `PATH` only, so a tracker token kept in your shell, `BINNACLE_GITHUB_TOKEN` or `BINNACLE_GITLAB_TOKEN`, does not reach it. When `binn daemon autostart on` installs or repairs the service, or `binn init` turns it on, while such a variable is set and `credentials.json` holds no token for that tracker, it warns you, and `binn init` repeats the warning in its Summary. Put the token in the credentials file, as [Tracker credentials](#tracker-credentials) says. The warning names the variable and the file's key, never the token, and Binnacle copies the token nowhere.

## 4. Open the dashboard

```bash
binn dashboard
```

It opens the dashboard in the default browser, already authorised, and prints its address without the token. `binn dashboard --print` prints the address with the token, and opens nothing. After the first time, the plain address works as a bookmark in that browser.

## 5. Set up a project

In a Git repository, run `binn init`: one plan of everything it sets up, confirmed once. Then check:

```bash
binn project list
binn call project_detect
```

The first lists the repository; the second prints it as Binnacle's MCP tools see it. With the daemon stopped, init leaves the registration out, and `binn project register` adds it. What init sets up, step by step: [New project](01-new-project.md#2-set-it-up-with-binn-init) and [Existing project](02-existing-project-adopt.md#the-plan-item-by-item).

### When a harness cannot find binn

A harness that answers `command not found` for `binn` does not have npm's global bin directory on its `PATH`. `npm prefix -g` prints npm's global prefix:

| Platform | `binn` is |
| --- | --- |
| Linux, macOS | `<prefix>/bin/binn` |
| Windows | `<prefix>\binn.cmd` |

The Claude Code desktop app reads no shell startup file, such as `~/.bashrc`, so a `PATH` set there does not reach it. Put a wrapper script named `binn`, made executable, in a directory already on the app's `PATH`, `~/.local/bin` on Linux, with the prefix written out:

```sh
#!/bin/sh
exec "<prefix>/bin/binn" "$@"
```

A checkout's development link runs `binn` through pnpm instead: see [CONTRIBUTING.md](../../CONTRIBUTING.md#binn-in-the-claude-code-desktop-app), *binn in the Claude Code desktop app*.

## Upgrading

1. `binn daemon stop`: a running daemon would keep the old version until it restarts.
2. `npm i -g @it-bbox/binnacle@latest` replaces the CLI, the daemon, the dashboard and the plugin together.
3. `binn daemon start`, then `binn --version` prints the new version.
4. When `claude plugin list --json` lists `binnacle@binnacle`, run `claude plugin marketplace update binnacle`, then `claude plugin update binnacle@binnacle`, so that Claude Code takes the new skills. A session opened after this step has them.
5. Run `binn init` again in a project to reinstall Binnacle's skills into every other harness. `binn audit` reports them while they are stale.

## Configuration

### Environment variables

The daemon reads all five from its own environment, so restart it after changing one. With autostart on, the service starts the daemon with `BINNACLE_HOME` and `PATH` only: the others do not reach it, so keep tracker tokens in the credentials file.

| Variable | Default | Meaning |
| --- | --- | --- |
| `BINNACLE_HOME` | `~/.binnacle` | Where Binnacle keeps the daemon's runtime file, the API token, the store, the tracker credentials and this machine's settings. Point it elsewhere for a throwaway instance beside the real one. |
| `BINNACLE_PORT` | `7717` | The loopback port the daemon binds. `0` takes an ephemeral port. |
| `BINNACLE_GIT_TIMEOUT_MS` | `5000` | How long one read-only `git` call may take before `project.status` reports Git facts unavailable. Raise it on a slow filesystem. |
| `BINNACLE_GITHUB_TOKEN` | none | A read-only token for every project whose `tracker.provider` is `github`, and for the CI of every project whose Git remote is on `github.com`. |
| `BINNACLE_GITLAB_TOKEN` | none | A read-only token for every project whose `tracker.provider` is `gitlab`, and for the CI of every project whose Git remote is on `gitlab.com`. |

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | success |
| `2` | usage error |
| `3` | operation failed |
| `4` | daemon unreachable |

### Tracker credentials

A project on GitHub or GitLab issues is read with a read-only token; a public repository needs none. The scopes are in [Security and resilience](04-security-resilience.md#tracker-credentials).

The snapshot's CI is read with the same token: from the tracker when it is GitHub or GitLab, or else from the project's first GitHub or GitLab remote. A remote's host gets the token kept for it:

- on `github.com` or `gitlab.com`, the provider's variable or the credentials file's entry for that host;
- on any other host, only the credentials file's entry for it, since an environment token is meant for a declared host.

For one host or several, keep the tokens in `credentials.json` in the Binnacle home. It is a JSON object keyed by the project's `tracker.host` as its manifest writes it, or by `github.com` or `gitlab.com` when the manifest writes none:

```json
{
  "github.com": "github_pat_…",
  "gitlab.example.com": "glpat-…"
}
```

- Make it owner-only: `chmod 600 ~/.binnacle/credentials.json`. A file anyone else can read or write is not read at all, and the snapshot says `tracker.credentials_insecure`.
- Binnacle reads the file on every call, and never writes it.
- On every call the daemon takes the provider's variable first, then the host's entry in the file, and otherwise reads anonymously.
- `GITHUB_TOKEN` and other generic names are not read, and nothing is taken from `gh` or `glab`: their tokens can usually write.

## Optional: Obsidian

Install the Obsidian desktop app yourself, for a human-facing view of the project. Its configuration is this machine's: **never commit an absolute vault path** into a project's shared configuration.

### The settings file

The vault is named in `settings.json` in the Binnacle home, `~/.binnacle/settings.json`, outside every repository. Make it owner-only, as the credentials file:

```json
{
  "obsidian": { "vaultPath": "/home/me/Notes" }
}
```

The path is absolute: the vault's own directory. The daemon reads the file on every poll and every snapshot, so a change needs no restart. No file, or no `obsidian.vaultPath`, means no projection and no attention item.

`binn init` proposes the path, when the file names none, from Obsidian's own list of vaults, `obsidian.json` in Obsidian's configuration directory:

| Platform | Directory |
| --- | --- |
| Linux | `~/.config/obsidian`, or its Flatpak's or Snap's |
| macOS | `~/Library/Application Support/obsidian` |
| Windows | `%APPDATA%\obsidian` |

- With exactly one vault there, the plan writes it to the settings file, owner-only, keeping the file's other settings.
- With none or several, it proposes nothing, names those it found and says how to set the path.
- For another vault than the one proposed, decline the plan and edit the file.
- A path already set is reported and left alone. This step writes nothing in the repository.

The same file holds the Parallel limit, `parallelLimit` (ADR-0041): a whole number from 1 to 16, or `"auto"`; 2 when unset. The dashboard's Settings page writes it through the daemon, keeping every other key. A project manifest's `automation.max_parallel_development_tasks` wins for its project.

### The vault projection

With a vault set, the daemon keeps a one-way projection of each registered project under `<Vault>/Projects/<Project>/`, `<Project>` being the manifest's `project.name`, or its id (ADR-0036):

| Folder | Holds |
| --- | --- |
| `Product/` | `roadmap.md`, from `<knowledge.docs>/roadmap.md`; `snapshot.md` and `daily.md`, the last snapshot and daily served |
| `Specs/<slug>/` | `spec.md` and the spec's tickets, from `knowledge.specs` |
| `Decisions/` | the ADRs, from `knowledge.adr` |
| `Research/` | the other Markdown under `knowledge.docs`, as it is laid out there, without the roadmap |
| `90-Graphify/` | `GRAPH_REPORT.md`, Graphify's report of the last successful graph run |

Once a minute it reads each project's default branch. When the branch has moved, the vault setting changed or the graph was built again, it renders the project again from that commit, read through Git: an uncommitted change never reaches the vault. Relative Markdown links between projected files become Obsidian links.

The snapshot and daily notes are written each time one is served, from what was served, with no further call to the tracker:

- their `source` is `project.snapshot` or `daily.get`, their `commit` the caller's HEAD, and a `served:` line gives the time;
- both carry *Waiting for the owner*: the unanswered questions, the Tasks waiting for an approval, and the `ready-for-human` Tasks ready to start;
- their tickets and ADRs link to the projected notes;
- with no vault set, serving one writes nothing.

`90-Graphify/GRAPH_REPORT.md` is the registered checkout's `graphify-out/GRAPH_REPORT.md`, with the commit of the last successful run. Only a newer successful run rewrites it, so a failed run leaves it as it was, and a vault set after a failed run gets no report until the next successful one.

Without a successful run recorded, without the report, or with `capabilities.graphify: false`, there is no note and no attention item for it.

Every note it writes starts with frontmatter naming it generated, with its source and commit:

```yaml
---
generated-by: binnacle
source: docs/adr/ADR-0036-the-daemon-maintains-derived-graph-and-vault.md
commit: <hash>
---
```

- The daemon writes, rewrites and deletes only files with that marker: a note of yours beside them, or a file of yours at a generated note's path, is left byte for byte.
- A generated note whose source is gone from the default branch is removed.
- Each write is a whole file, through a temporary name and a rename.
- An edit to a generated note is overwritten at the next refresh, never synced back.
- Deleting the project's folder loses nothing: it comes back at the next move of the branch, or at the daemon's next start.

A vault path that does not exist, is not a directory or cannot be written, or a settings file that cannot be read, is the snapshot's attention item `vault.unwritable`.

## Telemetry export

`binn init` configures the OpenTelemetry export of each detected harness that has one, in its user-scope settings, as an item of its one plan. The export goes to the daemon's address, as OTLP JSON over HTTP, with prompt logging off. The address is the running daemon's, or else `http://127.0.0.1:` with `BINNACLE_PORT` or 7717.

| Harness | Settings | What the plan adds |
| --- | --- | --- |
| Claude Code | `settings.json` in `CLAUDE_CONFIG_DIR` or `~/.claude`, merged, keeping the rest | `env`: `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_LOGS_EXPORTER=otlp`, `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`, `OTEL_EXPORTER_OTLP_ENDPOINT=<address>` |
| Codex | `config.toml` in `CODEX_HOME` or `~/.codex`, appended | `[otel]` with `exporter = { otlp-http = { endpoint = "<address>/v1/logs", protocol = "json" } }` and `log_user_prompt = false` |
| Gemini CLI | `.gemini/settings.json` in `GEMINI_CLI_HOME` or `~`, merged, keeping the rest | `telemetry`: `enabled: true`, `target: "local"`, `otlpEndpoint: "<address>"`, `otlpProtocol: "http"`, `logPrompts: false` |

- A harness's own OpenTelemetry settings, exporting elsewhere or nowhere, are left as they are and named in the Summary: Claude Code's `env` with any `OTEL_` variable, Codex's `[otel]` table, Gemini CLI's `telemetry` block.
- A settings file that is not plain JSON, such as one with comments, is not rewritten: the change is printed.
- With the daemon not running and `BINNACLE_PORT` 0, there is no address, and the step is skipped.
- A detected harness that exports nothing Binnacle receives, opencode, ZCode, Antigravity, pi or VS Code, is named in the Summary with its reason.

`binn audit` reads the same settings and reports, per detected harness, whether it exports to Binnacle (`telemetry.export_<harness>`). A harness without rich telemetry never fails a project's setup.
