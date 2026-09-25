# 02: GitHub issues as Tasks in the snapshot

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** a project whose manifest declares `tracker.provider: github` with a `repository` sees its issues as Tasks in the Product Snapshot: `#42`, the issue title, and the state, dependencies and spec from the ticket header in the body, with closing outranking `Status:`. Reads are anonymous in this ticket; tokens are ticket 03. Decided in the spec, under *Manifest*, *Remote adapters* and *Seam 1*.

- [x] The manifest accepts `tracker.repository` and `tracker.host`, both `null` when unwritten. A remote provider without `repository` gives `tracker.unavailable` naming the field.
- [x] `host` maps to the API root: `github.com` to `https://api.github.com`, any other hostname to `https://<host>/api/v3`, a base URL with a scheme used as given.
- [x] The adapter reads every issue, open and closed, following pagination to the end, on every call, with the platform `fetch` and no client library. Pull requests are skipped.
- [x] Identity `#<number>`, title, ticket as the issue's web URL, `Blocked by:` numbers with or without `#`, `None` as no dependencies, triage from the label equal to one of the five canonical role strings or `null`, spec slug from `specs/<slug>/spec.md` in the `Spec:` value, whether a path or a permalink.
- [x] State: open takes `Status:`, or `null` with `task.unknown_state`; closed `completed` is `DONE`; `not_planned`, and `duplicate` where reported, is `CANCELLED`; closed with no reason is `CANCELLED` when `Status:` says so, otherwise `DONE`.
- [x] `tracker.state_mismatch` for an open issue whose `Status:` is `DONE` or `CANCELLED`, and for a closed one whose `Status:` names another state than closing gave it. A closed issue with no header is not a mismatch.
- [x] Dependencies on closed issues are met, and a dependency on no known issue is dangling, through the existing contract.
- [x] Failures never fail the operation: `tasks` is `null`, the other sections answer, and one attention item carries `tracker.unauthorized`, `tracker.forbidden`, `tracker.not_found`, `tracker.rate_limited` or `tracker.unreachable` (a fixed timeout constant).
- [x] `tracker.remote_mismatch` compares each Git remote's host and path with the declared host and repository; the hostname-label heuristic and its `ponytail:` note are gone.
- [x] Tests run through the daemon seam against a loopback HTTP server started by the test, serving fixed JSON in GitHub's shape with pagination headers. `pnpm test` stays offline.
- [x] ADR-0024's decision gains the sentence from the spec's *Further Notes*: a closed issue with no close reason stays `CANCELLED` when its `Status:` says so.

## Comments

