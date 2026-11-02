# The listings

Where people look for tools: the Claude plugin marketplace, MCP directories and awesome lists. This file prepares every submission: the exact target, why it was chosen, the text to paste, what the public repository already satisfies, and the step only the owner can take.

**Nothing here has been submitted.** Every entry is filed by the owner, from the owner's accounts. There is no form to fill in this repository, and this file changes nothing outside it.

## The strings every submission uses

The description is the repository's own line, and the topics are the same list the npm package carries as keywords. Both are the identity strings in [identity.md](identity.md); change one there and here.

```text
A local, provider-agnostic AI Engineering Control Plane: project memory, workflow and observability across coding agents.
```

```text
ai
ai-agents
coding-agents
claude-code
codex
mcp
project-memory
observability
telemetry
developer-tools
workflow
control-plane
```

- **Name:** Binnacle
- **Tagline:** One project memory. Any coding agent.
- **Repository:** https://github.com/it-bbox/binnacle
- **npm:** https://www.npmjs.com/package/@it-bbox/binnacle
- **Site:** https://it-bbox.github.io/binnacle/
- **Licence:** Apache-2.0
- **Install:** `npm i -g @it-bbox/binnacle`, then `binn daemon start`
- **MCP server:** `binn mcp`, over stdio; the client configuration is below.

The MCP client configuration, for any directory that asks how to run the server:

```json
{
  "mcpServers": {
    "binnacle": {
      "type": "stdio",
      "command": "binn",
      "args": ["mcp"]
    }
  }
}
```

The server lists its tools without a daemon; a tool call needs one, which `binn daemon start` starts. The plugin and the mod ship inside the npm package: `binn init` adds the `binnacle` marketplace and installs `binnacle@binnacle`, and the optional mod is installed from the same marketplace with `claude plugin install binnacle-mod@binnacle --scope user`.

## Targets

| Where | Why this one | Owner does |
| --- | --- | --- |
| The official Claude Code plugin marketplace, `claude-plugins-official` | It is the marketplace Claude Code opens with, so the plugin is found without adding a source first. | Nothing yet: it takes no public submissions (below). |
| The official MCP Registry, `registry.modelcontextprotocol.io` | It is the registry other catalogs read, so one entry reaches several. | Publish with the registry's publisher. |
| `mcp.so` | A community catalog people browse for MCP servers. | Open an issue in its repository; the site's form is paid. |
| Smithery, `smithery.ai` | A directory with installation support, alongside discovery. | Nothing yet: it takes a local server only as an MCPB bundle (below). |
| `punkpeye/awesome-mcp-servers` | The MCP list developers browse by topic. | Open a pull request with the entry line. |
| `hesreallyhim/awesome-claude-code` | The Claude Code list, where the plugin and skills belong. | Fill in the list's issue form, by hand. |

After the official registry entry exists, check `pulsemcp.com` and `glama.ai` before submitting anything there: both read public sources, and the entry may appear on its own.

### The Claude Code plugin marketplace

**Target:** the official marketplace Claude Code ships with, `claude-plugins-official`.

**Why:** it is the first place a Claude Code user looks, with no marketplace to add.

**Already satisfied by the public repository:** the plugin's source with its manifest, tracked in the repository, and the marketplace manifest (`apps/cli/.claude-plugin/marketplace.json`); the MCP server `binn mcp` they drive; the README's install path and the Apache-2.0 licence. The npm package carries the `binnacle` and optional `binnacle-mod` plugin manifests beside that marketplace manifest.

