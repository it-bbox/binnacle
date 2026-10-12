# New Project Bootstrap

## User workflow

### 1. Discovery outside Binnacle

Discuss product idea, architecture direction and stack. Produce initial Markdown docs.

### 2. Create repository

Initialize Git and choose GitHub/GitLab remote where appropriate.

### 3. Initialize Binnacle

Target command:

```bash
binn init
```

Expected responsibilities:

- create `.binnacle/project.yaml`;
- detect Git remote/tracker;
- register project locally;
- install/configure Binnacle MCP/client integration;
- check required/recommended tools;
- register the Binnacle MCP server in the config of every detected harness;
- configure telemetry where supported;
- report how much harness session history was found and how far back it goes, then ask how much to import: a number of days, 90 by default, or everything;
- create minimal project documentation hooks/templates;
- never overwrite an existing file, and extend one only by a section shown in the plan it asks to confirm once (ADR-0034).

### 4. Install/verify workflow tools

Recommended Standard profile:

- Matt Pocock Skills;
- Ponytail;
- Serena;
- Graphify;
- Context7;
- ast-grep;
- optional Obsidian integration.

### 5. Matt Pocock project setup

`binn init` has written the conventions the upstream setup skill would write, so follow the project-design flow:

```text
grill-with-docs
        ↓
to-spec
        ↓
to-tickets
```

Do not make `binn init` secretly execute the interactive grill/spec workflow.

### 6. Product starts

Open a fresh supported coding-agent chat and invoke logical `/product`, then `/daily` or current planning action. In Claude Code these are `/binnacle:product` and `/binnacle:daily`.

## Installation philosophy

`binn init` should distinguish:

- **required** — Binnacle own pieces;
- **recommended** — context/workflow tooling;
- **optional** — Obsidian or extra Graphify capabilities.

If a third-party tool already exists and is configured, do not reinstall blindly.
