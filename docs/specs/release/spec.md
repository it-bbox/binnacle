# Spec: Release: npm and open source

Status: READY
Triage: ready-for-agent

Epic 17 of v1, from its grilling's brief, `docs/specs/release/brief.md` (2026-10-13), the product inbox's *Security audit before the release* and *Readable documentation before the release*, and ADR-0044. Exit criterion: the audit's four findings are fixed; `README.md` is short and every user guide it links reads in short paragraphs, lists and tables, in English and in Russian; a tarball of `@it-bbox/binnacle`, installed into an empty prefix on Linux, macOS and Windows, runs `binn`, starts the daemon, serves the dashboard and answers MCP; then the owner publishes `0.1.0` to npm, installs it from the registry into a clean environment, runs `binn init` in a new project, opens the dashboard, and makes `it-bbox/binnacle` public. The owner confirmed the test seams on 2026-10-13, recorded under *Further Notes*.

## Problem Statement

A user who hears about Binnacle tonight cannot install it. Every package is `private`; `binn` is a TypeScript file, which Node refuses to run from `node_modules`; the README's `npm i -g @binnacle/cli` names a scope Binnacle does not own; and `npx binn`, which ADR-0016 promises, runs somebody else's package. The repository is private, so the user cannot read the code either.

A user who could install it would meet a vulnerable `@modelcontextprotocol/sdk`, a repository with no way to report a vulnerability and nothing keeping its dependencies current. And the README they read on GitHub starts well, then turns into walls of text, the forty-line paragraph on `binn audit` and `binn init` first among them, in both languages.

## Solution

One package, `@it-bbox/binnacle`, version `0.1.0`, installed with `npm i -g @it-bbox/binnacle`. It holds `binn` and `binnd` bundled into JavaScript with every dependency, the generated dashboard and the `binnacle` plugin, so it runs on Node 24 with nothing more to download. A test installs the packed tarball into an empty prefix on all three platforms and drives it as a user would. The owner publishes it by hand.

Before that, the audit's findings are fixed: the MCP SDK upgraded, `SECURITY.md` added, Dependabot turned on, Nuxt's tooling updated where a fixed release exists. And the documentation is made readable: a README of one or two screens, which says what Binnacle is, how to install it and the two short paths, and links to guides that own the detail, each guide with a Russian twin. Last, the owner makes the repository public.

## User Stories

1. As a new user, I want to install Binnacle with one `npm i -g @it-bbox/binnacle`, so that I can start in a minute.
2. As a new user, I want the installed `binn` to run on Node 24 without any build step, so that installing is all I do.
3. As a new user on Windows, I want `binn` and `binnd` to run from the commands npm installs, so that Windows is not second class.
4. As a new user on macOS, I want the same install to work, so that the guide has one path for every platform.
5. As a user behind a slow or restricted network, I want the package to have no runtime dependencies, so that installing it fetches one tarball.
6. As a new user, I want `binn --version` to print `0.1.0`, so that I know which release I have.
7. As a new user, I want `binn daemon start` from the installed package to start the daemon, so that the first step of every guide works.
8. As a new user, I want the dashboard served at `http://127.0.0.1:7717/` right after install, so that I never run a generate step.
9. As a new user, I want `binn init` to install the `binnacle` plugin from the installed package, so that the skills match the tools they call (ADR-0027).
10. As a new user, I want `binn mcp` from the installed package to serve Binnacle's MCP tools, so that my harness sees them.
11. As a user who turned autostart on, I want the service to run the installed daemon's entry, so that the daemon comes back at login from the npm install too.
12. As a user, I want `npx -p @it-bbox/binnacle binn` documented for a one-off run, so that `npx binn` does not run another author's package.
13. As a user upgrading later, I want `npm i -g @it-bbox/binnacle@latest` to replace the old version, so that one command updates the CLI, the daemon, the dashboard and the skills together.
14. As a contributor, I want the development link from a checkout to keep running `binn` from the sources, so that my workflow does not gain a build step.
15. As a contributor, I want one command that builds the package and one that tests the packed tarball, so that I can check a release before the owner publishes it.
16. As the owner, I want CI to install the packed tarball on Linux, macOS and Windows and drive it, so that a broken package is caught before I publish.
17. As the owner, I want to publish by hand with `npm publish --access public`, so that no npm token sits in CI.
18. As the owner, I want the package page on npm to show the README, the licence and a link to the repository, so that a user lands somewhere useful.
19. As a security-minded user, I want `@modelcontextprotocol/sdk` at 1.31.0 or later, so that the shipped OAuth client cannot leak credentials (GHSA-6qxp-vccf-f47h).
20. As a security researcher, I want `SECURITY.md` to tell me how to report a vulnerability privately, so that I do not file it as a public issue.
21. As the owner, I want Dependabot to open pull requests for npm dependencies and GitHub Actions weekly, so that advisories reach me without my looking.
22. As a contributor, I want Nuxt's build tooling updated where a fixed release exists, so that `nuxt generate` on my machine runs no known critical advisory.
23. As a contributor, I want the advisories still open after the update listed with the reason they are kept, so that nobody re-audits them from scratch.
24. As a reader on GitHub, I want the README to fit in one or two screens, so that I understand what Binnacle is before I scroll.
25. As a reader, I want the README to say what problem Binnacle solves and for whom in its first lines, so that I can tell whether it is for me.
26. As a reader, I want the install command near the top, so that I can try it at once.
27. As a reader, I want the new-project and existing-project paths as short lists, so that I can follow them step by step.
28. As a reader, I want each detail — what `binn init` sets up, each harness, autostart, the security boundary — in the guide that owns it, linked from the README, so that the README stays short.
29. As a reader, I want guides written in short paragraphs, with headings, lists and tables where text enumerates, so that I can scan them.
30. As a Russian-speaking reader, I want `README.ru.md` and every user guide in Russian, so that I can read Binnacle in my language.
31. As a Russian-speaking reader, I want each Russian page to link the Russian pages, so that I stay in my language while I click.
32. As a reader in either language, I want both versions to say the same thing, so that neither is out of date.
33. As a contributor, I want how to develop Binnacle from a checkout in `CONTRIBUTING.md`, so that users do not read it in the README.
34. As a contributor, I want a test to fail when a user guide lacks its Russian twin or a relative link breaks, so that the rule holds after the release.
35. As an agent writing documentation, I want `AGENTS.md` to say which documents have a Russian twin, so that I update both in the same change.
36. As a reader, I want the design docs and ADRs linked from the README as the project's design, so that I can go deeper when I want to.
37. As a contributor, I want the repository public with its whole history, its ADRs and its specs, so that I can see how decisions were made.
38. As the owner, I want the repository's own docs to name `@it-bbox/binnacle` wherever a user installs it, so that no page tells a user to install a package that does not exist.
39. As the owner, I want ADR-0010, ADR-0016 and ADR-0027 to point to ADR-0044, so that a reader of the old decisions finds the current one.
40. As the owner, I want the exit demonstration to install from the registry, not from the checkout, so that what the video shows is what a user gets.

