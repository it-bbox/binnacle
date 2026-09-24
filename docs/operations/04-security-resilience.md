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

Requested with **read-only scope** — Binnacle never writes to a tracker (`ADR-0013`), so a leaked token cannot damage a repository. Stored in the environment or in `~/.binnacle/credentials.json` with `0600` permissions, one per host, never in `.binnacle/project.yaml`. On GitHub that is a fine-grained token with Issues read access; on GitLab, a token with `read_api`. Tokens are not imported from `gh` or `glab`: theirs can usually write, and the promise above would no longer hold.

## Local network

Daemon/Dashboard/MCP HTTP endpoints default to loopback only, and loopback alone is not an authentication boundary: any tab in the user's browser can reach `127.0.0.1`. Every API call therefore carries the token from `~/.binnacle/`, and `Origin`/`Host` are validated to defeat DNS rebinding. There are no accounts — there is one user.

The daemon has exactly one unauthenticated endpoint, `GET /health`, which answers whether a Binnacle daemon is listening and at which version, and nothing else. Every operation is a `POST /ops/<operation>` and requires the bearer token. `Host` must be exactly the address the daemon bound — `127.0.0.1:<port>`, not `localhost:<port>` and not any other name for it; an `Origin`, when one is sent at all, must be `http://` that same address. Both checks apply to `/health` as well.

Any remote/team exposure is post-MVP and requires separate auth/threat model.

## File permissions

Everything Binnacle keeps about itself lives in the Binnacle home directory — `~/.binnacle` by default, overridable with the `BINNACLE_HOME` environment variable. The directory is created `0700`, and the API token, the daemon runtime file and the daemon log are created `0600`.

`0600` and `0700` are POSIX concepts. **On Windows they are not enforced.** Node passes the mode through and the filesystem ignores it. There these files are protected by the user profile's ACL and by nothing Binnacle does, so anything running as that Windows account can read the API token. That is the same trust boundary the harnesses' own credential files already sit behind, but it is not a protection Binnacle provides — which is why this document says so rather than implying an enforcement that is not running.

## Rebuildability

SQLite is not the sole truth. Project knowledge remains in Git/tracker/docs, and telemetry/event journal should allow meaningful recovery.

## Graceful degradation

If any optional capability fails:

- Graphify unavailable → agents use Serena/source/docs;
- Obsidian unavailable → canonical docs unaffected;
- Binnacle unavailable → normal agent/Git workflow continues;
- telemetry adapter unavailable → work continues, metrics for that interval are incomplete and marked accordingly.
