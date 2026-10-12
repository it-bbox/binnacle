# New Project Bootstrap

## User workflow

The short path, as the README gives it:

```text
git init
    ↓
binn init
    ↓
/binnacle:roadmap
    ↓
/binnacle:product
```

### 1. Create repository

Run `git init`, and choose a GitHub/GitLab remote where appropriate.

### 2. Initialize Binnacle

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

### 3. From a vision to a roadmap

Run `/binnacle:roadmap` (`binnacle-roadmap` in another harness). It reads `<knowledge.docs>/vision.md`; when there is none, it asks what the project is, for whom and what it leaves out, one question at a time, and writes the vision in the owner's words on their yes. It then proposes the epics in dependency order, each with a line of scope, and on the owner's yes writes the roadmap's rows, its `## Epics` section and a Next action that grills the first epic, and commits only those files, never pushing. It needs no daemon. Run again, it proposes additions and reorders among the epics not started, and never touches a `done` epic or a row that links a spec.

### 4. Product starts

Open a fresh supported coding-agent chat and invoke logical `/product`, then `/daily` or current planning action. In Claude Code these are `/binnacle:product` and `/binnacle:daily`. The Next action the roadmap skill wrote grills the first epic.

### 5. Each epic

`binn init` has written the conventions the upstream setup skill would write, so each epic the roadmap lists follows the project-design flow, starting from the Next action:

```text
grill-with-docs
        ↓
to-spec
        ↓
to-tickets
```

Each ticket is then worked in a session of its own with `/binnacle:task run <ticket>`. Do not make `binn init` secretly execute the interactive grill/spec workflow.

### Workflow tools

`binn init` installs or verifies the recommended Standard profile:

- Matt Pocock Skills;
- Ponytail;
- Serena;
- Graphify;
- Context7;
- ast-grep;
- optional Obsidian integration.

## Installation philosophy

`binn init` should distinguish:

- **required** — Binnacle own pieces;
- **recommended** — context/workflow tooling;
- **optional** — Obsidian or extra Graphify capabilities.

If a third-party tool already exists and is configured, do not reinstall blindly.
