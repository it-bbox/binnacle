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

**Not yet satisfied: the ownership marker.** The registry hosts metadata only, and it verifies an npm package by the `mcpName` field of the package's published `package.json`, which must equal the entry's `name` ([package types, *Ownership verification*](https://modelcontextprotocol.io/registry/package-types#ownership-verification); [quickstart, step 1](https://modelcontextprotocol.io/registry/quickstart)). The manifest the build writes now carries it:

```text
"mcpName": "io.github.it-bbox/binnacle"
```

The published 0.7.1 does not: it was released before the marker, and the registry reads the package on npm, not this repository. So the entry needs a release first: **the owner cuts a release of `@it-bbox/binnacle` carrying `mcpName`, separately from this launch, before publishing to the registry.** Until that release is on npm, `mcp-publisher publish` fails with "Registry validation failed for package". Nothing else on this page waits for it.

**What the owner must do:** once that release is on npm, in an empty directory outside the checkout, so that no `server.json` lands in the repository:

1. Install the publisher, `mcp-publisher`, as the [quickstart, step 3](https://modelcontextprotocol.io/registry/quickstart) says (a release binary or `brew install mcp-publisher`).
2. Save the `server.json` below, with both `version` fields set to that release's version, the one carrying `mcpName`. `mcp-publisher init` writes a skeleton too; replace its contents with this file.
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
3. Cut a release of `@it-bbox/binnacle` whose manifest carries `mcpName`, separately from this launch; 0.7.1 does not.
4. Once that release is on npm, publish the entry to the official MCP Registry.
5. Submit to mcp.so and Smithery; check PulseMCP and Glama after the registry entry, and submit only if the entry is missing.
6. Open the two awesome-list pull requests.

Only the registry entry needs a release, the one in step 3; the other submissions need none. The launch itself releases nothing. The npm keywords reach the package page with that same release.
