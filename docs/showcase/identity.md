# The identity strings

The short strings by which Binnacle is found: the one line and the topics the owner applies in the repository's GitHub settings, and the npm package's description and keywords. Epic 24 prepares them; the owner applies them, and nothing here is applied by the repository itself.

## GitHub description

Applied in the repository's settings under *Description*.

```text
A local, provider-agnostic AI Engineering Control Plane: project memory, workflow and observability across coding agents.
```

## GitHub topics and npm keywords

Applied in the repository's settings under *Topics*, and carried as `keywords` by the published `@it-bbox/binnacle` manifest. One list serves both: lowercase words GitHub accepts as topics and npm keeps as keywords.

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

The package's `description` is the same line as the GitHub description, so the package page and the repository say the same thing. `apps/cli/src/manifest.ts` holds both, and `apps/cli/test/manifest.test.ts` fails when either drifts from this file.
