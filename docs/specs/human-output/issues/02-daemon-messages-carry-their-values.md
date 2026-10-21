# 02: The daemon's messages carry their values, worded in Russian in one place

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/human-output/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** every message the daemon gives a person's surface can be worded in Russian from its code (spec, *Attention items and errors carry their values*, *One Russian wording of the daemon's codes*). A diagnostic, `{ code, message }`, gains an optional `params`: the values its English message is written from, Task ids, paths, numbers and names, as strings and numbers. An error envelope and each of its details gain the same, and every message that reaches a person has a code. The field is additive: MCP tools, `--json` and `binn call` keep every field they had, in English. `@binnacle/core` holds the Russian wording of every code, as pure functions from `params` to a sentence, with the terms of the spec's list; a code it does not know, or `params` it cannot use, gives the English message, marked as such by the caller. `CONTEXT.md` gains the Russian word beside each term, and `docs/03-mcp-and-skills.md` describes `params`.

- [x] Through the daemon's snapshot and HTTP tests: attention items and errors carry `params`, and every other field is as before.
- [x] A test over the daemon's and core's sources, as the dashboard's type-scale test reads its sources, finds every code they emit and fails when core has no Russian wording for one.
- [x] Each wording is checked with its `params`; an unknown code and unusable `params` fall back to the English message.
- [x] `@binnacle/core` keeps no runtime dependency (its purity test).
- [x] `CONTEXT.md` gives each term's Russian word, the spec's list.

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

### Review

A Reviewer sub-agent ran against `main`, on both axes and as the Architect. Typecheck and the 871 tests pass; every criterion holds; no new dependency, nothing outside the ticket, no Russian in MCP, `--json` or `binn call`.

**Standards:**

1. **The source test scanned `wording.ts` itself**, whose `expected.*` keys made every such code look emitted, so a worded code no longer emitted would not fail. **Fixed**: `apps/daemon/test/codes.test.ts` leaves `wording.ts` out.
2. **Binnacle's own English phrases rode in `params`** and showed inside a Russian sentence unmarked: the credentials file's unusable entry (`The entry for … in …` as `source`), the registry's reasons, and `telemetry.unreadable`'s `what` for a line or row a reader stopped at. **Fixed**: `tracker.unavailable` gains `kind: 'credentials_token'` with `key` and `path`; `registry.unreadable` takes `kind` `json` (with the parser's `error`), `projects` or `entry`; a line or row failure carries no `params`, so it shows as written, marked English (a `ponytail:` note in `usage.ts`'s `summary`). **Kept**: Git's `detail` and a compaction's `trigger` (`auto`, `manual`) are values another tool reports, and Git's fallback `exit code N` rides with them.
3. **"… могут читать не только его владелец"** was ungrammatical. **Fixed**: «может читать».
4. **`shape()` read only whole positive numbers**, so `limit: -1` or `2.5` fell back to English. **Fixed**: signed and decimal numbers pass through.
5. **`checkpoint.path_missing` was a calque.** **Fixed**: «По пути … в этой рабочей копии ничего нет».
6. **Lists the English joins with "or"** read as a comma list. **Fixed**: `either()` says `request.method_not_allowed`'s methods and `transition.unknown_state`'s states with «или»; the stray comma before «или это опечатка» is gone.
7. **`Coded` repeats `Diagnostic`'s shape.** **Kept**: `Coded` is what `wordMessage` takes, a diagnostic, an error or a detail alike; folding it into `tracker.ts` moves the type-only import cycle rather than removing it.

**Spec:** the five criteria hold (below); the adapters' codes, every detail's code and `manifest.warning`'s `warning` are recorded under *Decisions*.

#### Architect

1. **`params` is additive** on `Diagnostic`, the error envelope and its details; `ErrorDetail.code` and `ManifestProblem.code`/`params` are new and required, so every detail has a code. No existing field changed. Nothing to fix.
2. **`params` cannot be typed as "values only"**, so a later phrase would slip into a Russian sentence. **Fixed** by rule: `docs/03-mcp-and-skills.md` says a param is a value, never a phrase of Binnacle's own, a phrase being a `kind`.
3. **The wording in core** is pure, imports nothing outside the package, and only `Unusable` is caught. Nothing to fix.
4. **`board.ts` still finds `task.unknown_state` by its message's prefix**, which `params.task` could now replace. **Left**: it works as it is, and the ticket does not ask for it.
