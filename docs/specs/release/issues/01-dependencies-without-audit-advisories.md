# 01: Dependencies without the audit's advisories

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/release/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** the shipped code carries no known high advisory, and the build tooling none that a fixed release removes (spec, *The MCP SDK*, *Nuxt's tooling*; the audit, findings 2 and 4). `@modelcontextprotocol/sdk` goes to the latest 1.x at or above 1.31.0 (GHSA-6qxp-vccf-f47h). Nuxt and its tooling go to the latest releases that fix the advisories in `simple-git`, `shell-quote`, `node-forge`, `braces`, `source-map-js` and `esbuild`, without changing the dashboard's major versions. What stays open is listed in the security and resilience guide, each advisory with why it is kept.

- [ ] `pnpm audit --prod` reports no high or critical advisory.
- [ ] `pnpm audit` reports no critical or high advisory that a fixed release of a direct dependency removes; each one left is listed in `docs/operations/04-security-resilience.md` with its reason.
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm dashboard:generate` pass, and `binn mcp` still serves Binnacle's tools.
