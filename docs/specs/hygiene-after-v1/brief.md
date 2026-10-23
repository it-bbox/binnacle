# Hygiene after v1: what the grilling decided

Epic 20's material is `docs/product-inbox.md`: *Derived roadmap state without a yes* (2026-10-16), *A shared sanitizer for manifest text in output* (2026-10-16), *A session named so a person knows it* (2026-10-21), *Wording left after epic 13*, *TypeScript 7* and *The daemon's own version* (2026-10-22), *A flaky audit test* (2026-10-23), and the roadmap's line for epic 20, which adds `/binnacle:roadmap` reading the product inbox. This brief is what `/to-spec` starts from.

## The problem

v1 shipped with small debts that each cost the owner attention. The owner is asked to confirm an epic's status and the *Done* line after every autopilot run, though both follow from the tickets alone. The context-pressure item names a session by its UUID, and on 2026-10-21 the owner took another session's warning for their own. A Russian report still carries an English term, a wrong plural, a manifest key and reasons with no code. `binn daemon status` says 0.1.0 while 0.3.0 is released. Manifest text reaches a terminal with control and bidi characters left in. Dependabot's pull request #4, TypeScript 7, has been open since 2026-10-20. And `/binnacle:roadmap`, run again on a planned roadmap, ignores the product inbox, so epics 20 to 23 were cut from it by hand.

## The outcome wanted

After an autopilot run or a checkpoint, the roadmap's table and *Done* line are right without a question to the owner, who is asked only about the focus's prose and the `Next action:`. A warning about a session says which session in words a person recognises. The Russian output reads as Russian. The daemon reports the released version. TypeScript 7 is the workspace's compiler, or the reason it is not is written down. `/binnacle:roadmap` proposes the next epics from the product inbox. 0.4.0 is released with all of it.

## Who it concerns

The owner, who runs autopilot and Product sessions on this repository every day; anyone who installed `@it-bbox/binnacle` and reads its Russian output or `binn daemon status`.

## The systems it touches

- the roadmap's *Keeping this current* rules, `docs/workflow/`, `CLAUDE.md`, and the skills that write the roadmap: `/binnacle:autopilot`, `/binnacle:checkpoint`, `/binnacle:product`;
- the `context.pressure` attention item in core, its wording in `packages/core/src/wording.ts`, and the `binnacle` MCP server, which learns the caller's session;
- `/binnacle:product`'s Russian report, the reasons with no code in `packages/core/src/roadmap.ts` and `apps/daemon/src/graph.ts`;
- `apps/daemon/src/version.ts` and the bundled package;
- `apps/cli/test/audit.test.ts`'s fixture listing, which counts Git's own files;
- the manifest values printed by `binn audit`'s tracker checks;
- the root `typescript`, `apps/dashboard`'s, and `.github/dependabot.yml`;
- `/binnacle:roadmap`'s *Again* entry.

## Decided in the grilling, 2026-10-23

- **The derived part of the roadmap is written without a yes.** Autopilot at the end of its run, a checkpoint and a Product session set an epic's status (`tickets` → `in progress` → `done`) and the focus's *Done* line from the tickets' statuses, and commit them with no question. The focus's prose and the `Next action:` stay on the owner's yes. The file in Git stays true without Binnacle (principle 3), which is why the derived part is written rather than only shown.
- **TypeScript 7 is a ticket of this epic.** The workspace root moves to 7, which closes pull request #4. `apps/dashboard` stays on 5.x while `vue-tsc` cannot run on 7, with that rule written in `.github/dependabot.yml` beside the one for `@types/node`, and the typecheck's time measured before and after.
- **A session is named by its times, and as this one or another where the harness tells.** The context-pressure item says "another Product session, started at 15:30, latest activity 16:45" rather than a UUID. It says whether the session is the caller's own only where the harness gives the caller's session: Claude Code passes `CLAUDE_CODE_SESSION_ID` to the MCP server it starts. The UUID stays in `params`, and the Russian line names the threshold, not the manifest key.
- **The epic ends with its exit demonstration and 0.4.0.** The last ticket is the exit demonstration, `ready-for-human`, with the owner's manual checks, and 0.4.0 installed from the registry into a clean container, where the daemon's version from npm is checked too. The owner publishes, as before.

Defaults, from the docs and the inbox, not put to the owner:

- **Which statuses are derived**: the same rule `/binnacle:roadmap` applies to an existing project. `tickets` when an epic's spec has tickets and none is `DONE`, `in progress` when some are `DONE` and some open, `done` exactly when every one is `DONE` or `CANCELLED`. An epic whose last ticket is a `ready-for-human` exit demonstration is `in progress` until that ticket is `DONE`. `not started` and `spec` stay a Product session's to write, as now. The writer takes progress from the snapshot rather than counting tickets itself, and falls back to the tickets' `Status:` lines without the daemon.
- **A ticket still never touches the roadmap.** Its last commit sets only its own `Status: DONE` (`CLAUDE.md`), which keeps ticket branches free of conflicts on `docs/roadmap.md`.
- **No ADR for the yes rule.** The rule that changes lives in the roadmap's *Keeping this current*, where the owner's earlier rulings are recorded, and in `docs/workflow/`; the spec says so.
- **One version, the released package's.** The daemon reports the version of the package it ships in (ADR-0044); the spec checks what the bundled daemon reads today before changing it.
- **One sanitizer for manifest text in a terminal**, in core: C0 and C1 controls and bidi overrides removed or escaped, used by every place that prints a manifest value, the tracker checks first.
- **The wording**: "Два из них" agrees with its noun, "pull request'ам" becomes Russian, and the reasons with no code get a code, worded in `wording.ts` like the rest (`graph.unavailable`'s `kind` is already worded there).
- **`/binnacle:roadmap` reads the product inbox in *Again***: each entry not yet planned is a candidate epic or part of one, with its reason. On the owner's yes the entries taken are marked "Planned as epic N" or "Planned into epic N" with the date, as on 2026-10-22, and stay until their epic's grilling.

## Constraints and open questions

- Small enough for autopilot, one ticket after another, the exit demonstration last.
- Binnacle stays optional: every writer of the roadmap works without the daemon (`AGENTS.md`, principle 3).
- Open: which other harnesses tell a child process their session, for the "this one or another" word; whether `vue-tsc` already runs on TypeScript 7 when the ticket starts; whether the daemon from npm already reports 0.3.0.
