# ADR-0021: The MCP Server Uses the Official SDK

**Status:** Accepted

## Context

MCP is Binnacle's stable contract with every harness (ADR-0014): the only thing a harness needs to count as supported. Epic 2 serves it over stdio first and Streamable HTTP later (`docs/03-mcp-and-skills.md`).

A tools-only stdio server can be written by hand in a few hundred lines of JSON-RPC, with no dependency. `@modelcontextprotocol/sdk` does the same with 17 direct dependencies at 1.30.0, among them `express`, `hono` and `zod`. `AGENTS.md` asks for the standard library and small focused dependencies first.

## Decision

The MCP server is built on `@modelcontextprotocol/sdk`. The dependency is declared only by the package that serves MCP, not by `packages/core` or `packages/adapters`.

## Rationale

- The protocol moves: four specification versions between November 2024 and November 2025, each adding to what a client may send or expect. A hand-written server would track version negotiation, tool result shapes, cancellation and each client's quirks itself, on the one interface that decides whether a harness works at all.
- The planned second transport is configuration on the SDK and a second implementation without it.
- The small-dependencies rule is about not pulling in more than a job needs. The SDK is the reference implementation of exactly this job.

## Consequences

- `packages/core` stays dependency-free; the SDK and its tree reach only the MCP-serving package and the installed CLI.
- SDK upgrades are how Binnacle follows the protocol. A breaking SDK major is a planned change, not a surprise.
- Binnacle code owns only the tool definitions and their mapping onto daemon operations.
