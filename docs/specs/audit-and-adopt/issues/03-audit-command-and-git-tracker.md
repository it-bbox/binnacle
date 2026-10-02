# 03: binn audit, its findings, and the Git and tracker checks

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** the `binn audit [path]` command, end to end, with its first area. It reads the repository at `path`, the current directory by default, and prints a list of findings as text, or as JSON with `--json`. A finding has a check code, an area, a status of `ok`, `gap` or `unknown`, a reason and, for a `gap` or an `unknown`, a recommendation. No overall score. It needs no registration, no daemon and no `.binnacle/project.yaml`, writes nothing, makes no network call and runs no process but Git. The first area is Git and tracker: whether the path is a Git repository and on what branch, the tracker provider from the remote's URL, and whether a tracker token is present in the environment or in `~/.binnacle/credentials.json`, never its value. Whether a token works is `unknown`. A repository with no remote is told that local tickets under `docs/specs/` are a tracker Binnacle reads. Blocked by 02 only because both change `init.ts`: the provider-from-remote reading moves out of init so that the audit and init share it.

- [x] `binn audit` on a Git repository prints findings, in a stable order, each with its code, area, status, reason and recommendation.
- [x] `--json` gives the same findings.
- [x] The exit code is 0 when there are gaps, and non-zero, with a reason, for a missing or unreadable path and for a directory that is not a Git repository.
- [x] The tracker provider is read from the remote, and the token's presence is reported without its value, in either output.
- [x] A test lists a fixture's files before and after the audit, with the daemon's home and `~` pointed at an empty directory, and finds no difference.
- [x] A test runs the audit on a bare fixture with the daemon not started.
- [x] The provider-from-remote reading is shared with `binn init`, not copied.

## Comments

### Decisions

- **Where things live.** The finding shape and the list of areas are in `packages/core/src/audit.ts`; the command and the Git and tracker checks are in `apps/cli/src/audit.ts`. A later area is one more list of findings in `audit()`'s one array, which is sorted by area and keeps each area's own order. `forgeRemote` moved from `init.ts` to `packages/core/src/tracker.ts` beside `remoteLocation`; init imports it.
- **Check codes.** `git.repository` (the branch is in its reason; a detached HEAD or a branch with no commit is said so), `tracker.provider`, `tracker.token`, `tracker.token_works`.
- **Token lookup** is the daemon's own `trackerToken` (now exported), so that the audit and the daemon never disagree; only whether there is a token is used. The home is `BINNACLE_HOME` or `~/.binnacle`. No token is a `gap`, whose recommendation says a public repository needs none; a credentials file that is unreadable or insecure is a `gap` with the daemon's message; whether it works is always `unknown`.
- **A remote that is not GitHub or GitLab by its URL** is `unknown` with a recommendation to declare the tracker in the manifest. No remote is `ok`, naming local tickets under `docs/specs/`.
- **A path inside a repository** audits the repository's root, and the report names the root. `--json` prints `{ root, findings }`, and may come before or after the path.
- **Not done here:** `docs/03-mcp-and-skills.md` still lists a future `/audit` skill and `audit.project` tool; the spec has no MCP audit in this epic, so that is for the ticket that settles the docs (07), not this one.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings:

1. **The moved `forgeRemote` kept a comment that spoke only of init.** **Fixed**: it names both commands.
2. **`args.length < argv.length - 1` for "`--json` was given" was cryptic.** **Fixed**: `argv.includes('--json')`.
3. **Findings are object literals repeating `code`, `area` and `status`; a `finding()` helper would shorten them.** **Left**: four areas of three or four literals each; a helper is for ticket 04 to 06 to add if the repetition grows.
4. **`AUDIT_AREAS` lists all eight areas while one is used.** **Kept**: the areas are phase 6's and the later tickets add to them without reshaping.
5. **The default-host-means-null rule for the credentials key is repeated.** **Kept**: one line in the audit, matching `credentialsKey`'s own rule; not worth a shared helper.
6. **The audit imports `trackerToken` from the daemon package.** **Kept**: it is a function, not the daemon process, and sharing it is the point.

**Spec:**

1. **No test of a detached HEAD, a subdirectory path or `--json` before the path.** **Fixed**: one test.
2. **The network test cannot fail for a real reason, since nothing in the audit uses the network.** **Kept**: the spec asks for it; it is a regression guard if a network call is ever added.
3. **The token is looked up under the host the remote names, not the host a manifest declares.** **Left**: the audit needs no manifest, and the ticket says the provider comes from the remote. A manifest with a self-hosted `tracker.host` and a remote that names it agrees.
4. **No token is `gap`, not `unknown`, although a private repository is not in the files.** **Kept**: the audit looked for a token in the two places and found none, which is a `gap`; the recommendation says when none is needed.
5. **A mistyped flag is read as a path and fails with "No directory at".** **Kept**: the exit is non-zero with a reason.
6. **`docs/03-mcp-and-skills.md` and the README do not mention `binn audit`.** **Left**, see Decisions: ticket 07 writes the README section; `--help` lists the command.

Typecheck is clean, and the full suite passes: 398 of 398. The audit run on this worktree printed its four findings.
