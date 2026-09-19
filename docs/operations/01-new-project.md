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

- create `.devcontrol/project.yaml`;
- detect Git remote/tracker;
- register project locally;
- install/configure Binnacle MCP/client integration;
- check required/recommended tools;
- configure telemetry where supported;
- create minimal project documentation hooks/templates;
- never overwrite existing docs without confirmation.

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

Run the upstream setup skill in the project once, then follow the project-design flow:

```text
setup-matt-pocock-skills
        ↓
grill-with-docs
        ↓
to-spec
        ↓
to-tickets
```

Do not make `binn init` secretly execute the interactive grill/spec workflow.

### 6. Product starts

Open a fresh supported coding-agent chat and invoke logical `/product`, then `/daily` or current planning action.

## Installation philosophy

`binn init` should distinguish:

- **required** — Binnacle own pieces;
- **recommended** — context/workflow tooling;
- **optional** — Obsidian or extra Graphify capabilities.

If a third-party tool already exists and is configured, do not reinstall blindly.