- **What changed.** `readGitHubTasks(repository, host)` in `packages/adapters/src/github.ts` is the GitHub adapter, and `githubApiRoot` there maps `tracker.host` to an API root. `TaskReading.tasks` is now `null` when a tracker cannot be read at all, and one diagnostic says why. The daemon's `readTasks` chooses the adapter from the manifest. `blockedByNumbers`, `unquote` and `TRIAGE_ROLES` moved into `packages/core/src/tracker.ts`, so the local and GitHub adapters read `Blocked by:`, `Spec:` and triage the same way. `trackerRemoteMismatch` now takes the manifest's whole `tracker` section. The tests are `apps/daemon/test/github.test.ts`.
- **For ticket 04.** The GitLab adapter can follow `github.ts` almost line for line. GitLab reports no close reason, so it calls `closedState` with `null`, and it returns the same failure codes. For `gitlab` with a declared repository, `readTasks` in `apps/daemon/src/snapshot.ts` currently returns `tracker.unavailable`, saying GitLab is not read in this version; ticket 04 replaces that branch. It also adds `gitlab.ts` next to `github.ts` in the ADR-0012 source-scan exception, in `apps/daemon/test/daemon.test.ts`.
- **For ticket 05.** The daily's baseline side no longer reads a remote tracker: it calls `readState(..., { readRemoteTracker: false })`. There is no past version of a remote tracker to read at a commit. Reading today's issues twice would have made every transition look empty. So on GitHub the daily's `transitions` and `newTickets` are `null` for now, with no reason given, while `readyToStart` still answers. Ticket 05 replaces this with the recorded states and a stated reason.
- **For ticket 03.** No token is sent yet, and the `tracker.unauthorized` message says that no token was used. The token goes into the request headers of `readGitHubTasks`. Once it does, that message must say whether a token was used.
- **Timeout.** `TRACKER_TIMEOUT_MS` is 10 seconds per request, a fixed constant with no override. There is no test of the timeout itself, because it would wait that long. `tracker.unreachable` is tested against a closed port instead.
- **The ADR-0012 source scan** used to forbid `fetch(` everywhere in the daemon's and the adapters' sources. It now allows it in `packages/adapters/src/github.ts` only, matched by path. Every other network client is still forbidden there.
- **Questions answered in the smallest way the spec allows.**
  - *Is a dependency on an issue closed as `not_planned`, or as `CANCELLED`, met?* No. The criterion says closed dependencies are met "through the existing contract". That contract, `resolveDependencies`, counts only `DONE` as met, as on the local tracker. A dependency on an issue closed as completed is met, and that is the case tested.
  - *What about a closed issue whose `Status:` is not a Task state, such as `WIP`?* It is reported as `tracker.state_mismatch`, because its `Status:` is present and is not the state closing gave it. Otherwise nothing would ever report a bad header on a closed issue.
  - *What does `tracker.remote_mismatch` check when no `repository` is declared?* It still compares each remote's host with the declared host. `tracker.unavailable` already names the missing field.
  - *What if the next page points to another host?* The read is refused with `tracker.unreachable`, because Binnacle only sends requests to the declared host.
  - *What about other HTTP failures?* A 410, meaning issues are disabled, is `tracker.not_found`. Any other non-success status, or a body that is not a list, is `tracker.unreachable`, with the status in the message.

### Review

`/code-review` ran against `main` on both axes.

**Standards: two points against documented rules, and seven judgement calls.**

1. `githubApiRoot` is tested directly, below the daemon seam. **Kept.** Through the daemon, the API root for a hostname can only be reached over the real network, and `pnpm test` stays offline; the test's comment now says so. The adapter-level test of triage and the `Spec:` value is **kept** too. Neither appears in any daemon response until the task brief (ticket 06), and its comment says so.
2. ADR-0024 is edited in an implementation commit. **Kept.** The ticket asks for exactly this sentence, and the spec already decided it.
3. `tracker.host` is interpreted in two places. `githubApiRoot` turns it into an API root, and `declaredHostname` turns it into the host that remotes are compared with. **Left**, because they answer different questions. One consequence: a base URL of `https://api.github.com` would be compared with remotes as `api.github.com`. Nobody declares that, since it is the default.
4. `readState` took a bare `false` flag. **Fixed**: it is now `{ readRemoteTracker: false }`.
5. `readTasks` and `unavailable` branch on the same fields. **Kept**: `unavailable` only words the fall-through case.
6. `readGitHubTasks(repository, host)` takes two fields, while `trackerRemoteMismatch` takes the whole tracker section. **Kept**: the spec defines the adapter as a function of a repository, a host and, from ticket 03, a token.
7. The scan's exception relied on `fetch` being first in its pattern list. **Fixed**: the pattern is named, and the exempt file is matched by its full path.
8. The close state was a four-level nested ternary. **Fixed**: it is now `closedState`, and the `void` push is a block.
9. A formatting slip in `ResolvedTask`. **Fixed**.

**Spec: every criterion is met, and no other ticket's work is done here.**

1. Cancelled dependencies stay unmet. **Kept**, as answered above.
2. The daily on GitHub gives no reason for its `null` delta. **Left** to ticket 05, which owns that reason (see above).
3. A closed issue with a `Status:` that is not a Task state counts as a mismatch. **Kept**, as answered above.
4. Only the host is compared when no repository is declared. **Kept**.
5. A declared host with a port, such as `ghe.example.com:8443`, was compared with the port included, so it matched no remote. **Fixed**: the port is dropped, and a test covers it. The `api.github.com` base-URL case is **left**, as in standards item 3.
