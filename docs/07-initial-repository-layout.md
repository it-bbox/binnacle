# Initial Repository Layout

Recommended starting layout:

```text
binnacle/
├── apps/
│   ├── daemon/             # local background service/API
│   ├── dashboard/          # Nuxt UI
│   └── cli/                # binn
├── packages/
│   ├── core/               # entities, state machines, policies
│   ├── mcp/                # MCP server/tools/resources
│   ├── telemetry/          # normalized usage/events
│   └── adapters/           # tracker/harness/git/tool adapters
├── docs/
│   ├── architecture/
│   ├── workflow/
│   ├── operations/
│   └── adr/
├── templates/
│   └── project/
├── AGENTS.md
├── CLAUDE.md
├── CONTEXT.md
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Boundaries

### `packages/core`
No Nuxt/UI dependencies. Core domain objects and deterministic state/policy logic.

### `packages/mcp`
Maps MCP calls to core application services. Keep tools compact and explicit about mutations.

### `packages/telemetry`
Provider-neutral types, provenance and ingestion/query abstractions.

### `packages/adapters`
External-system integration. Avoid leaking GitHub/Claude/etc. types throughout core.

### `apps/daemon`
Composition root, local API, persistence, event dispatch, adapter lifecycle.

### `apps/dashboard`
Nuxt UI consuming daemon API. No direct SQLite access.

### `apps/cli`
Thin client/admin bootstrap layer calling shared services/API where practical.
