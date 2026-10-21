# 02: The daemon's messages carry their values, worded in Russian in one place

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/human-output/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** every message the daemon gives a person's surface can be worded in Russian from its code (spec, *Attention items and errors carry their values*, *One Russian wording of the daemon's codes*). A diagnostic, `{ code, message }`, gains an optional `params`: the values its English message is written from, Task ids, paths, numbers and names, as strings and numbers. An error envelope and each of its details gain the same, and every message that reaches a person has a code. The field is additive: MCP tools, `--json` and `binn call` keep every field they had, in English. `@binnacle/core` holds the Russian wording of every code, as pure functions from `params` to a sentence, with the terms of the spec's list; a code it does not know, or `params` it cannot use, gives the English message, marked as such by the caller. `CONTEXT.md` gains the Russian word beside each term, and `docs/03-mcp-and-skills.md` describes `params`.

- [ ] Through the daemon's snapshot and HTTP tests: attention items and errors carry `params`, and every other field is as before.
- [ ] A test over the daemon's and core's sources, as the dashboard's type-scale test reads its sources, finds every code they emit and fails when core has no Russian wording for one.
- [ ] Each wording is checked with its `params`; an unknown code and unusable `params` fall back to the English message.
- [ ] `@binnacle/core` keeps no runtime dependency (its purity test).
- [ ] `CONTEXT.md` gives each term's Russian word, the spec's list.
