# Installation Checklist

This checklist separates Binnacle requirements from recommended external capabilities. Exact upstream commands should be rechecked during implementation because third-party installers evolve.

## Installing Binnacle

Binnacle is distributed through npm and requires Node 24 on the user's machine (`ADR-0016`):

```bash
npm i -g @binnacle/cli
```

It runs natively on Linux, macOS and Windows. The daemon is started by `binn daemon start`; installing it as an auto-starting service is not part of v1.

Two environment variables configure it:

| Variable | Default | Meaning |
| --- | --- | --- |
| `BINNACLE_HOME` | `~/.binnacle` | Where Binnacle keeps the daemon's runtime file, the API token and the store. Point it elsewhere to run a throwaway instance beside the real one. |
| `BINNACLE_PORT` | `7717` | The loopback port the daemon binds. `0` takes an ephemeral port. |

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

`binn init` should detect existing installation/configuration and must not blindly reinstall or silently run the interactive workflow.

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

Binnacle should record capability availability per harness, not assume one global installation covers every client.

---

## Recommended: Serena

Serena is a specialized MCP for semantic/symbol-level code navigation and editing.

Current upstream quick start uses `uv`:

```bash
uv tool install -p 3.13 serena-agent
serena init
```

For CLI-based coding agents, Serena supports project auto-detection from current working directory through `--project-from-cwd` when configuring its MCP server.

Binnacle should check Serena health/availability and project activation, but should not proxy Serena's full API.

---

## Recommended: Graphify

Graphify is the Standard-profile architecture/dependency graph provider.

Install base CLI:

```bash
uv tool install graphifyy
```

If separate Graphify MCP serving is wanted:

```bash
uv tool install "graphifyy[mcp]"
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

Binnacle should perform a capability check rather than owning the Context7 lifecycle.

---

## Recommended: ast-grep

For a Node-centric setup, current upstream supports:

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

The setup command should explain actions and require confirmation for mutations outside the repository.
