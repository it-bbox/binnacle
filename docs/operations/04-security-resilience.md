# Security, Privacy and Resilience

## Default privacy mode

Prefer metadata-first telemetry:

Store:

- run/task/project identifiers;
- timestamps;
- provider/model/profile;
- token/cache metrics;
- tool counts/names where configured;
- state transitions.

Do not require storing:

- full prompts;
- model responses;
- source file contents;
- secrets/tool arguments.

Content-level diagnostics must be explicit opt-in.

## Secrets

- no API keys in `.binnacle/project.yaml`;
- use environment/OS secret mechanisms/upstream client config;
- never export secrets into Obsidian/Graphify intentionally;
- audit should detect obvious committed-secret risks using an external/standard tool if added later, rather than inventing a custom secret scanner.

## Tracker credentials

Requested with **read-only scope** — Binnacle never writes to a tracker (`ADR-0013`), so a leaked token cannot damage a repository. Given in the daemon's environment as `BINNACLE_GITHUB_TOKEN` or `BINNACLE_GITLAB_TOKEN`, or in `~/.binnacle/credentials.json` with `0600` permissions, one per host, and never in `.binnacle/project.yaml` (`docs/operations/05-installation-checklist.md`). A credentials file others can read is refused with `tracker.credentials_insecure`. A token is sent only to the declared host, and never appears in a response, diagnostic, event or log line. On GitHub that is a fine-grained token with Issues read access, and Actions, Commit statuses and Pull requests read access for the snapshot's CI (GitHub serves check runs to GitHub Apps only, so Binnacle reads a commit's workflow runs and statuses, and never its contents); on GitLab, a token with `read_api`. CI read from a Git remote rather than the tracker goes to the host the remote names, which no manifest declared: on `github.com` or `gitlab.com` it uses the token kept for that host, and on any other host only the credentials file's entry for it, never `BINNACLE_GITHUB_TOKEN` or `BINNACLE_GITLAB_TOKEN`, so that a remote cannot draw the token meant for another host. Tokens are not imported from `gh` or `glab`: theirs can usually write, and the promise above would no longer hold.

## Local network

Daemon/Dashboard/MCP HTTP endpoints default to loopback only, and loopback alone is not an authentication boundary: any tab in the user's browser can reach `127.0.0.1`. Every API call therefore carries the token from `~/.binnacle/`, and `Origin`/`Host` are validated to defeat DNS rebinding. There are no accounts — there is one user.

The daemon reads with no token at one endpoint, `GET /health`, which answers whether a Binnacle daemon is listening and at which version, and nothing else. It accepts writes with no token at one other place, OpenTelemetry's `POST /v1/logs` (and `/v1/metrics` and `/v1/traces`, answered and not stored), because a harness's exporter is configured with an endpoint and nothing else: what it keeps of an event is the call's metadata and token counts, and it answers no question. Every operation is a `POST /ops/<operation>` and requires the bearer token. `Host` must be exactly the address the daemon bound — `127.0.0.1:<port>`, not `localhost:<port>` and not any other name for it; an `Origin`, when one is sent at all, must be `http://` that same address. Both checks apply to `/health` and the OpenTelemetry paths as well.

Any remote/team exposure is post-MVP and requires separate auth/threat model.

## File permissions

Everything Binnacle keeps about itself lives in the Binnacle home directory — `~/.binnacle` by default, overridable with the `BINNACLE_HOME` environment variable. The directory is created `0700`, and the API token, the daemon runtime file and the daemon log are created `0600`.

`0600` and `0700` are POSIX concepts. **On Windows they are not enforced.** Node passes the mode through and the filesystem ignores it. There these files are protected by the user profile's ACL and by nothing Binnacle does, so anything running as that Windows account can read the API token. That is the same trust boundary the harnesses' own credential files already sit behind, but it is not a protection Binnacle provides — which is why this document says so rather than implying an enforcement that is not running.

## Open dependency advisories

`pnpm audit --prod` reports no high or critical advisory. `pnpm audit` still reports these, all in the dashboard's build tooling, which runs at `nuxt generate` and never ships: the dashboard is served as static files (ADR-0031). Each is kept because no release of a direct dependency removes it (2026-10-13).

| Advisory | Package, through | Severity | Why it is kept | Comes back when |
| --- | --- | --- | --- | --- |
| GHSA-x6jw-m9v5-85vh, GHSA-v5rq-49vh-5v5c, GHSA-g4wm-2vf7-vfgr, GHSA-858h-whjf-mvg5 | `simple-git` 3.x and `@simple-git/argv-parser`, through `nuxt` → `@nuxt/devtools` 3 | critical, high | Fixed in `simple-git` 4, which only `@nuxt/devtools` 4's betas take; Nuxt 4.6 requires devtools 3. The dashboard turns devtools off (`devtools: { enabled: false }`), and they run only under `nuxt dev`. | a stable Nuxt takes `@nuxt/devtools` 4 |
| GHSA-86w9-cpqp-85rv | `node-forge`, through `nitropack` → `listhen` | high | No fixed release exists. `listhen` is the development server's listener; `nuxt generate` verifies no signature with it. | `node-forge` publishes a fix |
| GHSA-vfj7-8cjw-p6xm | `braces`, through `nitropack` → `globby` → `micromatch` | high | No fixed release exists. The patterns it expands are the dashboard's own, at build time, so the worst case is a failed build. | `braces` publishes a fix |
| GHSA-g7r4-m6w7-qqqr | `esbuild` 0.27, through `@nuxt/ui` → `@nuxt/fonts` 0.14 → `fontless` | low | The latest Nuxt UI still takes `@nuxt/fonts` 0.14. It affects esbuild's development server on Windows, which the dashboard never runs, and the dashboard turns Nuxt UI's fonts off. | Nuxt UI takes `@nuxt/fonts` 1 |

## Rebuildability

SQLite is not the sole truth. Project knowledge remains in Git/tracker/docs, and telemetry/event journal should allow meaningful recovery.

## Graceful degradation

If any optional capability fails:

- Graphify unavailable → agents use Serena/source/docs;
- Obsidian unavailable → canonical docs unaffected;
- Binnacle unavailable → normal agent/Git workflow continues;
- telemetry adapter unavailable → work continues, metrics for that interval are incomplete and marked accordingly.