## Implementation Decisions

- **The build.** A build step in the CLI's package produces the publishable package in a directory of its own, from the workspace: `binn` and `binnd` bundled by esbuild into ES modules for Node 24, every dependency inlined, including `@modelcontextprotocol/sdk`, `zod` and `yaml`; the dashboard generated by Nuxt and copied in; the plugin and its marketplace manifest, as the existing `prepare` prepares them; `LICENSE` and the English `README.md`. esbuild becomes a development dependency of the workspace.
- **The published manifest** is written by the build, not edited by hand: name `@it-bbox/binnacle`, version from the CLI's package, `bin` with `binn` and `binnd` pointing at the bundles, `type: module`, `engines` Node 24 as today, `license` Apache-2.0, `repository`, `homepage` and `bugs` for `it-bbox/binnacle`, a `files` list, `publishConfig.access: public`, and no `dependencies`. The workspace's `@binnacle/cli` manifest keeps its sources as `bin`, so the development link is unchanged; the workspace's packages stay `private`.
- **Paths from the code's own location.** Four places resolve a path relative to their source file: the daemon's entry that `binn daemon start` and the autostart service run, the dashboard's generated directory the daemon serves, the CLI's package directory holding the plugin and skills, and the version read from a `package.json`. Each resolves correctly in both layouts, the workspace and the installed package. The autostart service's recorded entry is the installed `binnd` bundle when Binnacle runs from the package.
- **The tarball test** is a separate script beside the live tests, not part of `pnpm test`, and needs no network once the workspace is installed: build, `npm pack`, install the tarball globally into a temporary prefix with a temporary `HOME` and `BINNACLE_HOME`, then drive the installed commands.
- **CI** gains a job that runs the tarball test on `ubuntu-latest`, `macos-latest` and `windows-latest`, as the autostart job does.
- **The MCP SDK** goes to the latest 1.x at or above 1.31.0. Binnacle uses only its stdio server.
- **Nuxt's tooling** goes to the latest releases that fix the audit's advisories without changing the dashboard's major versions; any advisory left open is listed, with why it is kept, in `docs/operations/04-security-resilience.md`.
- **`SECURITY.md`** at the root: the supported version, reporting through GitHub's private vulnerability reporting, what is in scope (the daemon's loopback API, the token, the dashboard, the CLI), and the security boundary as `docs/01-architecture.md` states it, linked rather than repeated.
- **Dependabot**: one configuration, npm for the workspace and GitHub Actions, weekly, with minor and patch updates grouped.
- **The README** is rewritten short: the problem and the core principle in a few lines; install; the new-project and existing-project paths as lists; harnesses in one table row each; links to the guides; the design docs and ADRs as further reading; licence. What it now holds in paragraphs moves to the guide that owns it.
- **The user guides** are `docs/operations/`'s pages — new project, existing project, external tools, security and resilience, installation checklist — plus a new page for working from another harness and `CONTRIBUTING.md` for development from a checkout. Each is reworked into short paragraphs, headings, lists and tables, and checked against the current behaviour. Each has a `*.ru.md` twin beside it whose relative links point at the Russian pages.
- **`AGENTS.md`'s language rule**: the exception for `README.ru.md` becomes an exception for every user guide — `README.md`, `CONTRIBUTING.md`, `SECURITY.md` and `docs/operations/*.md` — whose Russian twin is updated in the same change.
- **Install names in the docs**: every user-facing mention of installing Binnacle names `@it-bbox/binnacle`; `npx binn` is removed. Contributor commands that filter the workspace keep `@binnacle/cli`.
- **ADR-0044** records the package's form and name; ADR-0010, ADR-0016 and ADR-0027 get a status line pointing to it.
- **The roadmap's long paragraphs** are rewritten by a Product session, not by a ticket: an implementation session does not edit the roadmap (`CLAUDE.md`).

