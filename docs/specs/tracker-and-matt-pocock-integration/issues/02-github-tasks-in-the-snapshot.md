# 02: GitHub issues as Tasks in the snapshot

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** a project whose manifest declares `tracker.provider: github` with a `repository` sees its issues as Tasks in the Product Snapshot: `#42`, the issue title, and the state, dependencies and spec from the ticket header in the body, with closing outranking `Status:`. Reads are anonymous in this ticket; tokens are ticket 03. Decided in the spec, under *Manifest*, *Remote adapters* and *Seam 1*.

- [ ] The manifest accepts `tracker.repository` and `tracker.host`, both `null` when unwritten. A remote provider without `repository` gives `tracker.unavailable` naming the field.
- [ ] `host` maps to the API root: `github.com` to `https://api.github.com`, any other hostname to `https://<host>/api/v3`, a base URL with a scheme used as given.
- [ ] The adapter reads every issue, open and closed, following pagination to the end, on every call, with the platform `fetch` and no client library. Pull requests are skipped.
- [ ] Identity `#<number>`, title, ticket as the issue's web URL, `Blocked by:` numbers with or without `#`, `None` as no dependencies, triage from the label equal to one of the five canonical role strings or `null`, spec slug from `specs/<slug>/spec.md` in the `Spec:` value, whether a path or a permalink.
- [ ] State: open takes `Status:`, or `null` with `task.unknown_state`; closed `completed` is `DONE`; `not_planned`, and `duplicate` where reported, is `CANCELLED`; closed with no reason is `CANCELLED` when `Status:` says so, otherwise `DONE`.
- [ ] `tracker.state_mismatch` for an open issue whose `Status:` is `DONE` or `CANCELLED`, and for a closed one whose `Status:` names another state than closing gave it. A closed issue with no header is not a mismatch.
- [ ] Dependencies on closed issues are met, and a dependency on no known issue is dangling, through the existing contract.
- [ ] Failures never fail the operation: `tasks` is `null`, the other sections answer, and one attention item carries `tracker.unauthorized`, `tracker.forbidden`, `tracker.not_found`, `tracker.rate_limited` or `tracker.unreachable` (a fixed timeout constant).
- [ ] `tracker.remote_mismatch` compares each Git remote's host and path with the declared host and repository; the hostname-label heuristic and its `ponytail:` note are gone.
- [ ] Tests run through the daemon seam against a loopback HTTP server started by the test, serving fixed JSON in GitHub's shape with pagination headers. `pnpm test` stays offline.
- [ ] ADR-0024's decision gains the sentence from the spec's *Further Notes*: a closed issue with no close reason stays `CANCELLED` when its `Status:` says so.
