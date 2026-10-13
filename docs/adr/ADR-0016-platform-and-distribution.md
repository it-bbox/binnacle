# ADR-0016: Platform Support and Distribution

**Status:** Accepted. Narrowed by ADR-0043 (autostart). Amended by ADR-0044: the package is `@it-bbox/binnacle`, installed with `npm i -g @it-bbox/binnacle`; `npx binn` runs another author's package.

## Context

A large share of the expected audience runs Windows, including among the earliest users. The cost of Windows support is not the runtime — Node, SQLite, Nuxt and loopback HTTP all work there — it is installing and supervising the daemon as a system service, where systemd, launchd and Windows Services have nothing in common.

Routing Windows users through WSL2 was considered and rejected: their harnesses run natively and write artifacts to Windows paths, so a daemon inside WSL2 reaches them across `/mnt/c`, where file watching does not work reliably. That is the worst outcome — support claimed and not delivered.

## Decision

- **Linux, macOS and Windows are all supported natively at runtime.** `binn daemon start` runs a user process.
- Installing the daemon as an auto-starting service is **out of v1** and will be addressed per platform afterwards.
- Distribution is **npm**: `@binnacle/cli`, usable through `npx binn`. Node 24 is required of the user.

## Rationale

The audience already runs Claude Code or Codex, so Node is present. npm is one publishing pipeline covering all three platforms and handles updates. Standalone binaries would add a build matrix plus Apple notarisation and Windows Authenticode signing — real cost, deferred until users without Node appear.

## Consequences

- Paths are resolved through `node:path` with `%APPDATA%` and `$HOME` conventions; harness artifacts are looked up under both `~/.claude` and `%USERPROFILE%\.claude` shapes.
- The choice of `node:sqlite` in ADR-0015 is what makes `npx binn` work on first attempt.
- Autostart is a documented manual step in v1.
