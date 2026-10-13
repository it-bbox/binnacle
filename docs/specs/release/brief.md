# Release: what the grilling decided

Epic 17's material is `docs/product-inbox.md`, *Security audit before the release* and *Readable documentation before the release* (both 2026-10-13), with ADR-0010, ADR-0016, ADR-0027 and ADR-0031. This brief is what `/to-spec` starts from.

## The problem

On the evening of 2026-10-13 a video presents Binnacle as published to npm and open source. Neither is true yet. Every package is `private`, and `binn` points at a TypeScript file that Node refuses to run from `node_modules`, so `npm i -g` would install nothing that runs. The audit before the release found a vulnerable `@modelcontextprotocol/sdk`, no way to report a vulnerability, nothing that updates dependencies, and advisories in Nuxt's build tooling. The README starts well, then turns into walls of text, in English and in Russian alike. The repository `it-bbox/binnacle` is private.

## The outcome wanted

Tonight a user types one `npm i -g` and gets a working `binn`: the daemon, the dashboard and the skills, on Linux, macOS and Windows. The repository is public under Apache-2.0, with a short README and readable guides in English and Russian. The audit's findings are fixed first, the documentation second, and npm and open source last (the owner, 2026-10-13).

## Who it concerns

Every user after the video, many of them Russian-speaking and a large share on Windows (ADR-0016). The owner, who publishes the package and opens the repository. Contributors, who meet a public repository with a way to report a vulnerability.

## The systems it touches

- the CLI package: a build that produces the published package, its manifest and its name;
- `@modelcontextprotocol/sdk` and the dashboard's Nuxt tooling;
- CI, which gains a test of the installed package on three platforms, and Dependabot;
- `README.md`, `README.ru.md`, the user guides under `docs/operations/`, `SECURITY.md` and `CONTRIBUTING.md`;
- `AGENTS.md`'s language rule;
- ADR-0010, ADR-0016 and ADR-0027, and a new ADR-0044.

## Decided in the grilling, 2026-10-13

- **One published package**, holding `binn`, `binnd`, the generated dashboard and the `binnacle` plugin. The workspace's own packages stay private and are never published.
- **It is named `@it-bbox/binnacle`.** The npm scope `@binnacle` is taken, and the owner has created the npm organisation `it-bbox`, which matches the GitHub organisation. The commands stay `binn` and `binnd`.
- **Version `0.1.0`.**
- **The owner publishes by hand**, `npm publish --access public` from their own machine. No publishing from CI.
- **The repository opens as it is, with its whole history**, as the last step.
- **A short README**: what Binnacle is and why, the install command, the two short paths, links. The detail moves into the guides that own it.
- **Russian twins**: `README.md` and every user guide it links have a `*.ru.md` beside them, changed in the same change. ADRs, specs, the roadmap and the design docs stay English only.
- **Tonight**: no item is dropped to meet the deadline; the work starts now.

Defaults taken from the ADRs, the audit and Ponytail: the audit first, the documentation second, npm and open source last; `@modelcontextprotocol/sdk` to 1.31.0 or later; Nuxt updated where a fixed release exists; `SECURITY.md` pointing to GitHub's private vulnerability reporting, which the owner turns on once the repository is public; Dependabot for npm and GitHub Actions, weekly; esbuild bundles the package, and the development link keeps running from the sources; the docs install with `npm i -g @it-bbox/binnacle`, since the unscoped `binn` on npm is someone else's package and `npx binn` would run it; ADR-0044 records the package's form and name, and amends ADR-0010, ADR-0016 and ADR-0027; the roadmap's long paragraphs are rewritten by a Product session, since a ticket does not edit the roadmap.

## Open questions

None left for the owner. The test seams were confirmed on 2026-10-13: the installed package, driven as a user drives it, in CI on three platforms; an offline test that every user guide has its Russian twin and that their relative links resolve.
