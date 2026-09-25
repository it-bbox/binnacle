# 04: GitLab issues as Tasks

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** a project whose manifest declares `tracker.provider: gitlab` sees its issues as Tasks, with the same header, state rules, diagnostics and failure codes as GitHub. Decided in the spec, under *Manifest* and *Remote adapters*.

- [x] `host` maps to `https://<host>/api/v4`, `gitlab.com` by default, or a base URL used as given. `repository` is the full project path, subgroups included.
- [x] Every issue, open and closed, with pagination to the end. The number is the `iid`; the ticket is the issue's web URL; the body is its description.
- [x] GitLab reports no close reason, so a closed issue is `CANCELLED` when its `Status:` says so, otherwise `DONE`; the mismatch rule is GitHub's.
- [x] Triage from labels, spec slug, dependencies and every failure code behave as on GitHub.
- [x] If ticket 03 has landed, the token comes from `BINNACLE_GITLAB_TOKEN` or the host's entry, through the same lookup; otherwise this ticket reads anonymously and whichever merges second wires the two together.
- [x] Tests through the daemon seam against a loopback stand-in serving fixed JSON in GitLab's shape.

## Comments

- **What changed.** The GitHub adapter's reading moved into `packages/adapters/src/remote-tracker.ts`: `readRemoteTasks(forge, firstPage, where)` fetches every page by the `Link` header, maps a failing status to its code, and turns issues into Tasks with the header and state rules. `github.ts` and `gitlab.ts` each supply only a `Forge`, which holds their name, request headers and a `toIssue` that maps their JSON onto one `RemoteIssue` shape, plus their API root and first-page URL. `readGitLabTasks(repository, host)` and `gitlabApiRoot(host)` are the GitLab half. The daemon's `readTasks` picks the reader by provider, and `tracker.unavailable` on a remote tracker now only means a missing `tracker.repository`. The tests are `apps/daemon/test/gitlab.test.ts`.
- **ADR-0012 source scan.** `fetch(` is now allowed only in `remote-tracker.ts`, instead of `github.ts`. Neither `github.ts` nor `gitlab.ts` calls it.
- **Ticket 03 had not landed** when this was built (`Status: READY` on `main`), so GitLab is read anonymously. **For ticket 03, or whichever of the two merges second:** the token no longer goes into `readGitHubTasks`, which is now only a wrapper around the shared reader. Pass the token into `readRemoteTasks`. The forge adds its own auth header: GitHub takes `authorization: Bearer <token>`, and GitLab takes `private-token: <token>` (a personal or project access token also works as `authorization: Bearer`). The lookup key is `BINNACLE_GITLAB_TOKEN` for GitLab. `statusFailure` in `remote-tracker.ts` is where the `tracker.unauthorized` message must start saying whether a token was used, for both forges at once.
- **GitLab request.** `GET <root>/projects/<URL-encoded full path>/issues?per_page=100`. GitLab lists issues in every state when `state` is not given, and it paginates with the same `Link` header as GitHub. So nothing about pagination is GitLab-specific.
- **Questions answered in the smallest way the spec allows.**
  - *Are GitLab incidents, test cases and tasks read too?* Yes, all of them: the issues API returns them, and "every issue" filters none. Their `iid`s come from the issues' own sequence, so no two Tasks can clash.
  - *How is a GitLab rate limit recognised?* By `429`, as GitLab sends it. GitHub's rule of a `403` with no requests remaining is kept in the shared reader, where it does no harm on GitLab.
  - *What does a private project read anonymously give?* GitLab answers `404` to that, so the result is `tracker.not_found`, as on GitHub. The message names the project path and says "visible to this request".

### Review

`/code-review` ran against `main` on both axes.

**Standards: no hard violations; four judgement calls.**

1. The provider is tested twice in `readTasks`: once to choose the remote branch, once to choose the reader. **Kept.** With two providers a map would add a name without removing a line, and `packages/core/src/tracker.ts` asks the same question about remote mismatch rather than reading issues.
2. `Forge` is not a `CONTEXT.md` term, and its `issue` method did not say it maps. **Fixed** in part: the method is now `toIssue`. `Forge` is **kept**, because the spec itself says "the choice of forge", and "remote tracker" already names the reader.
3. GitHub's rate-limit rule sits in the shared reader, and the `tracker.not_found` message said "repository", which is not GitLab's word. The rule is **kept**, as answered above. The message is **fixed**: it now says "has nothing at <path> at <root>".
4. `gitlab.test.ts` copies the loopback-server helpers of `github.test.ts`. **Left** on purpose: tickets 03 and 05 are editing `github.test.ts` in parallel, and sharing the helper now would make both merges conflict. Once those tickets merge, the two fakes should become one helper under `apps/daemon/test/`.

**Spec: nothing missing and nothing wrong; one scope note.**

1. Rebuilding the GitHub adapter around a shared reader goes beyond ticket 02's note, which expected `gitlab.ts` to follow `github.ts` line for line. **Kept.** The state rules, failure codes and host guard now exist in one place, so both forges behave the same by construction, and one file is exempt from the source scan. The cost is a certain conflict with ticket 03's edits to `github.ts`. The note for ticket 03 above says where its token goes now.
2. The `tracker.not_found` wording. **Fixed**, as in standards item 3.
3. Checked against GitLab's API documentation: with no `state`, every state is listed; the fields are `iid`, `state` (`opened` or `closed`), `description`, `labels` and `web_url`; pagination is by `Link`; and a rate limit is `429`. **Nothing to change.**