**Not submitted, on the owner's decision of 2026-11-02.** `claude-plugins-official` takes plugins from Anthropic's partners only; the public submission form, `https://clau.de/plugin-directory-submission`, adds a plugin to the community marketplace, `claude-community`, after review, and asks for a paid claude.ai plan and a plugin in a GitHub repository ([Publish and distribute a plugin](https://code.claude.com/docs/en/plugins/publish)). If the owner submits there later, paste:

```text
Name: Binnacle
Plugin: binnacle@binnacle
Description: A local, provider-agnostic AI Engineering Control Plane: project memory, workflow and observability across coding agents, through Binnacle's skills and MCP server.
Repository: https://github.com/it-bbox/binnacle
Homepage: https://it-bbox.github.io/binnacle/
Licence: Apache-2.0
Install: binn init, which adds the binnacle marketplace and installs binnacle@binnacle
```

The repository is not itself a marketplace: by design the marketplace ships inside the npm package and `binn init` adds it from there, rather than reading the plugin from the default branch. If the submission channel requires a marketplace hosted in the repository, that is a separate decision for the owner, not something this file prepares.

### The official MCP Registry

**Target:** `registry.modelcontextprotocol.io`.

**Why:** it is the registry other directories read, so a correct entry here is found in more than one place.

**Already satisfied by the public repository:** the stdio server `binn mcp`, published as the `binn` command in the npm package, with the repository and licence the registry asks for.

**Not yet satisfied: the ownership marker.** The registry hosts metadata only, and it verifies an npm package by the `mcpName` field of the package's published `package.json`, which must equal the entry's `name` ([package types, *Ownership verification*](https://modelcontextprotocol.io/registry/package-types#ownership-verification); [quickstart, step 1](https://modelcontextprotocol.io/registry/quickstart)). The manifest the build writes now carries it:

```text
"mcpName": "io.github.it-bbox/binnacle"
```

The published 0.7.1 does not: it was released before the marker, and the registry reads the package on npm, not this repository. So the entry needs a release first: **the owner cuts a release of `@it-bbox/binnacle` carrying `mcpName`, separately from this launch, before publishing to the registry.** Until that release is on npm, `mcp-publisher publish` fails with "Registry validation failed for package". Of the other targets, only the PulseMCP and Glama check, which follows the registry entry, waits for it.

**What the owner must do:** once that release is on npm, in an empty directory outside the checkout, so that no `server.json` lands in the repository:

1. Install the publisher, `mcp-publisher`, as the [quickstart, step 3](https://modelcontextprotocol.io/registry/quickstart) says (a release binary or `brew install mcp-publisher`).
2. Save the `server.json` below, with both `version` fields set to that release's version, the one carrying `mcpName`. `mcp-publisher init` is not needed; if you ran it, replace its output with this file.
3. Run `mcp-publisher login github`, signed in as the GitHub account that owns `it-bbox`: the `io.github.it-bbox/` prefix of the name requires it.
4. Run `mcp-publisher publish`, then check the entry with `curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.it-bbox/binnacle"`.

```json server.json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.it-bbox/binnacle",
  "title": "Binnacle",
  "description": "A local AI Engineering Control Plane: project memory, workflow and observability for coding agents.",
  "repository": {
    "url": "https://github.com/it-bbox/binnacle",
    "source": "github"
  },
  "version": "<the release carrying mcpName>",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@it-bbox/binnacle",
      "version": "<the release carrying mcpName>",
      "runtimeHint": "npx",
      "runtimeArguments": [
        { "type": "positional", "value": "-y" },
        { "type": "positional", "value": "--package" }
      ],
      "packageArguments": [
        { "type": "positional", "value": "binn" },
        { "type": "positional", "value": "mcp" }
      ],
      "transport": {
        "type": "stdio"
      }
    }
  ]
}
```

The description is shorter than the repository's own line: the registry's schema caps it at 100 characters ([`server.schema.json`](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json)).

The arguments follow from how a client runs an npm entry, `npx <runtimeArguments> <identifier>@<version> <packageArguments>`. The package installs two commands, `binn` and `binnd`, so `npx @it-bbox/binnacle mcp` cannot tell which to run. The bare `--package` takes the package the client appends, and `binn mcp` is the command a user runs: the client starts `npx -y --package @it-bbox/binnacle@<version> binn mcp`. The schema has no field naming one of a package's commands yet ([registry issue #1629](https://github.com/modelcontextprotocol/registry/issues/1629)); if one exists at submission time, use it instead. Either way a tool call needs a running daemon, which `binn daemon start` starts.

### mcp.so

**Target:** `mcp.so`.

**Why:** a community catalog people browse for MCP servers.

**Already satisfied by the public repository:** the repository link, the description, the tags and the client configuration above.

**What the owner must do:** the site's own form takes a paid submission only, and paid placement is outside the launch. Open an issue at `https://github.com/chatmcp/mcpso/issues/new` instead, titled `Submit MCP Server: Binnacle`, which is how the catalog takes free submissions. Paste:

```text
Name: Binnacle
Link: https://github.com/it-bbox/binnacle
Description: A local, provider-agnostic AI Engineering Control Plane: project memory, workflow and observability across coding agents.
Tags: ai-agents, coding-agents, claude-code, codex, mcp, project-memory, observability, workflow
Run: npm i -g @it-bbox/binnacle, then binn daemon start; the client runs binn mcp over stdio
```

### Smithery

**Target:** `smithery.ai`.

**Why:** a directory with installation support, alongside discovery.

**Already satisfied by the public repository:** the repository link, the description, the npm package and the stdio command.

**Not submitted yet.** Smithery publishes a local stdio server only as a prebuilt MCPB bundle (`smithery mcp publish ./server.mcpb`, [Publish](https://smithery.ai/docs/build/publish)), not from an npm package or a repository. Building that bundle is work of its own. Once it exists, sign in with the GitHub account that owns `it-bbox` and paste:

```text
Name: Binnacle
Description: A local, provider-agnostic AI Engineering Control Plane: project memory, workflow and observability across coding agents.
Repository: https://github.com/it-bbox/binnacle
Package: @it-bbox/binnacle
Run: binn mcp
```

### punkpeye/awesome-mcp-servers

**Target:** the list at https://github.com/punkpeye/awesome-mcp-servers.

**Why:** the MCP list developers browse by topic; Binnacle is an MCP server.

**Already satisfied by the public repository:** everything the entry links to.

**What the owner must do:** fork the list, add the line under the list's own category and in its own format, which the list documents, and open a pull request. Paste:

```text
- [Binnacle](https://github.com/it-bbox/binnacle) - A local, provider-agnostic AI Engineering Control Plane: project memory, workflow and observability across coding agents.
```

### hesreallyhim/awesome-claude-code

**Target:** the list at https://github.com/hesreallyhim/awesome-claude-code.

**Why:** the Claude Code list, where a plugin with skills belongs.

**Already satisfied by the public repository:** the plugin, its skills and the MCP server they drive.

**What the owner must do:** fill in the list's issue form, `Recommend a Resource`, in the web UI, by hand: the list takes no pull request and no submission made by an agent. Category `Multi-Purpose`. Paste:

```text
- [Binnacle](https://github.com/it-bbox/binnacle) - A local, provider-agnostic AI Engineering Control Plane for Claude Code and other coding agents: project memory, workflow and observability, with a plugin, skills and an MCP server.
```

## What the owner must do, in order

1. Apply the description and the topics from [identity.md](identity.md) in the repository's settings; the listing texts above assume them.
2. Open the mcp.so issue.
3. Open the `punkpeye/awesome-mcp-servers` pull request and fill in the `hesreallyhim/awesome-claude-code` form.
4. Later, each when its condition is met: the community plugin marketplace, if the owner decides to submit; Smithery, once an MCPB bundle exists.
5. Cut a release of `@it-bbox/binnacle` whose manifest carries `mcpName`, separately from this launch; 0.7.1 does not.
6. Once that release is on npm, publish the entry to the official MCP Registry.
7. Check PulseMCP and Glama after the registry entry, and submit there only if the entry is missing.

Steps 1 to 4 need no release. Only the registry entry, and the check after it, wait on the release in step 5; the launch itself releases nothing. The npm keywords reach the package page with that same release.
