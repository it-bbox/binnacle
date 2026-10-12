# Installation Checklist

This checklist separates Binnacle requirements from recommended external capabilities. Exact upstream commands should be rechecked during implementation because third-party installers evolve.

`binn init` installs Serena, Graphify and ast-grep when they are missing, after the plan's one yes, with the commands below; it needs `uv` for the first two and `npm` for ast-grep, and names them when they are missing rather than installing them. The table it installs from is in `docs/operations/03-external-tools.md`, *What `binn init` installs*.

In the same plan, after the installs, `binn init` registers the MCP servers of Serena, Context7 and Graphify with every harness it detects, through the harness's own CLI and never in the repository: at user scope with `claude mcp add --scope user`, `codex mcp add` (`~/.codex/config.toml`) and `code --add-mcp` (VS Code's user profile). Graphify's server serves one project's graph, so it is registered at Claude Code's local scope (`~/.claude.json`, for this project only) and printed for the others. opencode, which has no non-interactive command for it, gets each entry printed. A server already registered is left as it is, except Serena in Codex's user file with Claude Code's context, which the plan registers again with Codex's. The commands are in `03-external-tools.md`, *The MCP servers it registers*.

## Installing Binnacle

Binnacle is distributed through npm and requires Node 24 on the user's machine (`ADR-0016`):

```bash
npm i -g @binnacle/cli
```

It runs natively on Linux, macOS and Windows. The daemon is started by `binn daemon start`; installing it as an auto-starting service is not part of v1.

Five environment variables configure it, all read by the daemon from its own environment:

| Variable | Default | Meaning |
| --- | --- | --- |
| `BINNACLE_HOME` | `~/.binnacle` | Where Binnacle keeps the daemon's runtime file, the API token, the store, the tracker credentials file and this machine's settings file. Point it elsewhere to run a throwaway instance beside the real one. |
| `BINNACLE_PORT` | `7717` | The loopback port the daemon binds. `0` takes an ephemeral port. |
| `BINNACLE_GIT_TIMEOUT_MS` | `5000` | How long one read-only `git` call may take before `project.status` reports Git facts unavailable. Raise it for a repository on a slow filesystem. |
| `BINNACLE_GITHUB_TOKEN` | none | A read-only token for every project whose `tracker.provider` is `github`, and for the CI of every project whose Git remote is on `github.com`. |
| `BINNACLE_GITLAB_TOKEN` | none | A read-only token for every project whose `tracker.provider` is `gitlab`. |

### Tracker credentials

A project on GitHub or GitLab issues is read with a read-only token: on GitHub a fine-grained token with Issues read access, on GitLab a token with `read_api` (`docs/operations/04-security-resilience.md`). A public repository needs none.

The snapshot's CI is read with the same token, from the tracker when it is GitHub or GitLab, or else from the project's first GitHub or GitLab Git remote, with the token kept for that remote's host: on `github.com`, `BINNACLE_GITHUB_TOKEN` or the credentials file's `github.com` entry; on any other host, only the credentials file's entry for it, since the environment's token is meant for a declared host. On GitHub the fine-grained token then also needs read access to Actions, Commit statuses and Pull requests: Binnacle reads a commit's GitHub Actions workflow runs and its statuses, since GitHub serves check runs to GitHub Apps only, and no fine-grained token can be given them; GitLab's `read_api` covers its pipelines and merge requests.

For one host, or several, keep the tokens in `credentials.json` in the Binnacle home (`~/.binnacle/credentials.json`): a JSON object keyed by the project's `tracker.host` exactly as its manifest writes it, or by `github.com` or `gitlab.com` when the manifest writes none.

```json
{
  "github.com": "github_pat_…",
  "gitlab.example.com": "glpat-…"
}
```

Make it owner-only (`chmod 600 ~/.binnacle/credentials.json`). A file anyone else can read or write is not read at all, and the snapshot says `tracker.credentials_insecure`. Binnacle reads the file and never writes it.

On every call the daemon takes the provider's variable first, then the host's entry in the file, and otherwise reads anonymously. `GITHUB_TOKEN` and other generic names are not read, and nothing is taken from `gh` or `glab`: their tokens can usually write. A variable is read from the environment the daemon started with, so restart it after changing one; the file is read on every call.

