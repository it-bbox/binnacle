# 03: Read-only tracker credentials

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** a private GitHub or GitLab repository can be read. The daemon finds a read-only token for the declared host, refuses a credentials file others can read, and never lets a token reach a response. Decided in the spec, under *Credentials*.

- [x] Lookup order, on every call: `BINNACLE_GITHUB_TOKEN` or `BINNACLE_GITLAB_TOKEN` from the daemon's environment for its provider; then the declared host's entry in `~/.binnacle/credentials.json` (a JSON object keyed by host, under the Binnacle home); then no token, and the request is anonymous.
- [x] `GITHUB_TOKEN` and other generic names are not read. Nothing is imported from `gh` or `glab`.
- [x] A credentials file whose permissions allow anyone but its owner is not read and gives `tracker.credentials_insecure`, where the platform has POSIX modes.
- [x] `tracker.unauthorized` says whether a token was used.
- [x] A test asserts that the token appears in no response, diagnostic, event or log line, including on an authentication failure.
- [x] Tests through the daemon seam cover each lookup source, the order, the insecure file and the anonymous fallback, against the loopback stand-in checking the header it receives.
- [x] `docs/operations/05-installation-checklist.md` names the two variables and the file.

## Comments

- **What changed.** `trackerToken(home, provider, host)` in `apps/daemon/src/home.ts` does the lookup on every call, and `credentialsPath(home)` names the file. It returns a token, `null` for an anonymous read, or one diagnostic. `readTasks` in `apps/daemon/src/snapshot.ts` calls it for both GitHub and GitLab, so `readTasks`, `snapshot`, `daily` and `readState` now take the Binnacle home. `readRemoteTasks` in `packages/adapters/src/remote-tracker.ts` takes the token and sends it on every page. Each `Forge` names its own header through `authorization(token)`: GitHub sends `authorization: Bearer <token>`, and GitLab sends `private-token: <token>`. `statusFailure` there ends its `tracker.unauthorized`, `tracker.forbidden` and `tracker.not_found` messages with "a token was used" or "no token was used", for both forges. `TrackerProvider` is now exported from `@binnacle/core`. The tests are the *credentials* blocks in `apps/daemon/test/github.test.ts` and `gitlab.test.ts`. Both loopback stand-ins now record the auth header they receive. `docs/operations/05-installation-checklist.md` documents the two variables and the file, and `docs/operations/04-security-resilience.md` states the lookup and the refusal.
- **Rebased onto ticket 04.** Ticket 04 landed first and moved GitHub's reading into the shared `readRemoteTasks`. The token went where its comments said it should. The lookup order, the insecure file and every leak path are tested once, on GitHub, because the lookup is shared. The GitLab tests show only what differs: its own variable, its own header, the same file, and the refusal wording.
- **Rebased onto ticket 05.** Ticket 05 landed next. Its `checkpoint.record` reads a remote tracker to record Task states, through the exported `readTasks`, so it reads with the token too. The leak test now calls `checkpoint.record` as well. Ticket 08 landed after that, and the rebase onto it was clean.
- **For ticket 11.** `binn init`'s tracker check reads through the same lookup. `trackerToken` and `credentialsPath` are in `apps/daemon/src/home.ts`, and neither is exported from the daemon package's index yet. On `tracker.credentials_insecure`, or on `tracker.unavailable` naming a variable or the file, init's explanation should point at `docs/operations/05-installation-checklist.md`, *Tracker credentials*.
- **`tracker.unavailable` means a little more now.** Ticket 04's comments say that on a remote tracker it only means a missing `tracker.repository`. It now also covers credentials that cannot be used, and its message always says which case it is.
- **The test environment.** The test daemon runs in the test's own process, so `github.test.ts` deletes `BINNACLE_GITHUB_TOKEN` at load time, and `gitlab.test.ts` deletes `BINNACLE_GITLAB_TOKEN`. A token the developer has set never reaches a loopback server, and never breaks a test that expects none. The suite passes with both variables set.
- **Questions answered in the smallest way the spec allows.**
  - *What is the file keyed by?* The project's `tracker.host` exactly as the manifest writes it, or `github.com` or `gitlab.com` when it writes none. So a base-URL host needs its whole URL as the key, and the key is case-sensitive. The installation checklist says so. Reducing the key to a hostname would have given two loopback ports one entry, and would have been a second reading of `host`. The default key has no test through the seam: a manifest with no `host` reads the real forge, and `pnpm test` stays offline. Ticket 07's live tests reach it.
  - *Does an insecure file stop the read, or fall back to anonymous?* It stops the read: Tasks are `null`, and there is one `tracker.credentials_insecure` item. The rest of the snapshot still answers. An anonymous read of a private repository would come back as `tracker.not_found` and hide the real cause. When the environment holds a token, the file is not opened, so it is not checked either.
  - *What about a file that is not a JSON object of host to token, or cannot be read, or a token that cannot be an HTTP header value?* Each gives `tracker.unavailable` and makes no request. The message names the source: the variable, the file, or the host's entry in the file. It never quotes the value, because a parser error and `fetch`'s invalid-header error both quote the text they refuse. A token is trimmed, and an empty variable counts as unset.
  - *Does an insecure mode include write and execute bits?* Yes. Any bit for the group or for others (`mode & 0o077`) refuses the file. The spec speaks of access by anyone but the owner, not only reading.

