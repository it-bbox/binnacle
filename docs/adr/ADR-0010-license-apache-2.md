# ADR-0010: Apache-2.0 License

**Status:** Accepted

## Context

Binnacle is published as open source and is intended to be used by people other than its author, on their own machines and their own projects. No licence was chosen before the repository was created, and a licence change after contributors appear is expensive and sometimes impossible.

## Decision

Licence the project under **Apache-2.0**. `LICENSE` holds the licence text verbatim, including its appendix. `package.json` declares `"license": "Apache-2.0"`.

## Rationale

- The explicit patent grant matters for a tool that integrates with the APIs of many vendors.
- The licence is acceptable inside companies, and companies are exactly where the token-spend problem Binnacle addresses is felt most.
- AGPL would deter that audience; MIT is shorter but grants no patent rights.

## Consequences

- Published packages are scoped `@binnacle/*`; the monorepo root stays `"private": true` and is never published.
- Contributions arrive under Apache-2.0 by default; no separate CLA is introduced in v1.
