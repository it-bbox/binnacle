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

Requested with **read-only scope** — Binnacle never writes to a tracker (`ADR-0013`), so a leaked token cannot damage a repository. Stored in the environment or in `~/.binnacle/credentials.json` with `0600` permissions, never in `.binnacle/project.yaml`.

## Local network

Daemon/Dashboard/MCP HTTP endpoints default to loopback only, and loopback alone is not an authentication boundary: any tab in the user's browser can reach `127.0.0.1`. Every API call therefore carries the token from `~/.binnacle/`, and `Origin`/`Host` are validated to defeat DNS rebinding. There are no accounts — there is one user.

Any remote/team exposure is post-MVP and requires separate auth/threat model.

## Rebuildability

SQLite is not the sole truth. Project knowledge remains in Git/tracker/docs, and telemetry/event journal should allow meaningful recovery.

## Graceful degradation

If any optional capability fails:

- Graphify unavailable → agents use Serena/source/docs;
- Obsidian unavailable → canonical docs unaffected;
- Binnacle unavailable → normal agent/Git workflow continues;
- telemetry adapter unavailable → work continues, metrics for that interval are incomplete and marked accordingly.