One daemon runs per Binnacle home. `binn daemon status` reports whether one is running and where; `binn daemon stop` stops it. Exit codes are `0` success, `2` usage error, `3` operation failed, `4` daemon unreachable.

---

## Required for Binnacle development

### Node.js

Use **Node.js 24 LTS** for the project baseline.

Verify:

```bash
node --version
```

### pnpm

Use pnpm workspace for the monorepo.

Verify:

```bash
pnpm --version
```

### Git

Verify:

```bash
git --version
```

A GitHub or GitLab remote is recommended for Standard-profile projects, but local Git must remain sufficient for basic operation.

---

## Recommended: Matt Pocock Skills

### Claude Code

Current upstream provides a Claude plugin installation path:

```text
/plugin install mattpocock-skills
```

### Codex and other compatible agents

Current upstream documents:

```bash
npx skills@latest add mattpocock/skills
```

`binn init` runs the same install for you, at user scope, into every harness the `skills` CLI detects, then removes the skills it installed from Claude Code, which has the plugin (`03-external-tools.md`, *The skill plugins it installs*). It skips it when the manifest declares Matt Pocock Skills `false` or it detects no harness. The command above is the way without `binn init`.

`binn init` writes the conventions these skills read in each repository, so no setup skill runs first. Use the agreed project-design chain when appropriate:

```text
/grill-with-docs
/to-spec
/to-tickets
```

`binn init` detects an existing installation and never blindly reinstalls: it installs the Matt Pocock Skills Claude Code plugin in its plan when Claude Code is detected and does not list it, and leaves a listed one alone; in place of `/setup-matt-pocock-skills`, it writes the convention files and the *Agent skills* block where they are missing (`03-external-tools.md`, *The skill plugins it installs*).

---

## Recommended: Ponytail

Ponytail is a coding-policy capability, primarily for minimizing unnecessary complexity.

### Claude Code

Current upstream installation:

