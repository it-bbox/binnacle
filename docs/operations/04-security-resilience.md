# Security, Privacy and Resilience

_Русская версия: [04-security-resilience.ru.md](04-security-resilience.ru.md)._

What Binnacle keeps, who can reach its daemon, where its secrets live, and what still works when a part is missing. To report a vulnerability, see the [security policy](../../SECURITY.md).

## What telemetry keeps

Telemetry is metadata first. Content-level diagnostics are an explicit opt-in.

| Kept | Never required |
| --- | --- |
| run, task and project identifiers | full prompts |
| timestamps | model responses |
| provider, model and profile | source file contents |
| token and cache counts | secrets and tool arguments |
| tool counts and names, where configured | |
| state transitions | |

The OpenTelemetry export `binn init` configures has prompt logging off.

## Secrets

- No API key goes into `.binnacle/project.yaml`: Binnacle never reads a secret from a manifest, nor writes one to it (ADR-0013).
- Keys live in the environment, the operating system's secret store or the upstream client's own configuration.
- Never export a secret into Obsidian or Graphify on purpose.
- `binn audit` does not look for committed secrets yet. Phase 12 of `docs/05-mvp-plan.md` adds it: a committed `.env` and known key patterns, given by path and line, never by value.

## Tracker credentials

Binnacle never writes to a tracker (ADR-0013), so it asks for read-only tokens: a leaked one cannot change a repository.

| Tracker | Token | Its access |
| --- | --- | --- |
| GitHub | fine-grained | Issues read; for the snapshot's CI, Actions, Commit statuses and Pull requests read |
| GitLab | any | `read_api` |

- A token is given in the daemon's environment as `BINNACLE_GITHUB_TOKEN` or `BINNACLE_GITLAB_TOKEN`, or in `~/.binnacle/credentials.json`, one per host. How: [Installation checklist](05-installation-checklist.md#tracker-credentials).
- A credentials file others can read is refused with `tracker.credentials_insecure`.
- A token is sent only to its declared host, and never appears in a response, diagnostic, event or log line.
- GitHub serves check runs to GitHub Apps only, so Binnacle reads a commit's workflow runs and statuses, never its contents.
- Tokens are never imported from `gh` or `glab`: theirs can usually write, and the promise above would break.

CI read from a Git remote rather than the tracker goes to a host no manifest declared. On `github.com` or `gitlab.com` it uses the token kept for that host. On any other host it uses only the credentials file's entry for it, never an environment token, so a remote cannot draw the token meant for another host.

## The local network

The daemon listens on `127.0.0.1` only. Loopback is not an authentication boundary: any tab in the user's browser can reach it. There are no accounts, since there is one user; a token and two header checks guard the daemon instead.

| Path | Token | What it does |
| --- | --- | --- |
| `GET /health` | none | Says whether a Binnacle daemon listens, and at which version; nothing else |
| `POST /v1/logs` | none | Receives OpenTelemetry logs: a harness's exporter is configured with an endpoint and nothing else. It keeps each call's metadata and token counts, and answers no question |
| `POST /v1/metrics`, `POST /v1/traces` | none | Answered, not stored |
| `POST /ops/<operation>` | bearer | Every operation: the CLI's, `binn mcp`'s and the dashboard's |
| any other `GET` | none | The dashboard's generated files, which hold no project data |

Every path, those without a token included, is checked twice:

- `Host` must be exactly the address the daemon bound, `127.0.0.1:<port>`: not `localhost:<port>`, nor any other name for it.
- `Origin`, when one is sent, must be `http://` and that same address.

Together they defeat DNS rebinding. The dashboard's pages also carry a Content-Security-Policy: they load and connect nowhere but the daemon, and run only the inline scripts the served HTML holds.

`binn mcp` speaks MCP to its harness over stdio, and calls the daemon with the token like any other client.

### The dashboard's token

- `binn dashboard` opens the dashboard with the token in the address's fragment, which never reaches a server. The page moves it into the browser's local storage (ADR-0031).
- `binn dashboard` prints the address without the token, since a skill's shell output reaches the model's provider.
- `binn dashboard --print`, for a human at a terminal, prints the address with the token.

Remote or team access is post-MVP, and needs its own authentication and threat model.

## File permissions

Everything Binnacle keeps about itself is in the Binnacle home: `~/.binnacle` by default, or the directory `BINNACLE_HOME` names. The home is created `0700`. The files Binnacle writes there are created `0600`: the API token, the daemon's runtime file and log, the store, the project registry and the settings file.

`0600` and `0700` are POSIX modes. **On Windows they are not enforced**: Node passes the mode through and the filesystem ignores it.

- There these files are protected by the user profile's ACL, and by nothing Binnacle does.
- Anything running as that Windows account can read the API token.
- That is the boundary the harnesses' own credential files already sit behind, but it is not a protection Binnacle provides, and this page does not pretend otherwise.

## Open dependency advisories

`pnpm audit --prod` reports no high or critical advisory. `pnpm audit` still reports the ones below, all in the dashboard's build tooling. It runs at `nuxt generate` and never ships: the dashboard is served as static files (ADR-0031). Each is kept because no release of a direct dependency removes it (2026-10-13).

| Advisory | Package, through | Severity | Why it is kept | Comes back when |
| --- | --- | --- | --- | --- |
| GHSA-x6jw-m9v5-85vh, GHSA-v5rq-49vh-5v5c, GHSA-g4wm-2vf7-vfgr, GHSA-858h-whjf-mvg5 | `simple-git` 3.x and `@simple-git/argv-parser`, through `nuxt` → `@nuxt/devtools` 3 | critical, high | Fixed in `simple-git` 4, which no `@nuxt/devtools` 3 takes; only devtools 4, still in beta, drops it, and Nuxt 4.6 requires devtools 3. The dashboard turns devtools off, and they run only under `nuxt dev`. | a stable Nuxt takes `@nuxt/devtools` 4 |
| GHSA-86w9-cpqp-85rv | `node-forge`, through `nitropack` → `listhen` | high | No fixed release exists. `listhen` is the development server's listener; `nuxt generate` verifies no signature with it. | `node-forge` publishes a fix |
| GHSA-vfj7-8cjw-p6xm | `braces`, through `nitropack` → `globby` → `micromatch` | high | No fixed release exists. The patterns it expands are the dashboard's own, at build time, so the worst case is a failed build. | `braces` publishes a fix |
| GHSA-g7r4-m6w7-qqqr | `esbuild` 0.27, through `@nuxt/ui` → `@nuxt/fonts` 0.14 → `fontless` | low | The latest Nuxt UI still takes `@nuxt/fonts` 0.14. It affects esbuild's development server on Windows, which the dashboard never runs, and the dashboard turns Nuxt UI's fonts off. | Nuxt UI takes `@nuxt/fonts` 1 |

## Rebuildability

The local SQLite store is a rebuildable projection, not the truth: project knowledge stays in Git, the tracker and the docs. Losing the store may lose telemetry history, never a decision.

## Graceful degradation

When an optional part is missing, work goes on:

| Missing | What happens |
| --- | --- |
| Graphify | Agents use Serena, the source and the docs |
| Obsidian | The canonical docs are unaffected |
| Binnacle | The usual agent and Git workflow goes on |
| A telemetry adapter | Work goes on; that interval's metrics are incomplete, and marked so |
