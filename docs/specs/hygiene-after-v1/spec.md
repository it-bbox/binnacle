# Spec: Hygiene after v1

Status: READY
Triage: ready-for-agent

Epic 20, from its grilling's brief, `docs/specs/hygiene-after-v1/brief.md` (2026-10-23), and the product inbox's entries planned into it: *Derived roadmap state without a yes*, *A shared sanitizer for manifest text in output*, *A session named so a person knows it*, *Wording left after epic 13*, *TypeScript 7*, *The daemon's own version* and *A flaky audit test*, with the roadmap's line that adds `/binnacle:roadmap` reading the product inbox. Exit criterion: after an autopilot run or a checkpoint the roadmap's status column and *Done* line are right with no question to the owner; a context-pressure warning names its session by its times and, in Claude Code, as this session or another; the Russian report and vault carry no English term, wrong plural, manifest key or reason with no code; `binn daemon status` gives the released version, from the source checkout and from npm; manifest text reaches a terminal without control or bidi characters; the workspace compiles with TypeScript 7 and pull request #4 is closed; `/binnacle:roadmap`, run again, proposes epics from the product inbox; and 0.4.0 is installed from the registry into a clean container. The owner confirmed the test seams on 2026-10-23, recorded under *Further Notes*.

## Problem Statement

v1 shipped with small debts that each cost the owner attention.

After every autopilot run the owner is asked to confirm an epic's status and the focus's *Done* line, though both follow from the tickets alone; the one real choice, the `Next action:`, is buried among them.

The context-pressure warning names a session by its UUID. On 2026-10-21 the owner took another session's warning for their own: nothing in the line said which session it was, or that it was not the one they were in. In Russian the same line names the manifest key `telemetry.context_pressure.tokens`.

The Russian output still reads as translated in places: "Две из них" for "Два из них", "по pull request'ам", and two reasons with no code reaching the vault in English, marked `(англ.)`: the Suggested step's descriptions and the graph's reason when it is not available.

`binn daemon status` says 0.1.0 while 0.3.0 is released, because the daemon in a source checkout reads its own workspace package's version. Manifest values reach a terminal with C1 controls and bidi overrides left in. A test of the audit fails when Git's background maintenance writes into the fixture's `.git` in the middle of it, and failed CI on `main` on 2026-10-23. Dependabot's pull request #4, TypeScript 7, has been open since 2026-10-20.

And `/binnacle:roadmap`, run again on a planned roadmap, ignores the product inbox, so epics 20 to 24 were cut from it by hand.

## Solution

At the end of an autopilot run, in a checkpoint and in a Product session, the roadmap's derived part — an epic's status from `tickets` on, and the focus's *Done* line — is written from the tickets' statuses and committed without a question. The owner is asked only about the focus's prose and the `Next action:`.

A context-pressure warning names its session by when it started and its latest activity, and in Claude Code says whether it is the session that asked or another one. Its Russian line names the threshold, not the manifest key.

The Russian output agrees in number and gender, uses Russian words for English terms, and words every reason from a code. The daemon reports the released package's version wherever it runs. One sanitizer in core strips control and bidi characters from every manifest value printed to a terminal. The audit's test compares the working tree only. The workspace compiles with TypeScript 7, the dashboard staying on 5.x while `vue-tsc` needs it, with the rule in Dependabot's file.

`/binnacle:roadmap`, run again, reads the product inbox and proposes each entry not yet planned as an epic or part of one, marking the entries taken on the owner's yes. 0.4.0 is released with all of it.

## User Stories