### Review

`/code-review` ran against `main` on both axes. It ran again after the rebase onto ticket 04. The rebase onto ticket 05 only threaded the home into `checkpoint.record`, so it was checked by the full suite and not reviewed a third time.

**Standards: no hard violations, and nine judgement calls.**

1. The workflow requires ticked criteria and `## Comments`. **Fixed** in this closing commit.
2. Shotgun Surgery: `home` is threaded through `snapshot`, `daily`, `readState` and `readTasks`. **Kept.** The file lives under the daemon's home, which only the operation context knows. Resolving the token in `operations.ts` would read credentials for projects that are not on a remote tracker, and for the daily's baseline side, which reads no remote tracker at all.
3. The default host `${provider}.com` appears in both `trackerToken` and `declaredHostname`. **Left.** The two answer different questions: one gives a literal key, the other a lowercased hostname without a port. Sharing a one-line default would couple them.
4. `'github' | 'gitlab'` repeated a literal that `TrackerProvider` already gives. **Fixed**: `Exclude<TrackerProvider, 'local'>`.
5. Divergent Change: credential parsing now lives in `home.ts`. **Kept.** `home.ts` already reads and guards the daemon's API token and the other files in the Binnacle home, and the credentials file is one of those files.
6. The `env` parameter on `trackerToken` has no caller that passes it. **Kept**, to match `resolvePort` and `resolveGitTimeout`.
7. The error code was cast twice in one `catch`. **Fixed**.
8. After the rebase, the 401 message said twice that a token was used. **Fixed**: it now says so once.
9. After the rebase, `gitlab.test.ts` sets and clears its variables by hand instead of through a `withEnv` helper like GitHub's. **Kept.** It is one test, and each test file keeps its own fixtures.

**Spec: every criterion is met, and ticket 04's handoff is followed.**

1. Status and criteria were not yet updated. **Fixed** in this closing commit.
2. "a token was used / no token was used" is added to `tracker.forbidden` and `tracker.not_found` as well as `tracker.unauthorized`. **Kept.** User story 33 asks for a code that says whether to create a token, fix one or widen its scope, and both forges answer 404 when a private repository is read anonymously.
3. `USABLE_TOKEN` refuses a token that cannot be a header value. **Kept.** It closes a real leak, because `fetch` quotes the header it refuses. The leak test fails without it.
4. The credentials key is `tracker.host` as written, and the default key has no offline test. **Kept**, as answered above.
5. `tracker.unavailable` also covers unusable credentials, which contradicts ticket 04's note. **Kept**, and recorded above.
6. An insecure file stops the read instead of falling back to anonymous. **Kept**, as answered above.
