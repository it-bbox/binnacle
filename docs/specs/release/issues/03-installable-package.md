# 03: The installable package `@it-bbox/binnacle`

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/release/spec.md`
Roles: Developer, Reviewer, DevOps

**What to build:** `npm i -g` of a packed `@it-bbox/binnacle` gives a working Binnacle on Linux, macOS and Windows (spec, *The build*, *The published manifest*, *Paths from the code's own location*, *The tarball test*, *CI*; ADR-0044). A build in the CLI's package writes the publishable package into a directory of its own: `binn` and `binnd` bundled by esbuild with every dependency, the generated dashboard, the plugin with its marketplace manifest as `prepare` makes it, `LICENSE`, the English README, and a manifest it writes — name `@it-bbox/binnacle`, version `0.1.0`, both commands, Node 24, Apache-2.0, the repository's links, `publishConfig.access: public`, no dependencies. The daemon's entry, the dashboard's directory, the package directory with the plugin and skills, and the version resolve both in the workspace and in the installed package; the autostart service records the installed `binnd` when Binnacle runs from the package. The development link keeps running from the sources. A test script beside the live tests packs the build, installs the tarball into a temporary prefix with a temporary `HOME` and `BINNACLE_HOME`, and drives the installed commands; a CI job runs it on the three runners.

- [ ] The build writes the package directory; `npm pack` there yields a tarball with no `dependencies` and the files above.
- [ ] Installed from that tarball into an empty prefix: `binn --version` prints `0.1.0`; `binn daemon start` starts a daemon that answers `/health`; `/` serves the dashboard, not the page naming the generate command; `binn mcp` answers `initialize` and lists tools; the plugin, its marketplace manifest and a versioned plugin manifest are in the package; `binn daemon stop` stops it.
- [ ] The CI job runs that test on `ubuntu-latest`, `macos-latest` and `windows-latest`; `pnpm test` does not run it.
- [ ] From the development link, `binn daemon start`, the dashboard, `binn mcp` and autostart behave as before; `pnpm typecheck` and `pnpm test` pass.
