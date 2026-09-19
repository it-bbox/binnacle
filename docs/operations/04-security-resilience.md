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

- no API keys in `.devcontrol/project.yaml`;
- use environment/OS secret mechanisms/upstream client config;
- never export secrets into Obsidian/Graphify intentionally;
- audit should detect obvious committed-secret risks using an external/standard tool if added later, rather than inventing a custom secret scanner.

## Local network

Daemon/Dashboard/MCP HTTP endpoints default to loopback only. Any remote/team exposure is post-MVP and requires separate auth/threat model.

## Rebuildability

SQLite is not the sole truth. Project knowledge remains in Git/tracker/docs, and telemetry/event journal should allow meaningful recovery.

## Graceful degradation

If any optional capability fails:

- Graphify unavailable → agents use Serena/source/docs;
- Obsidian unavailable → canonical docs unaffected;
- Binnacle unavailable → normal agent/Git workflow continues;
- telemetry adapter unavailable → work continues, metrics for that interval are incomplete and marked accordingly.
