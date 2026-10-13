# ADR-0044: One Bundled Package, `@it-bbox/binnacle`

**Status:** Accepted. Amends ADR-0010's scope `@binnacle/*`, ADR-0016's `@binnacle/cli` and `npx binn`, and ADR-0027's `@binnacle/cli`.

## Context

Binnacle is released to npm on 2026-10-13 (epic 17, `docs/specs/release/brief.md`). The workspace holds seven packages, all `private`, each exporting TypeScript sources: `binn` is `apps/cli/src/bin.ts`. Node strips types only outside `node_modules`, so an installed package fails with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. ADR-0010, ADR-0016 and ADR-0027 assumed a package `@binnacle/cli` in the scope `@binnacle`; that scope is taken on npm. The unscoped name `binn` is another author's package, so ADR-0016's `npx binn` would run it, not Binnacle.

## Decision

- **One package is published: `@it-bbox/binnacle`**, in the npm organisation `it-bbox`, which matches the GitHub organisation. Its commands stay `binn` and `binnd`.
- **It is built, not copied.** A build bundles `binn` and `binnd`, with every dependency, into JavaScript, and puts beside them the generated dashboard (ADR-0031), the `binnacle` plugin with its marketplace manifest (ADR-0027), the licence and the README. The published package has no runtime dependencies.
- **The workspace's packages stay private** under their `@binnacle/*` names and are never published. The development link keeps running `binn` from the sources.
- **It is installed with `npm i -g @it-bbox/binnacle`**, and `npx -p @it-bbox/binnacle binn` runs it once.

## Considered Options

- **Publishing all seven packages**, each compiled with `tsc`. Rejected: seven versions to keep in step and seven publications, and the internal modules become a public API, for a user who only ever installs the CLI.
- **The scope `@binnacle`.** Not available: taken on npm.
- **An unscoped name such as `binnacle-cli`.** Rejected: the scope ties the package to the organisation that publishes it and to the repository `it-bbox/binnacle`.

## Consequences

- A user's machine needs only Node 24 and npm: installing the tarball needs no further download.
- Every path the code resolves from its own location — the daemon's entry, the dashboard's files, the plugin and skills, the version — must resolve both in the workspace and inside the installed package.
- The internal names `@binnacle/*` remain in the workspace, its scripts and its docs for contributors; only the user-facing install names `@it-bbox/binnacle`.
- The owner publishes by hand. Publishing from CI, with provenance, waits until it is worth a token in CI's secrets.
