# 01: Dependencies without the audit's advisories

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/release/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** the shipped code carries no known high advisory, and the build tooling none that a fixed release removes (spec, *The MCP SDK*, *Nuxt's tooling*; the audit, findings 2 and 4). `@modelcontextprotocol/sdk` goes to the latest 1.x at or above 1.31.0 (GHSA-6qxp-vccf-f47h). Nuxt and its tooling go to the latest releases that fix the advisories in `simple-git`, `shell-quote`, `node-forge`, `braces`, `source-map-js` and `esbuild`, without changing the dashboard's major versions. What stays open is listed in the security and resilience guide, each advisory with why it is kept.

- [x] `pnpm audit --prod` reports no high or critical advisory.
- [x] `pnpm audit` reports no critical or high advisory that a fixed release of a direct dependency removes; each one left is listed in `docs/operations/04-security-resilience.md` with its reason.
- [x] `pnpm typecheck`, `pnpm test` and `pnpm dashboard:generate` pass, and `binn mcp` still serves Binnacle's tools.

## Comments

### Decisions

- **Versions.** `@modelcontextprotocol/sdk` ^1.32.1, the latest 1.x; `nuxt` ^4.6.1, `@nuxt/ui` ^4.11.3 and `vue-tsc` ^3.3.13, each the latest of its major. `pnpm update -r vue shell-quote source-map-js launch-editor` then took the fixed transitive releases inside their ranges: `shell-quote` 1.12.0 and `source-map-js` 1.2.2 (through `vue` 3.5.44). No dependency was added, and no `pnpm.overrides`: the ticket asks for releases of the direct dependencies, not forced transitive versions.
- **What stays open** is the table under *Open dependency advisories* in `docs/operations/04-security-resilience.md`: `simple-git` (through `@nuxt/devtools` 3, whose fix is only in devtools 4's betas), `node-forge` and `braces` (no fixed release exists) and the low `esbuild` (through `@nuxt/ui` → `@nuxt/fonts` 0.14). All are in the dashboard's build tooling. Ticket 06, which reworks that guide and gives it a Russian twin, keeps the table.
- **No new test**: the spec covers the SDK upgrade with the existing offline tests of `packages/mcp` and `binn mcp`. `binn mcp`, against a temporary daemon, listed its eight tools and answered a `project_detect` call.
- **The roadmap-rules test, fixed here on the owner's word.** `apps/cli/test/pack.test.ts` near line 804 asserted a sentence of `docs/roadmap.md` that `main`'s commit 1bd17ee ("Roadmap: lists and tables in place of long paragraphs") rewrote, so the suite failed on `main` as on this branch. The owner chose, in autopilot's chat, to fix it in this branch, outside the ticket's original scope: the assertion now matches the rule's current wording under `### Who writes what`, and checks the same rule. No other test and not the roadmap changed.

### Review

A sub-agent reviewed the branch against `main` on both axes and the Security role.

**Standards: no violation.** The commit message and authorship follow `AGENTS.md`; no dependency was added.

1. **`Status:` was still `READY`.** **Fixed**: this ticket's last commit.

**Spec:** criteria 1 and 2 hold; each advisory left open was re-checked against the registry (Nuxt 4.6.1 and Nuxt UI 4.11.3 are the latest; no patched `node-forge` or `braces`).

1. **The guide said `@nuxt/devtools` 4's betas take `simple-git` 4; they drop `simple-git` altogether.** **Fixed**: the table's row says so.
2. **The one failing test** was `main`'s, see Decisions. **Fixed** in this branch on the owner's word, outside the ticket's original scope.

#### Security

1. No secret in the change; every lockfile entry has an integrity and comes from registry.npmjs.org.
2. The advisories left open are confined to build tooling: `apps/dashboard` is private and no shipped package depends on it; Nuxt is a devDependency.
3. The SDK upgrade keeps the same dependency set; `packages/mcp` uses only `McpServer` and `StdioServerTransport`, so the stdio server's behaviour is unchanged.
4. **Transitive `@nuxt/cli` moved from 3 to 4**, which Nuxt 4.6.1 requires; its new small dependencies come from Nuxt's own maintainers. **Kept**: the dashboard's own major versions are unchanged.

Typecheck is clean (root and the dashboard's `nuxt typecheck`), the full suite passes, `pnpm dashboard:generate` passes, and `pnpm audit --prod` reports one low advisory, `esbuild`.