1. As the owner, I want autopilot to set an epic's status in the roadmap from its tickets at the end of a run, without asking me, so that I answer only the questions that are mine.
2. As the owner, I want a checkpoint to do the same, so that a Product session's roadmap is right without my yes on what the tickets already say.
3. As the owner, I want a Product session to correct a status that the tickets contradict without asking, so that `roadmap.status_mismatch` does not wait for me.
4. As the owner, I want the focus's *Done* line written from the epics marked `done`, so that it never lags the table.
5. As the owner, I want an epic moved `tickets` → `in progress` when its first ticket is `DONE`, and `in progress` → `done` exactly when every ticket is `DONE` or `CANCELLED`, so that the status means one thing everywhere.
6. As the owner, I want an epic whose last ticket is a `ready-for-human` exit demonstration to stay `in progress` until I set that ticket `DONE`, so that an epic is never called done before my checks.
7. As the owner, I want `not started` and `spec` to stay a Product session's to write, so that a planning step is never inferred.
8. As the owner, I want the focus's prose and the `Next action:` still written only on my yes, so that the course stays mine.
9. As the owner, I want the derived part committed on its own, with a message that says it is derived, so that I can tell it from my decisions in the log.
10. As the owner, I want nothing derived written when the tickets and the table already agree, so that no empty commits appear.
11. As the owner, I want the writer to take each epic's progress from the snapshot, and from the tickets' `Status:` lines when the daemon is down, so that Binnacle stays optional.
12. As the owner, I want a ticket's last commit still to touch only its own `Status:`, so that ticket branches never conflict over `docs/roadmap.md`.
13. As the owner, I want the roadmap's *Keeping this current* and the workflow docs to say who writes what after the change, so that the next session follows the new rule.
14. As the owner, I want a context-pressure warning to say when the session started and when it was last active, so that I can tell which session it means.
15. As the owner in Claude Code, I want the warning to say whether it is about the session I am in or another one, so that I never act on another session's warning.
16. As a user of a harness that does not tell its session to the MCP server, I want the warning without "this" or "another", so that Binnacle never guesses.
17. As a user of `binn call` in Claude Code's shell, I want the same "this" or "another" as through MCP, so that both routes agree.
18. As a Russian-speaking owner, I want the warning to name the threshold in words, not `telemetry.context_pressure.tokens`, so that it reads as a sentence.
19. As a script reading the snapshot, I want the session's UUID still in the item's `params`, so that nothing that reads it breaks.
20. As a Russian-speaking owner, I want "Два из них" agreeing with its noun in `/binnacle:product`'s report, so that the Russian is correct.
21. As a Russian-speaking owner, I want "по пулл-реквестам" rather than "по pull request'ам", so that a Russian line has no English term.
22. As a Russian-speaking owner, I want the Suggested step's descriptions in Russian in the vault and on the dashboard, so that no line is marked `(англ.)`.
23. As a Russian-speaking owner, I want the graph's reason, when it is not available, worded from its code in the vault, so that it reads in Russian.
24. As a skill reading the snapshot, I want each Suggested step to carry its `kind` and `params`, so that it can word the step in the person's language.
25. As a user running `binn daemon status`, I want the version of the Binnacle I installed, so that I can tell which release runs.
26. As the owner running from a source checkout, I want the daemon to report the version the release bumps, so that my checkout says 0.4.0, not 0.1.0.
27. As a user who installed from npm, I want the daemon's version checked in the clean container, so that what npm ships is known, not assumed.
28. As a user, I want a manifest value printed by `binn audit` stripped of control and bidi characters, so that a manifest cannot rewrite my terminal or reverse a line.
29. As a user, I want every place that prints a manifest value to use one sanitizer, so that a new place cannot forget it.
30. As a user, I want a stripped character shown as an escape, not dropped silently, so that I see that my manifest holds one.
31. As the owner, I want the audit's "nothing written" test to compare the working tree without `.git`, so that Git's own maintenance cannot fail CI.
32. As the owner, I want the same test to still fail when the audit writes a file, so that the guarantee it checks stays checked.
33. As the owner, I want the workspace compiled with TypeScript 7, so that the faster native compiler is used and pull request #4 is closed.
34. As the owner, I want the dashboard kept on TypeScript 5.x while `vue-tsc` cannot run on 7, with that rule in `.github/dependabot.yml` beside the one for `@types/node`, so that Dependabot does not propose it again.
35. As the owner, I want the typecheck's time measured before and after TypeScript 7 and written in the ticket, so that the gain is known.
36. As the owner, if TypeScript 7 fails the typecheck or the tests in a way the ticket cannot fix, I want the reason written in the ticket and the pull request left open, so that the decision is recorded either way.
37. As the owner, I want `/binnacle:roadmap` run again to read the product inbox, so that the next epics are proposed from it rather than cut by hand.
38. As the owner, I want each inbox entry not yet planned proposed as a new epic or as part of an existing `not started` one, each with its reason, so that I judge the plan before anything is written.
39. As the owner, I want an entry the skill leaves out to be named with its reason, so that nothing is skipped silently.
40. As the owner, I want the entries taken marked "Planned as epic N" or "Planned into epic N" with the date, on my yes, so that the inbox says what became of each.
41. As the owner, I want marked entries kept in the inbox until their epic's grilling, so that the grilling reads them.
42. As the owner, I want an entry already marked planned never proposed again, so that a second run is quiet.
43. As the owner, I want the inbox read only in *Again*, so that a new project's first roadmap still starts from its vision.
44. As the owner, I want the epic closed by its exit demonstration, `ready-for-human`, with my manual checks, so that what agents do is seen working.
45. As the owner, I want 0.4.0 installed from the registry into a clean container in that demonstration, with `binn daemon status` checked there, so that the release is proven, not assumed.
46. As the owner, I want to publish 0.4.0 myself, as before, so that nothing reaches npm without me.
47. As the owner, I want the tickets small enough for autopilot, one after another, the exit demonstration last, so that the epic runs unattended.

