# 02: The mod's status line

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/claude-code-mod/spec.md`
Roles: Developer, Reviewer, Architect

**What to build:** the first tracer bullet through the mod (ADR-0047). A person who installs `binnacle-mod` from the package's marketplace sees, in a Claude Code session of a registered project, the mod's status line under the prompt. It shows the session's Task id, or its role alone; its tokens as Binnacle counts them; its context percentage; and each rate-limit window's use. A part with no data is left out. This ticket covers the spec's *One plugin of its own*, *The view*, *The status line*, *Refresh*, *Silence*, *Language* and *Surfaces*.

The mod's source lives in the CLI app beside the plugin: a hooks module and a pure view module. The build bundles them, with `@binnacle/core`'s wording, into one ES module with no dynamic `import()`, written into the package with the mod's manifest. The manifest's version is drawn from its files, as `preparePlugin` draws `binnacle`'s. The package's marketplace lists `binnacle-mod` beside `binnacle`.

The hooks read `project_snapshot` through `$.mcp.call` on the `binnacle` server, passing `$.session.id()` as `session`, and read `$.session.usage()`'s `context` and `rateLimits`. They refresh at `session.start`, at `session.measure` and on a 60-second `$.clock` timer. The language follows `binn`'s locale rule, through `$.env.get`. The minimum Claude Code version the mod was validated on is one constant beside it.

- [ ] The view function, through `node:test`:
  - a session with a Task gives its id and role;
  - a session with no Task gives its role, or nothing without a run;
  - tokens come from `activity.own`;
  - no rate-limit windows and an unknown context leave those parts out;
  - English and Russian.
- [ ] Silence: an MCP error, a missing `binnacle` server, `daemon.unreachable` or `project.not_registered` clears the line, and the next refresh after the daemon starts shows it again.
- [ ] `apps/cli/test/pack.test.ts`:
  - the built package holds the mod's manifest with a version and its hooks module;
  - the marketplace lists both plugins;
  - the hooks module is one file with no dynamic `import()`.
- [ ] A live test, run only where `claude` is on PATH: `claude plugin validate` on the built mod reports nothing the engine refuses, and `claude plugin test` runs a hooks test that drives `session.start` and a refresh.
