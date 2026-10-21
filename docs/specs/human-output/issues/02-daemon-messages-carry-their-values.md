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

## Comments

### Decisions

- **A code worded in several ways carries `kind`**, a token naming which of its English sentences it is (`tracker.unavailable`'s `token`, `manifest`, `repository`…, `roadmap.missing`'s `docs`, `path`, `manifest`), where no value tells them apart. A value the English writes as an English phrase travels as written and is mapped to Russian by a table in core: a shape (`got: 'a list'`), what a forge lists (`what`), whether a token was used (`token: 'used' | 'none'`), a state machine's `entity`. A value outside its table, like a missing value, makes the params unusable: the English, marked.
- **Every detail of an error has a `code` and `params`**, so that every message that reaches a person has a code: the manifest's problems and warnings (`ManifestProblem` gains both) and the daemon's request checks share `expected.*` codes (`expected.non_empty_string`, `expected.one_of`, `expected.absolute_path`…), with `manifest.unknown_key`, `manifest.unknown_language`, `yaml.syntax` and `project.shared_id`. `request.invalid` carries `field`; `invalidRequest()` in `apps/daemon/src/errors.ts` builds it with its detail.
- **`manifest.warning` carries its warning's code as `warning`**, beside the warning's own params and `path`; its wording is the path and the warning's.
- **The adapters' codes are in scope**: the remote tracker's, the local tracker's and Git's reach a person through the daemon, so they carry `params` and the source test reads `packages/adapters/src` too. Git's unavailable facts gain `params`, which the daemon's `git.*` errors pass on.
- **`telemetry.unreadable` is raised where it is made**, in `usageAndActivity`'s attention, before `context.pressure`, rather than rebuilt from a harness's English reason in the snapshot; the order of the attention list is as before.
- **The source test runs both ways**: an emitted code without a wording fails, and so does a worded code the sources no longer emit, which also catches a pattern that stopped matching. It reads `code: '…'`, the first argument of `OperationError`, `super`, `failed` and `unavailable`, a forge refusal's `return ['…', \``, and every `'expected.…'`.
- **`CONTEXT.md` lists the Russian words as one table**, *Russian words*, after the canonical terms, with the states, CI and finding words below it, rather than a line under each heading: the spec's list has terms with no heading of their own (Epic, roadmap, Product session, Backlog).

### For the next tickets

- `wordMessage(language, { code, message, params })` from `@binnacle/core` gives `{ text, english }`: `english` true means the message is the daemon's own, to be marked. Tickets 03 and 08 call it; the dashboard's `daemonReasons` move beside it in ticket 08.
- **Not coded yet**: a section's `{ available: false, reason }` and the daily's `fallback` carry no code or params; ticket 08's text-matched `daemonReasons` cover the former. The CLI's own codes (`daemon.unreachable`, and `auth.missing` from `report.ts`, whose message differs from the daemon's) are ticket 03's; `OperationFailedError` now keeps `params`, and `binn mcp` and `binn call` pass them on.
- A new code needs a wording in `packages/core/src/wording.ts` and an example in `packages/core/test/wording.test.ts`, or `apps/daemon/test/codes.test.ts` and the wording test fail.
