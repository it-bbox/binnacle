# 06: Guides for tools, security, installation and the release

Status: READY
Triage: ready-for-agent
Blocked by: 03, 04
Spec: `docs/specs/release/spec.md`
Roles: Developer, Reviewer

**What to build:** the rest of the user guides read easily and match the published package, in both languages (spec, *The user guides*, *Install names in the docs*). The external tools guide, the security and resilience guide and the installation checklist are reworked as ticket 05 reworks its three, and checked against the current behaviour; installation is `npm i -g @it-bbox/binnacle`, with `npx -p @it-bbox/binnacle binn` for a one-off run. `CONTRIBUTING.md` gains the release: the build, the tarball test, and the owner's publishing steps — `npm login`, then `npm publish --access public` from the built package's directory. Each Russian twin is updated in the same change.

- [ ] No paragraph in these pages, in either language, runs past about six lines; enumerations are lists or tables.
- [ ] The installation checklist installs from npm and works as written on a clean machine, as ticket 03's tarball test drives it.
- [ ] `CONTRIBUTING.md` and its twin give the build, the test and the publishing steps.
- [ ] The twin and link test passes.

## Comments

### Decisions

- **Checked against the code, and against the installed package.** Each claim was traced to `apps/cli/src/tools.ts`, `init.ts`, `export.ts`, `dashboard.ts`, `daemon-commands.ts`, `bin.ts`, `build.ts`, `apps/daemon/src/server.ts`, `home.ts` and `ci.ts`. The tarball test passed here, on Linux. Steps 2 to 5 of the checklist were then run against the packed tarball in a throwaway prefix and home, with `BINNACLE_PORT=0`: `binn --version`, `binn daemon start` and `status`, `binn dashboard --print`, `binn init --plan --json` in a new repository, `binn project list`, `binn call project_detect`, `binn daemon stop`.
- **No new test.** The spec's seams are the twin and link test, which covers these pages, and the tarball test, which drives what the checklist's install does; readability is the owner's judgement (spec, *Testing Decisions*). Every paragraph and list item is at most about 400 characters, four lines on GitHub at a laptop's width; only table rows run longer.
- **What was stale, and where it went.**
  - `04-security-resilience.md` said the daemon reads with no token at `/health` alone; the dashboard's generated files are served with none too (`serveStatic`). The routes are now a table, with the Content-Security-Policy and the dashboard's token in the fragment and in local storage. "Daemon/Dashboard/MCP HTTP endpoints" became the daemon on `127.0.0.1` and `binn mcp` over stdio.
  - The checklist and `CONTRIBUTING.md` said `binn dashboard --print` prints the address "without opening anything"; it prints it with the token. Both say so now.
  - The checklist named opencode and VS Code as the harnesses that cannot export; `NO_EXPORT` also holds ZCode, Antigravity and pi.
  - *Secrets* said the audit "should" find committed secrets with an external tool; it does not yet, and `docs/05-mvp-plan.md`'s phase 12 plans it by known patterns. The page says that.
  - The checklist's *Required for Binnacle development* (Node, pnpm, Git) became the user's prerequisites, without pnpm; development stays in `CONTRIBUTING.md`. Its *Recommended* sections repeated `03-external-tools.md`; their upstream commands became that page's *By hand, without `binn init`* table. Its *`binn init` expected summary* was a target UX the Summary does not print; `01-new-project.md` already describes the real one and the one plan.
  - `03-external-tools.md`'s *Node / pnpm* was the contributors' stack, already in `CONTRIBUTING.md`. *Provider/harness support* was a design note; `CONTEXT.md` defines both terms, and the page links it.
- **Added where the guide was silent**: the checklist's one-off `npx -p @it-bbox/binnacle binn audit`, the upgrade steps, the exit codes as a table, and a check after each step; `CONTRIBUTING.md`'s *Releasing*, with the build, the tarball test, `npm login` and `npm publish --access public` in `apps/cli/dist/`, and the tarball test in *Checking a change*.
- **Upgrading** stops the daemon before `npm i -g @it-bbox/binnacle@latest` and starts it after, since a running daemon keeps the old code; Claude Code's copy of the plugin needs `claude plugin marketplace update binnacle` and `claude plugin update binnacle@binnacle`, as `binn init` leaves a listed plugin alone; a second `binn init` reinstalls Binnacle's skills into the other harnesses.
- **Headings renamed**: the checklist's *Telemetry capability check* is *Telemetry export*. No live page linked the old one. *When a harness cannot find binn*, *Tracker credentials*, *Optional: Obsidian* and *The vault projection* keep their names, which the README and `docs/03-mcp-and-skills.md` link or cite.

### For the owner

- `binn project register` in a repository without a manifest says "Start one from templates/project/project.yaml.example", a file only a checkout has. A user from npm runs `binn init` instead. A Product session can put the message's fix in the product inbox.
- The plugin's skills still point to "the README's setup section (*Install*, and *From this repository* until the npm package is published)", as ticket 04's review kept. The pointer still leads to the right sections; dropping the clause changes the plugin's files, which this ticket's guides do not cover.

### For ticket 07

The release steps are `CONTRIBUTING.md`'s *Releasing*: the tarball test or CI's `tarball-live` job green, then `npm login`, `cd apps/cli/dist`, `npm publish --access public`, and `npm view @it-bbox/binnacle version`. The clean install from the registry follows the installation checklist's steps 1 to 5.
