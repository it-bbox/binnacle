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

## Comments

### Decisions

- **The package directory is `apps/cli/dist/`**, which the root `.gitignore`'s `dist/` already ignores. `pnpm --filter @binnacle/cli build` (`apps/cli/src/build.ts`) empties it and writes `bin/binn.js`, `bin/binnd.js`, `dashboard/`, `plugin/`, `skills/`, `.claude-plugin/marketplace.json`, `LICENSE`, `README.md` and `package.json`. It runs `nuxt generate` itself, and prepares the plugin and the skills copy with `prepare.ts`'s own functions, so it needs no earlier step but `pnpm install`.
- **Telling the layouts apart.** The bundles sit one level below the package, as `src/` does below its own, so the version (`../package.json`) and the CLI's package directory (the plugin, the marketplace and the skills copy) resolve unchanged. The daemon's entry and the dashboard's directory differ: each reads its module's own extension, `.ts` in the workspace and `.js` in a bundle, and takes `./bin.ts` or `./binnd.js`, `../../dashboard/.output/public/` or `../dashboard/`. The autostart service's entry is the same `daemonEntry()`, so from the package it records `bin/binnd.js`.
- **A `createRequire` banner** in each bundle: a bundled CommonJS dependency requires Node's built-ins, which an ES module cannot do otherwise (`Dynamic require of "process" is not supported`).
- **`esbuild` ^0.28.2**, a root development dependency, the version Nuxt already put in the lockfile; 0.28.1 and later are outside GHSA-g7r4-m6w7-qqqr.
- **The tarball test** is `apps/cli/test/tarball.live.ts`, run with `node --test apps/cli/test/tarball.live.ts` and so also by `pnpm test:live`; the workflow's `tarball-live` job runs it on the three runners. It reads the tarball's files from `npm pack --json`, so it needs no `tar`, and installs with `--offline`. It does not turn autostart on: that would install a real service for the developer running it. `binn daemon start` spawns the same `daemonEntry()` the service records.
- **The package's README** is the English `README.md` as the build finds it; ticket 04 rewrites it, and the next build carries the new one.

### For the next tickets

- To publish (ticket 07, the owner): `pnpm install`, `pnpm --filter @binnacle/cli build`, then `npm publish --access public` in `apps/cli/dist/`. `CONTRIBUTING.md` (ticket 05 or 06) should name the build and the tarball test.
- The first CI run of `tarball-live` on `macos-latest` and `windows-latest` happens once the owner pushes; the test passed on Linux here. Windows is the spec's riskiest step: npm's `.cmd` shims are run through a shell, and the global prefix's layout differs (`<prefix>\binn.cmd`, `<prefix>\node_modules`).