## Implementation Decisions

- **The derived part of the roadmap.** Autopilot at the end of its run, `/binnacle:checkpoint` and a Product session write, without a yes:
  - an epic's status from `tickets` on: `tickets` while it has tickets and none is `DONE`; `in progress` while some are `DONE` and some open; `done` exactly when every one is `DONE` or `CANCELLED`. A `ready-for-human` ticket counts as any other, so an epic ending in an exit demonstration stays `in progress` until the owner sets it `DONE`. This is the rule `roadmap.status_mismatch` already checks and `/binnacle:roadmap` already applies to an existing project; `not started` and `spec` stay a Product session's to write on the owner's yes;
  - the focus's *Done* line, the epics marked `done`.

  The writer reads each epic's tickets and progress from `project_snapshot` (`roadmap.epics[].progress`, the `roadmap.status_mismatch` items), and from the tickets' `Status:` lines when the daemon is down; it counts nothing itself. It commits `docs/roadmap.md` alone, to the branch it is on, with a subject that says the change is derived from the tickets, and only when something changed; it never pushes. The focus's other prose and the `Next action:` stay on the owner's yes, in a commit of their own. A ticket still never touches the roadmap.
- **Where the rule is written**: the roadmap's *Keeping this current*, *Who writes what*; `docs/workflow/01-product-workflow.md` and `02-development-workflow.md`; `CLAUDE.md`'s *Project operating model*; the texts of `/binnacle:autopilot` (its report's roadmap item), `/binnacle:checkpoint` (a `position` draft that is only derived needs no yes) and `/binnacle:product`'s workflow guidance. No ADR: the roadmap's *Keeping this current* is where the owner's earlier rulings on who writes the roadmap are recorded, and this narrows one of them.
- **The caller's session.** The MCP server reads `CLAUDE_CODE_SESSION_ID` from its environment when it starts and adds it to every daemon call's body as `session`, beside `path`; `binn call` does the same from its own environment. `toolRequest` takes it as it takes `cwd`. A harness that sets no such variable sends none. Which other harnesses tell a child process their session is checked in the ticket; each one found is added the same way, and none is guessed.
- **The context-pressure item** (`context.pressure`) gains `params.startedAt` and `params.lastActivityAt`, the run's, and `params.own`: `true` when the request's `session` is the item's session, `false` when the request carries another, absent when it carries none. Its message names the session as "the Product session in Claude Code started at 15:30, latest activity 16:45", or "this Product session" / "another Product session, started at …", times in the daemon's local time; the UUID stays in `params.session` and leaves the message. The Russian line, in `wording.ts`, names the threshold as "не меньше порога в N токенов" with no manifest key. The snapshot passes the request's `session` through to the usage reading; nothing else in the snapshot changes with it.
- **The Suggested step's wording.** Each alternative already has its `kind`; it gains `params` with the values its description names (the epic's number and title, the Tasks' ids and titles, what each waits on). `wording.ts` words each kind in Russian, and the vault and the dashboard word alternatives through it, as they word attention; the English `description` stays for English and for scripts.
- **The graph's reason in the vault** is worded through the value's `code` and `params`, as `notAvailable` words every other unavailable value; `graph.unavailable`'s kinds are already worded.
- **`/binnacle:product`'s Russian**: its text gains "по пулл-реквестам" among the terms it lists for Russian, and an instruction that a counted phrase agrees with its noun. A model writes the report, so this is a text change, checked by the package build's test and the exit demonstration.
- **The daemon's version.** In the bundle the daemon already reads the published package's `package.json`, one level above `bin/`. In a source checkout it reads `apps/daemon/package.json`, never bumped. The source layout reads the CLI package's version instead, the one the release bumps (ADR-0044: one package, one version); `packageVersion`'s other callers are unchanged.
- **One sanitizer in core** for text printed to a terminal: C0 controls other than tab and newline, C1 controls, and the bidi controls (U+061C, U+200E–U+200F, U+202A–U+202E, U+2066–U+2069) are replaced by their `\u{…}` escape. Every place the CLI prints a manifest value uses it: `binn audit`'s tracker checks first (the forge's host and repository, the token's host), `binn daemon`'s missing-token line, and `binn init`'s plan where it quotes a manifest value. JSON output is unchanged: JSON escapes controls itself, and a script reads the value as it is.
- **The audit's test** lists the fixture's tree without `.git` before and after the audit; a file the audit writes in the working tree still fails it.
- **TypeScript 7.** The root `typescript` moves to `^7`, which closes pull request #4. `apps/dashboard` keeps `^5.9` while `vue-tsc` cannot run on 7, and `.github/dependabot.yml` gains an ignore for `typescript` `>=6` in `/apps/dashboard`, with a comment beside the one for `@types/node` saying when to lift it. The ticket measures `pnpm typecheck`'s time before and after and writes both under `## Comments`. Whether `vue-tsc` already runs on 7 is checked when the ticket starts; if it does, the dashboard moves too and no ignore is added. If the workspace cannot compile on 7 within the ticket, it writes why, leaves the pull request open, and is `DONE` with that finding.
- **`/binnacle:roadmap`'s *Again*** also reads `<knowledge.docs>/product-inbox.md`. Each entry not marked "Planned as epic N" or "Planned into epic N" is proposed as a new epic, with its line of scope, or as part of an existing `not started` epic, or named as left out, each with its reason. On the owner's yes, beside the roadmap's change, each entry taken gets the line `**Planned as epic N on YYYY-MM-DD.**` or `**Planned into epic N on YYYY-MM-DD.**` under its heading, as the inbox's entries of 2026-10-22 have, and stays in the inbox. *New project* and *Existing project* do not read it.
- **The release**: the CLI package's version becomes 0.4.0 in the exit demonstration's ticket, which the owner publishes.

## Testing Decisions

A good test exercises behaviour through the seam a caller uses, never an internal function's shape. This epic adds no seam.

- **The context-pressure item**, through the daemon's `project.snapshot`, as `apps/daemon/test/context-pressure.test.ts` does: the item carries the session's start and latest activity in its message and `params`, the UUID in `params.session` only; with the request's `session` equal to the item's, `own` is `true` and the message says "this"; with another, `false` and "another"; with none, no `own` and neither word.
- **The caller's session**, through `toolRequest` and `binn call`, as `packages/mcp/test/smoke.test.ts` and `apps/cli/test/locale.test.ts` call them: `CLAUDE_CODE_SESSION_ID` set reaches the body as `session`; unset, the body has none.
- **The Russian wording**, through `wordMessage`, as `packages/core/test/wording.test.ts` does: `context.pressure` names the threshold with no manifest key; each Suggested step's kind is worded from its `params`; and through the vault, as `apps/daemon/test/vault.test.ts` does: a Russian vault has no `(англ.)` for a Suggested step or for the graph's reason. `apps/daemon/test/codes.test.ts` keeps every code worded.
- **The Suggested step's `params`**, through `project.snapshot`, as `apps/daemon/test/next.test.ts` does: each kind carries the values its description names.
- **The sanitizer**, through `binn audit` on a fixture whose manifest's tracker host holds a C1 control and a bidi override, as `apps/cli/test/audit.test.ts` builds fixtures: the human output shows their escapes, `--json` keeps the value as it is.
- **The daemon's version**, through `binn daemon status` from the source checkout, as `apps/cli/test/smoke.test.ts` runs it: it equals the CLI package's version; and through the bundle, in `apps/cli/test/pack.test.ts`: `binnd`'s reported version equals the bundle's `package.json`.
- **The audit's test** itself: it no longer reads `.git`, and still fails when a file appears in the working tree.
- **The skill texts**, in `apps/cli/test/pack.test.ts`: autopilot and checkpoint write the derived part without a yes and keep the yes for the focus's prose and the `Next action:`; `/binnacle:roadmap`'s *Again* reads the product inbox and marks the entries taken; `/binnacle:product` lists the Russian term; the copies match the plugin.
- **TypeScript 7**, through the existing `pnpm typecheck`, `pnpm --filter dashboard typecheck` and `pnpm test`, in CI on the ticket's branch.
- **What agents do** — autopilot and a checkpoint writing the derived part, `/binnacle:product`'s Russian report, `/binnacle:roadmap` proposing from the inbox, the warning seen in a second session — is the exit demonstration's.

## Contested points

- **Writing to the roadmap with no yes.** A commit to `main` with no yes breaks the rule that a decision reaches the repository only once the owner confirms it. Taken in the grilling: the derived part is not a decision but a reading of the tickets, which the owner already set; only the focus's prose and the `Next action:` are decisions. The cost: a wrong ticket status reaches the roadmap without a second look.
- **Showing the derived status instead of writing it.** The snapshot and the dashboard already derive progress, so the table could stop carrying it. Taken: written, because the file in Git must stay true without Binnacle (principle 3).
- **"This session" from the environment.** Only Claude Code is known to pass its session to the MCP server; guessing by the latest activity would be wrong as often as right. Taken: "this" or "another" only where the harness tells, the times everywhere.
- **The daemon's version in source.** Bumping every workspace package on each release would keep seven versions in step by hand. Taken: the daemon reads the CLI package's version in the source layout, one number to bump.
- **Escaping or dropping a control character.** Dropping hides that the manifest holds one. Taken: the escape is printed.
- **The dashboard on TypeScript 5.x.** Two compilers in one workspace cost a rule in Dependabot's file and a check when `vue-tsc` moves. Taken in the grilling: the root moves now, the dashboard when `vue-tsc` can.

## Out of Scope

- The other entries of the product inbox, planned into epics 21 to 24, or not planned.
- A dashboard page for the context-pressure warning, or a way to act on another session from Binnacle.
- Harness support for telling the session beyond what a harness already gives a child process.
- A sanitizer for the dashboard: Vue escapes text it renders.
- Changing `not started` or `spec` without the owner, or the `Next action:` without the owner's yes.
- Lifting the dashboard to TypeScript 7 before `vue-tsc` runs on it.

## Further Notes

- **Decided in the grilling, by the owner on 2026-10-23** (`brief.md`): the derived part of the roadmap is written without a yes; TypeScript 7 is a ticket of this epic, the dashboard staying on 5.x; a session is named by its times, and as this one or another where the harness tells; the epic ends with its exit demonstration and 0.4.0.
- **Test seams confirmed by the owner on 2026-10-23**: the daemon's `project.snapshot`, the MCP server's `toolRequest` and `binn call`, `wordMessage` and the vault, `binn audit` and `binn daemon status`, and the package build's test over the skill texts; TypeScript 7 through the existing typecheck and tests; what agents do belongs to the exit demonstration.
- **Defaults taken from the brief, the docs and Ponytail, not asked**: which statuses are derived, the rule `roadmap.status_mismatch` checks; no ADR for the yes rule; the daemon's version from the CLI package in source; the sanitizer in core, escaping; the Russian term "пулл-реквест"; `/binnacle:roadmap` reading the inbox in *Again* only, marking entries as the inbox's entries of 2026-10-22 are marked.
- **Checked while specifying**: the bundle already places `binnd.js` one level below the package, so the daemon from npm most likely reports the package's version; the exit demonstration confirms it. `CLAUDE_CODE_SESSION_ID` is set in Claude Code's shell as well as for the MCP server it starts.
- **Order**: the audit's test first, since it keeps `main` red; then the version, the sanitizer, the session's name and the wording, which touch separate modules; the derived roadmap and `/binnacle:roadmap`'s *Again*, which are skill texts; TypeScript 7 late, so that it compiles what the epic changed; the exit demonstration last.
- **The exit demonstration**, with the owner: an autopilot run or a checkpoint that commits the derived part without a question and asks only about the focus and the `Next action:`; a second Claude Code session's warning read from the first as "another Product session, started at …"; `/binnacle:product` in Russian with no English term; `/binnacle:roadmap` on this repository proposing from the product inbox; and 0.4.0 installed from the registry into a clean container, with `binn daemon status` giving 0.4.0.
