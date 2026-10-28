# 02: The mod's status line

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/claude-code-mod/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** the first tracer bullet through the mod (ADR-0047). A person who installs `binnacle-mod` from the package's marketplace sees, in a Claude Code session of a registered project, the mod's status line under the prompt. It shows the session's Task id, or its role alone; its tokens as Binnacle counts them; its context percentage; and each rate-limit window's use. A part with no data is left out. This ticket covers the spec's *One plugin of its own*, *The view*, *The status line*, *Refresh*, *Silence*, *Language* and *Surfaces*.

The mod's source lives in the CLI app beside the plugin: a hooks module and a pure view module. The build bundles them, with `@binnacle/core`'s wording, into one ES module with no dynamic `import()`, written into the package with the mod's manifest. The manifest's version is drawn from its files, as `preparePlugin` draws `binnacle`'s. The package's marketplace lists `binnacle-mod` beside `binnacle`.

The hooks read `project_snapshot` through `$.mcp.call` on the `binnacle` server, passing `$.session.id()` as `session`, and read `$.session.usage()`'s `context` and `rateLimits`. They refresh at `session.start`, at `session.measure` and on a 60-second `$.clock` timer. The language follows `binn`'s locale rule, through `$.env.get`. The minimum Claude Code version the mod was validated on is one constant beside it.

- [x] The view function, through `node:test`:
  - a session with a Task gives its id and role;
  - a session with no Task gives its role, or nothing without a run;
  - tokens come from `activity.own`;
  - no rate-limit windows and an unknown context leave those parts out;
  - English and Russian.
- [x] Silence: an MCP error, a missing `binnacle` server, `daemon.unreachable` or `project.not_registered` clears the line, and the next refresh after the daemon starts shows it again.
- [x] `apps/cli/test/pack.test.ts`:
  - the built package holds the mod's manifest with a version and its hooks module;
  - the marketplace lists both plugins;
  - the hooks module is one file with no dynamic `import()`.
- [x] A live test, run only where `claude` is on PATH: `claude plugin validate` on the built mod reports nothing the engine refuses, and `claude plugin test` runs a hooks test that drives `session.start` and a refresh.

## Comments

Decisions taken here, none of them the owner's:

- The tokens on the line are the session's output tokens alone, marked "(from activity)" and, when only some records report them, "partial". The docs never add token kinds together and show output by default (`docs/04-telemetry-dashboard.md`, *Usage*). An input-heavy session therefore shows a small figure.
- The source is `apps/cli/src/mod/hooks.ts` and `view.ts`. `prepareMod` in `apps/cli/src/prepare.ts` bundles them with esbuild into `mod/hooks/hooks.js`, beside `hooks/hooks.json` and the manifest. The `prepare` script writes `apps/cli/mod/` (ignored, as `plugin/` is) and `build.ts` writes `dist/mod/`. The marketplace lists `./mod`.
- The version is drawn from the built files, with `preparePlugin`'s digest. The build runs from the CLI app (`absWorkingDir`), so the bundle's path comments do not depend on the directory it is started from.
- The locale rule moved into `@binnacle/core` as `personLanguage(env)`, which `binn` and the mod share. The view imports the daemon's `Snapshot` as a type only, now exported from `@binnacle/daemon`.
- The hooks type the few parts of `$` they use locally, since Claude Code writes its declarations only beside a mod it loads. `MINIMUM_CLAUDE_CODE` (2.1.308) is in `hooks.ts`.
- Every refresh runs unawaited. Claude Code awaits `session.start` before the first prompt, and a snapshot on a cold forge cache takes seconds. Two refreshes may finish out of order (`ponytail:` in `hooks.ts`).
- *Surfaces*: the status line is text through `$.ui.status`, the same on every surface, so there is no tree yet. The view takes no width or previous state yet: tickets 03 to 05 add what they need.

For the next tickets:

- `view()` returns `{ status }`. The band, the pane and the toasts add their fields to it, and their inputs (width, the previous state) when they need them.
- `claude plugin validate` reads the bundle's source and refuses some shapes:
  - `register` must be a function declaration, not an arrow bound to a name;
  - `$` must be spelled `$.noun.method(...)` at the call site;
  - `$.env.get` takes a literal name.
- `claude plugin test` runs the hooks test inlined in `apps/cli/test/mod.live.ts`. A refresh runs unawaited, so the test calls `clock.settle()` after an event. The tests live inline because a `*.test.ts` importing `claude-code/testing` would break the typecheck and `pnpm test`.
- JSX: the root `tsconfig.json` includes only `.ts`, and a `.tsx` tree needs `jsxFactory: 'h'` in both `tsc` and esbuild.
- `Intl` exists in the mod's environment, and `@binnacle/core`'s `wording.ts` is already in the bundle, so `wordMessage` costs nothing more.
- `docs/03-mcp-and-skills.md` does not describe the mod yet. That is part of the spec's *Docs*, and ticket 06's criteria name only the README and the installation checklist.

Known outside this ticket: `apps/cli/test/pack.test.ts`'s "the five reporting skills ... list CONTEXT.md's Russian words" (*Mod — мод*) still fails, as on `main`.

### Review

Reviewed in a sub-agent against `main`, on the standards and the spec. Every criterion holds and no finding was must-fix; `claude plugin validate` and `claude plugin test` pass on the built mod.

- Fixed: the mod's version depended on the directory the build ran from, through esbuild's path comments. `absWorkingDir` is set now, and `pack.test.ts` builds from two directories and expects the same version.
- Fixed: the numbers were formatted by hand, with no billions step, under a false claim that `Intl` was missing. `Intl.NumberFormat` (compact) and `Intl.PluralRules('ru')` do it now.
- Fixed: four token kinds were added into one figure, against the docs' rule. Output alone now, marked partial (`view.ts`).
- Fixed: `session.start` awaited the snapshot and held the first prompt; `session.measure` did the same. Both refresh unawaited now (`hooks.ts`).
- Fixed: Russian through `$.env.get` was untested. A hooks case reads `LC_ALL=ru_RU.UTF-8` (`mod.test.ts`).
- Fixed: two refreshes overlapping has a `ponytail:` comment.
- Fixed: the marketplace entry no longer cites the ADR to users.
- Fixed: `pack.test.ts` no longer compares the mod's version with the plugin's.
- Kept: the label "(from activity)", the project's mark for a reading from runs (the skills, the dashboard's `fromActivity`).
- Kept: `$.ui.status` in `refresh`'s `catch` is not wrapped. It is a synchronous void call that the engine documents no failure for.

#### Architect

No finding.

- The source sits in `apps/cli/src/mod/`. `prepareMod` serves both `prepare` and `build`, and `.gitignore`, the package's `files` and `tarball.live.ts` agree with it.
- The `Snapshot` import is erased, the locale rule has one home in `@binnacle/core`, and the local `Engine` type is the simplest option.
- `wording.ts` ships whole for one function, about 60 KB, which tickets 03 to 05 will use.
