# Installation Checklist

This checklist separates Binnacle requirements from recommended external capabilities. Exact upstream commands should be rechecked during implementation because third-party installers evolve.

`binn init` installs Serena, Graphify and ast-grep when they are missing, after the plan's one yes, with the commands below; it needs `uv` for the first two and `npm` for ast-grep, and names them when they are missing rather than installing them. The table it installs from is in `docs/operations/03-external-tools.md`, *What `binn init` installs*.

In the same plan, after the installs, `binn init` registers the MCP servers of Serena, Context7 and Graphify with every harness it detects, through the harness's own CLI and never in the repository: at user scope with `claude mcp add --scope user`, `codex mcp add` (`~/.codex/config.toml`) and `code --add-mcp` (VS Code's user profile). Graphify's server serves one project's graph, so it is registered at Claude Code's local scope (`~/.claude.json`, for this project only) and printed for the others. opencode, which has no non-interactive command for it, gets each entry printed. A server already registered is left as it is. The commands are in `03-external-tools.md`, *The MCP servers it registers*.

## Installing Binnacle

Binnacle is distributed through npm and requires Node 24 on the user's machine (`ADR-0016`):

```bash
npm i -g @binnacle/cli
```

It runs natively on Linux, macOS and Windows. The daemon is started by `binn daemon start`; installing it as an auto-starting service is not part of v1.

Five environment variables configure it, all read by the daemon from its own environment:

| Variable | Default | Meaning |
| --- | --- | --- |
| `BINNACLE_HOME` | `~/.binnacle` | Where Binnacle keeps the daemon's runtime file, the API token, the store and the tracker credentials file. Point it elsewhere to run a throwaway instance beside the real one. |
| `BINNACLE_PORT` | `7717` | The loopback port the daemon binds. `0` takes an ephemeral port. |
| `BINNACLE_GIT_TIMEOUT_MS` | `5000` | How long one read-only `git` call may take before `project.status` reports Git facts unavailable. Raise it for a repository on a slow filesystem. |
| `BINNACLE_GITHUB_TOKEN` | none | A read-only token for every project whose `tracker.provider` is `github`. |
| `BINNACLE_GITLAB_TOKEN` | none | A read-only token for every project whose `tracker.provider` is `gitlab`. |

### Tracker credentials

A project on GitHub or GitLab issues is read with a read-only token: on GitHub a fine-grained token with Issues read access, on GitLab a token with `read_api` (`docs/operations/04-security-resilience.md`). A public repository needs none.

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

After installation, run once per repository:

```text
/setup-matt-pocock-skills
```

Then use the agreed project-design chain when appropriate:

```text
/grill-with-docs
/to-spec
/to-tickets
```

`binn init` detects an existing installation and never blindly reinstalls: it installs the Matt Pocock Skills Claude Code plugin in its plan when Claude Code is detected and does not list it, and leaves a listed one alone; it never runs `/setup-matt-pocock-skills`, which it names when the project has no Matt Pocock layout (`03-external-tools.md`, *The skill plugins it installs*).

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

Binnacle should record capability availability per harness, not assume one global installation covers every client. `binn init` runs the Claude Code commands above in its plan when Claude Code is detected and does not list the plugin; for any other harness it detects, its Summary points at Ponytail's own install section, which has the commands above.

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

Build/update a project graph from the project root through the installed skill/CLI. Generated output includes a machine-readable graph and architecture report.

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

Recommended Binnacle user setting:

```text
obsidian.vaultPath = <local machine path>
```

Recommended per-project projection:

```text
<Vault>/Projects/<Project>/
```

Graphify-generated material should live under a clearly generated namespace such as `90-Graphify/`.

---

## Telemetry capability check

At project adoption/init, Binnacle should detect the active harnesses and mark telemetry support:

```text
Claude Code   native/available?  yes/no/details
Codex         native/available?  yes/no/details
Gemini CLI    native/available?  yes/no/details
GLM profile   inherited harness telemetry / provider-specific / unknown
Local agent   adapter-specific
```

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