## Testing Decisions

A good test drives what a user drives — the installed commands, the files on disk a reader opens — and never an internal function's shape. The seams were confirmed with the owner on 2026-10-13.

- **The installed package**, from its tarball, in a temporary prefix with a temporary home: `binn --version` prints the version; `binn daemon start` starts a daemon that answers `/health`; `/` serves the dashboard's page, not the page naming the generate command; `binn mcp` answers an MCP `initialize` and lists tools; the package holds the plugin, its marketplace manifest and a versioned plugin manifest; `binn daemon stop` stops it. Run in CI on Linux, macOS and Windows. Prior art: `apps/cli/test/autostart.live.ts` and its CI job.
- **The documentation**, offline in `pnpm test`: every user guide has its `*.ru.md` twin, and every relative link in `README.md`, `README.ru.md` and the guides resolves to an existing file. Prior art: the existing tests under `apps/cli/test/` that read the repository's files.
- **The MCP SDK upgrade** is covered by the existing offline tests of `packages/mcp` and `binn mcp`.
- **Readability** is judged by the owner at the exit demonstration, reading the README and the guides on GitHub in both languages.

## Contested points

- **One package or seven.** Seven mirrors the workspace, but makes seven versions to keep in step and the internals a public API. Taken: one bundled package (ADR-0044).
- **The package's name.** `@binnacle` is taken; an unscoped `binnacle-cli` would be free. Taken: `@it-bbox/binnacle`, the owner's npm organisation, matching the GitHub one.
- **Who publishes.** CI on a tag with provenance is more reproducible, but needs a token in CI's secrets and setup before tonight. Taken: the owner, by hand.
- **The repository's history.** A squashed history looks cleaner, but loses the link between tickets, ADRs and commits and needs a force-push to `main`; the audit found no secret in it. Taken: opened as it is.
- **How short the README is.** Keeping every section with better formatting keeps everything in one place; a short README with guides is what a GitHub reader scans. Taken: short, with the detail in guides.
- **Which documents get a Russian twin.** All of `docs/` would double every ticket's writing; the README alone leaves Russian readers at the first link. Taken: the README and every user guide.
- **What gives way to the deadline.** Taken: nothing; the order is the audit, the documentation, then npm and open source.

## Out of Scope

- Publishing the workspace's internal packages, or renaming them.
- Publishing from CI, npm provenance and trusted publishing.
- Standalone binaries, Homebrew, winget or any other channel than npm (ADR-0016).
- Russian versions of ADRs, specs, the roadmap or the design docs.
- A code of conduct, issue and pull request templates, a changelog tool.
- Epics 12 and 13, which follow in open source.

## Further Notes

The test seams, confirmed by the owner on 2026-10-13: the installed package from its tarball, driven as a user drives it, in CI on Linux, macOS and Windows; an offline test that every user guide has its Russian twin and that relative links resolve.

The owner's own machine runs `binn` from the development link and a systemd unit pointing at the checkout's daemon. Installing `@it-bbox/binnacle` globally on that machine would put a second `binn` on `PATH`; the exit demonstration installs it into a clean environment instead — a temporary prefix and home, or a container — and the owner's setup stays as it is.

The owner's own steps, outside any ticket: log in to npm and publish from the built package's directory; turn on private vulnerability reporting and Dependabot alerts in the repository's settings; make the repository public.

## Risks

- **What it can break.** The development link and every session's MCP tools, if the path changes for the bundle break the workspace layout; and the autostart service, which records the daemon's entry path.
- **The riskiest step.** The bundle on Windows: npm's command shims, paths and the dashboard directory are checked only by CI's `windows-latest` job, and nobody on the team runs Windows.
- **What was dropped, and why.** Publishing from CI, a squashed history and Russian design docs, to release tonight with the least new surface; each can follow in open source.
