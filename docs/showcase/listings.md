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
| The official Claude Code plugin marketplace, `claude-plugins-official` | It is the marketplace Claude Code opens with, so the plugin is found without adding a source first. | Submit through the marketplace's submission channel. |
| The official MCP Registry, `registry.modelcontextprotocol.io` | It is the registry other catalogs read, so one entry reaches several. | Publish with the registry's publisher. |
| `mcp.so` | A community catalog people browse for MCP servers. | Submit the entry through its form. |
| Smithery, `smithery.ai` | A directory with installation support, alongside discovery. | Add the server through its flow. |
| `punkpeye/awesome-mcp-servers` | The MCP list developers browse by topic. | Open a pull request with the entry line. |
| `hesreallyhim/awesome-claude-code` | The Claude Code list, where the plugin and skills belong. | Submit the entry in the list's own format. |

After the official registry entry exists, check `pulsemcp.com` and `glama.ai` before submitting anything there: both read public sources, and the entry may appear on its own.

### The Claude Code plugin marketplace

**Target:** the official marketplace Claude Code ships with, `claude-plugins-official`.

**Why:** it is the first place a Claude Code user looks, with no marketplace to add.

**Already satisfied by the public repository:** the plugin's source with its manifest, tracked in the repository, and the marketplace manifest (`apps/cli/.claude-plugin/marketplace.json`); the MCP server `binn mcp` they drive; the README's install path and the Apache-2.0 licence. The npm package carries the `binnacle` and optional `binnacle-mod` plugin manifests beside that marketplace manifest.

**What the owner must do:** submit the plugin through the official marketplace's submission channel, named in Claude Code's plugin documentation. Confirm the channel's current link and fields at submission time; this repository records neither. Paste:

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

**What the owner must do:** run the registry's publisher from the repository root (`mcp-publisher init`, then `mcp-publisher publish`; confirm the current command in the registry's documentation), signing in with the GitHub account that owns `it-bbox`. `init` writes the `server.json` skeleton with the registry's current schema; fill these fields:

```text
Name: io.github.it-bbox/binnacle
Description: A local, provider-agnostic AI Engineering Control Plane: project memory, workflow and observability across coding agents.
Repository: https://github.com/it-bbox/binnacle (source: github)
Package: npm, @it-bbox/binnacle
Version: 0.7.1 (the published version being listed; take it from the release)
Transport: stdio
Arguments: mcp
```

### mcp.so

**Target:** `mcp.so`.

**Why:** a community catalog people browse for MCP servers.

**Already satisfied by the public repository:** the repository link, the description, the tags and the client configuration above.

**What the owner must do:** submit the server through mcp.so's form. Paste:

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

**What the owner must do:** add the server through Smithery's own flow, signed in with the GitHub account that owns `it-bbox`. Paste:

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

**What the owner must do:** submit the entry in the list's own contribution format, which the list documents in its repository. Paste:

```text
- [Binnacle](https://github.com/it-bbox/binnacle) - A local, provider-agnostic AI Engineering Control Plane for Claude Code and other coding agents: project memory, workflow and observability, with a plugin, skills and an MCP server.
```

## What the owner must do, in order

1. Apply the description and the topics from [identity.md](identity.md) in the repository's settings; the listing texts above assume them.
2. Submit the plugin to the official Claude Code marketplace.
3. Publish the entry to the official MCP Registry.
4. Submit to mcp.so and Smithery; check PulseMCP and Glama after the registry entry, and submit only if the entry is missing.
5. Open the two awesome-list pull requests.

No release is needed for any of these. The npm keywords reach the package page with the next release the owner cuts.