```text
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

### Codex

Current upstream installation:

```bash
codex plugin marketplace add DietrichGebert/ponytail
codex plugin add ponytail@ponytail
```

### Gemini CLI

Current upstream installation:

```bash
gemini extensions install https://github.com/DietrichGebert/ponytail
```

Binnacle should record capability availability per harness, not assume one global installation covers every client. `binn init` runs the Claude Code commands above in its plan when Claude Code is detected and does not list the plugin, and, unless the manifest declares Ponytail `false`, with any harness detected, installs Ponytail's skills from `DietrichGebert/ponytail` into every other harness the `skills` CLI detects, at user scope, as it installs Matt Pocock Skills. That is `npx skills add DietrichGebert/ponytail -g -y`, not the Codex plugin or the Gemini extension above, which remain upstream's own install for those harnesses.

---

## Recommended: Serena

Serena is a specialized MCP for semantic/symbol-level code navigation and editing.

Current upstream quick start uses `uv`; `binn init` runs the install when `serena` is not on `PATH`:

```bash
uv tool install -p 3.13 serena-agent
serena init
```

For CLI-based coding agents, Serena supports project auto-detection from current working directory through `--project-from-cwd` when configuring its MCP server.

Binnacle should check Serena health/availability and project activation, but should not proxy Serena's full API.

---

## Recommended: Graphify

Graphify is the Standard-profile architecture/dependency graph provider.

Install base CLI; `binn init` runs this when `graphify` is not on `PATH`:

```bash
uv tool install graphifyy
```

Its MCP server needs the `mcp` extra. `binn init` registers it for this project at Claude Code's local scope, running in an environment of its own:

```bash
claude mcp add --scope local graphify -- uv run --no-project --with 'graphifyy[mcp]' python -m graphify.serve <project>/graphify-out/graph.json
```

Register assistant integrations according to current upstream tooling, for example project-scoped installation where appropriate:

```bash
graphify install --project
```

`binn init` builds the first graph last in its plan, with `graphify-out/` added to `.gitignore` unless Git already ignores it, by running Graphify's code-only extraction from the project root, then its report, neither of which needs an API key or calls a model; after that the daemon keeps it current (`03-external-tools.md`, *The first graph it builds*):

```bash
graphify extract . --code-only --allow-dedup-shrink
graphify cluster-only . --no-label
```

Generated output includes a machine-readable graph and architecture report.

For Obsidian projection, Graphify supports an explicit Obsidian export to an existing vault. Do not make this export canonical storage.

Default project ignore policy should normally exclude:

```text
.scratch/**
node_modules/**
.nuxt/**
.output/**
dist/**
coverage/**
```

Adjust generated/vendor directories per project.

---

## Recommended: Context7

Context7 is for current/version-specific **external** framework/library/API docs.

If already globally configured in Claude/Codex/etc., do not install another copy.

Current local MCP package is:

```text
@upstash/context7-mcp
```

Binnacle should perform a capability check rather than owning the Context7 lifecycle. `binn init` registers it, where a detected harness lacks it, as `npx -y @upstash/context7-mcp` at user scope; an API key, if you have one, is added to that entry by hand.

---

## Recommended: ast-grep

For a Node-centric setup, current upstream supports the command below, which `binn init` runs when `ast-grep` is not on `PATH` (an `sg` is not taken for it):

```bash
npm i @ast-grep/cli -g
```

Verify:

```bash
ast-grep --help
```

Use for structural syntax-aware search/refactoring, not as a replacement for Serena symbol navigation.

---

## Optional: Obsidian

Install the desktop Obsidian application manually for the human-facing knowledge view.

Configuration is machine/user-specific. **Never commit an absolute personal vault path** into shared project configuration.

### The settings file

The vault is named in `settings.json` in the Binnacle home (`~/.binnacle/settings.json`), this machine's own settings, outside every repository. Make it owner-only, as the credentials file (`chmod 600`):

```json
{
  "obsidian": { "vaultPath": "/home/me/Notes" }
}
```

`binn init` proposes the path in its plan, after the `.gitignore` append and before the first graph, when the file names no vault: it reads Obsidian's own list of vaults on this machine (`obsidian.json` in Obsidian's configuration directory: `~/.config/obsidian` on Linux, or its Flatpak's or Snap's; `~/Library/Application Support/obsidian` on macOS; `%APPDATA%\obsidian` on Windows), and with exactly one vault there, the plan writes it to the settings file, owner-only, keeping any other setting the file holds. With none or several it proposes nothing, names those it found and says how to set the path. For another vault than the one proposed, decline the plan and edit the file. A path already set is reported and left alone, and nothing in the repository is written by this step.

The path is absolute, and is the vault's own directory. The daemon reads the file on every poll and every snapshot, so a change takes effect without a restart. No file, or no `obsidian.vaultPath`, means no projection and no attention item.

The same file holds the Parallel limit (ADR-0041), `parallelLimit`: a whole number from 1 to 16, or `"auto"`; 2 when unset. The dashboard's Settings page writes it through the daemon, keeping every other key; a project manifest's `automation.max_parallel_development_tasks` wins for its project.

### The vault projection

With a vault set, the daemon keeps a one-way projection of each registered project under `<Vault>/Projects/<Project>/`, `<Project>` being the manifest's `project.name`, or its id (ADR-0036):

| Folder | Holds |
| --- | --- |
| `Product/` | `roadmap.md`, from `<knowledge.docs>/roadmap.md`; `snapshot.md` and `daily.md`, the last snapshot and daily served |
| `Specs/<slug>/` | `spec.md` and the spec's tickets, from `knowledge.specs` |
| `Decisions/` | the ADRs, from `knowledge.adr` |
| `Research/` | the other Markdown under `knowledge.docs`, as it is laid out there, without the roadmap |
| `90-Graphify/` | `GRAPH_REPORT.md`, Graphify's report of the last successful graph run |

Once a minute it reads each project's default branch, and when the branch has moved, the vault setting changed or the graph was built again, it renders the project again from that commit, read through Git: an uncommitted change in the checkout never reaches the vault. Relative Markdown links between projected files become Obsidian links.

The snapshot and daily notes are written each time a snapshot or a daily is served, from what was served, with no further call to the tracker: their `source` is `project.snapshot` or `daily.get`, their `commit` the caller's HEAD, and a `served:` line gives the time. Both carry *Waiting for the owner*: the unanswered questions, the Tasks waiting for an approval and the `ready-for-human` Tasks ready to start. Their tickets and ADRs link to the projected notes. With no vault set, serving one writes nothing.

`90-Graphify/GRAPH_REPORT.md` is `graphify-out/GRAPH_REPORT.md` in the registered checkout, with the commit of the last successful run. It is rewritten only after a newer successful run, so a failed run leaves it as it was, and a vault set after a failed run gets no report until the next successful one. Without a successful run recorded, without the report, or with `capabilities.graphify: false`, there is no note, and no attention item for it.

Every note it writes starts with frontmatter naming it generated, with its source and commit:

```yaml
---
generated-by: binnacle
source: docs/adr/ADR-0036-the-daemon-maintains-derived-graph-and-vault.md
commit: <hash>
---
```

The daemon writes, rewrites and deletes only files with that marker, so a note of yours beside them, or a file of yours at a generated note's path, is left byte for byte. A generated note whose source is gone from the default branch is removed. Each write is a whole file, through a temporary name and a rename. An edit to a generated note is overwritten at the next refresh, never synced back. The projection is derived: deleting the project's folder loses nothing, and it comes back at the next move of the branch, or at the daemon's next start.

A vault path that does not exist, is not a directory or cannot be written, and a settings file that cannot be read, is the snapshot's attention item `vault.unwritable`.

---

## Telemetry capability check

`binn init` configures the OpenTelemetry export of each detected harness that has one, in its user-scope settings, inside its one plan and after its one confirmation (spec of epic 10, *`binn init`'s telemetry step*). The export points at the daemon's address — the running daemon's, else `http://127.0.0.1:` and `BINNACLE_PORT` or 7717 — as OTLP JSON over HTTP, with prompt logging off:

| Harness | Settings | What the plan adds |
| --- | --- | --- |
| Claude Code | `settings.json` in `CLAUDE_CONFIG_DIR` or `~/.claude`, merged, keeping the rest | `env`: `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_LOGS_EXPORTER=otlp`, `OTEL_EXPORTER_OTLP_PROTOCOL=http/json`, `OTEL_EXPORTER_OTLP_ENDPOINT=<address>` |
| Codex | `config.toml` in `CODEX_HOME` or `~/.codex`, appended | `[otel]` with `exporter = { otlp-http = { endpoint = "<address>/v1/logs", protocol = "json" } }` and `log_user_prompt = false` |
| Gemini CLI | `.gemini/settings.json` in `GEMINI_CLI_HOME` or `~`, merged, keeping the rest | `telemetry`: `enabled: true`, `target: "local"`, `otlpEndpoint: "<address>"`, `otlpProtocol: "http"`, `logPrompts: false` |

OpenTelemetry settings of the harness's own, whether they export elsewhere or nowhere, are left as they are and named in the Summary: Claude Code's `env` with any `OTEL_` variable, Codex's file with an `[otel]` table, Gemini CLI's with a `telemetry` block, unless they are already the export above. A settings file that is not plain JSON, such as one with comments, is not rewritten: the change is printed. With the daemon not running and `BINNACLE_PORT` 0 there is no address, and the step is skipped. A detected harness that cannot export — opencode, and VS Code — is named in the Summary with its reason. `binn audit`'s telemetry readiness reads the same settings and reports, per detected harness, whether it exports to Binnacle (`telemetry.export_<harness>`).

Do not fail project initialization because one provider lacks rich telemetry.

---

## `binn init` expected summary

Example target UX:

```text
Binnacle                       ✓
Git                               ✓
Node 24 LTS                       ✓
pnpm                              ✓
Matt Pocock Skills                ✓ configured / action required
Ponytail                          ✓ / optional action
Serena                            ✓
Graphify                          ✓ / install suggested
Context7                          ✓ already configured
ast-grep                          ✓
Obsidian                          optional / configured path missing
Telemetry: Claude Code            ✓
Telemetry: Codex                  ✓
Telemetry: Gemini                 not configured
Tracker                           GitHub Issues
Automation mode                   MANUAL
```

The setup command explains its actions by showing them as one plan, writes inside the repository and mutations outside it alike, and asks for one confirmation of the whole plan (ADR-0034): Enter accepts it at a terminal, `n` declines it, and without a terminal nothing is written. The questions that are not about a write, such as the history import window, are asked before the plan.
