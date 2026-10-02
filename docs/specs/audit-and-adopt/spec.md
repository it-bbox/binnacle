# Spec: Audit and adopt

Status: READY
Triage: ready-for-agent

Epic 7 of v1, as defined in `docs/05-mvp-plan.md` phase 6. Exit criterion, restated while specifying: a human can run one read-only command on a repository, with or without Binnacle in it, and get a list of findings that say what is in place, what is missing and what Binnacle cannot tell, each with a recommendation and none with a fix applied. `docs/00-scope.md` asks that a project be auditable and adoptable without destructive migration. The decisions below were made in the grilling of 2026-10-02 and are recorded in `brief.md`.

## Problem Statement

A developer who wants to bring a repository into the way of working Binnacle supports has no way to see how far it already is. Does it have a tracker Binnacle can read? Docs, ADRs and a context file? The Matt Pocock layout? A `.scratch` directory that Git does not ignore, or that holds the only copy of something durable? Agent instructions, and are two of them really one set? Serena, Graphify and Context7 where an agent can reach them? Tests and CI? Session artifacts Binnacle could read? Today the answer is to open the repository and look, or to run `binn init`, which writes.

Separately, the owner's first real use of `binn init` in another project, on 2026-09-27, found that moving a Product session to another harness is not discoverable, that init asks one question per write, and that an Enter with no answer means no.

## Solution

A new CLI command, `binn audit [path]`. It reads the repository at `path`, the current directory by default, and prints a list of findings. It needs no registration, no daemon and no `.binnacle/project.yaml`, because adopting comes before `binn init`. It never writes (ADR-0020), never makes a network call and never runs a process other than Git.

Each finding has a check code, the area of phase 6 it belongs to, a status — `ok`, `gap` or `unknown` — the reason, and, for a `gap` or an `unknown`, a recommendation. There is no overall score. A check that cannot be answered from files is `unknown`, never guessed. The default output is text for a human, and `--json` gives the same findings for an agent or a script. The exit code is 0 even when there are gaps, because they are recommendations and not errors; it is non-zero only when the audit could not run, for example an unreadable path or a path that is not a Git repository.

The audit and `binn init` are independent and point at each other. The audit recommends `binn init` for what Binnacle files are missing; `binn init`'s Summary suggests `binn audit`. The audit writes nothing and `binn init` stays the only writer (ADR-0026, ADR-0034).

Three tickets from the owner's feedback sit beside the audit in this epic:

- `binn init` shows one plan of every write and asks once. Enter accepts the plan when stdin is a terminal; with no terminal nothing is written (ADR-0034).
- A README section, mirrored in `README.ru.md`, on working from another harness, and `binn init`'s Summary printing the exact next step for a harness other than Claude Code.
- The audit itself.

## User Stories

### Running it

1. As a developer, I want to run `binn audit` in a repository and read a list of findings, so that I see how far it is from the way Binnacle works before I change anything.
2. As a developer, I want to pass a path to `binn audit`, so that I can audit a repository I am not standing in.
3. As a developer, I want the audit to work on a repository that Binnacle has never seen, so that I can run it before `binn init`.
4. As a developer, I want the audit to work without the daemon running, so that adopting does not depend on Binnacle being installed as a service.
5. As a developer, I want the audit to use no network, so that it is quick, deterministic and costs me no API quota.
6. As a developer, I want the audit to write nothing into the repository or anywhere else, so that I can run it on a repository I do not own.
7. As a developer, I want the audit to run no process other than Git, so that it is safe on a repository I have not read.
8. As a developer, I want a path that is unreadable, missing or not a Git repository to be an error with a reason and a non-zero exit code, so that a script can tell that the audit did not run.
9. As a developer, I want gaps to leave the exit code at 0, so that the audit is advice and never a gate on my pipeline.

### Reading the report

10. As a developer, I want each finding to carry a check code, so that I can refer to it, filter it and find it in the docs.
11. As a developer, I want each finding to name its area of phase 6, so that the report groups into Git and tracker, docs, layout, `.scratch`, capabilities, instructions, structure and telemetry readiness.
12. As a developer, I want each finding's status to be `ok`, `gap` or `unknown`, so that what is missing and what could not be told are different things.
13. As a developer, I want every `gap` and `unknown` to come with a recommendation, so that I know the next step.
14. As a developer, I want a recommendation to be advice I carry out myself and never a command the audit runs, so that migration stays under my control.
15. As a developer, I want no overall score, so that I am not given a number that hides which gaps matter to me.
16. As a developer, I want a check the audit cannot answer from files to say `unknown` and why, so that I am not told something Binnacle guessed.
17. As a developer, I want `--json` to give the same findings as the text, so that an agent or a script reads them without parsing prose.
18. As a developer, I want the findings in a stable order, so that two runs on the same tree can be compared.

### Git and tracker

19. As a developer, I want the audit to say whether the path is a Git repository and on what branch, so that I know what it looked at.
20. As a developer, I want the audit to name the remote's tracker provider from its URL, GitHub, GitLab or none, so that I know which tracker Binnacle would read.
21. As a developer, I want the audit to say whether a tracker token is present in the environment or in `~/.binnacle/credentials.json`, without showing its value, so that I know whether Binnacle could read a remote tracker.
22. As a developer, I want whether a token works to be `unknown`, so that the audit never claims what only the network could confirm.
23. As a developer, I want a repository with no remote to be told that local tickets under `docs/specs/` are a tracker Binnacle reads, so that it is not read as an error.

### Docs, ADRs, context and the Matt Pocock layout

24. As a developer, I want the audit to say whether the repository has a `CONTEXT.md`, an ADR directory and `docs/`, so that I know where its durable knowledge lives.
25. As a developer, I want the audit to say whether the Matt Pocock layout is in place: `docs/agents/issue-tracker.md`, `triage-labels.md` and `domain.md`, `docs/specs/<slug>/`, so that I know whether `/grill-with-docs`, `/to-spec` and `/to-tickets` have what they read.
26. As a developer, I want a missing ticket-header convention in `docs/agents/issue-tracker.md` to be a gap that names `binn init`, so that I know init offers to add it (ADR-0024).
27. As a developer, I want an existing but partial layout reported as such, with the missing parts named, so that I am not told to start over.

### `.scratch`

28. As a developer, I want the audit to say whether `.scratch` exists and whether Git ignores it, so that I know whether it can be committed by mistake.
29. As a developer, I want a `.scratch` that is not ignored to be a gap, so that the risk named in phase 6 is reported.
30. As a developer, I want a `.scratch` that holds the only copy of something durable, a spec or a ticket not tracked anywhere else, to be a gap, so that I move it into Git before a worktree removal loses it (ADR-0005, ADR-0017).
31. As a developer, I want a repository with no `.scratch` to get nothing but an `ok`, so that the check does not invent work.

### Serena, Graphify and Context7

32. As a developer, I want the audit to say whether Serena, Graphify and Context7 look configured, from configuration files only, so that I know what an agent in this repository can reach.
33. As a developer, I want a tool the audit finds no configuration for to be `unknown` and not `gap`, so that a tool configured in my user settings is not called missing.
34. As a developer, I want the audit to name the files it looked in, so that I can see why it found nothing.
35. As a developer, I want the audit to read `.binnacle/project.yaml`'s `capabilities` where it exists and treat them as the repository's own declaration, so that a declared capability is `ok` and not re-derived.

### Agent instructions

36. As a developer, I want `AGENTS.md` and `CLAUDE.md` read as one set when one imports the other, so that a `CLAUDE.md` holding `@AGENTS.md` is not reported as two files that may disagree (`instructionSets`).
37. As a developer, I want a repository with two instruction files that do not import each other to get a recommendation to decide which one is canonical, so that an agent does not read two truths.
38. As a developer, I want a repository with no agent instructions to be told so, so that I know a first agent starts without them.

### Tests, CI and structure

39. As a developer, I want the audit to say whether the repository has a test setup and a CI configuration, from files that are there, so that I know whether a Task can be checked.
40. As a developer, I want the audit to say what shape the project has, a workspace of packages or a single package, so that I know what Binnacle would register.
41. As a developer, I want a check that only files can answer to be answered by files and never by running the tests, so that the audit stays read-only and quick.

### Telemetry readiness

42. As a developer, I want the audit to say whether the session artifacts Binnacle reads, Claude Code's and Codex's, exist on this machine for this repository, so that I know whether usage could be attributed.
43. As a developer, I want the audit to count sessions without reading their content, so that it keeps to the metadata-only privacy rule.
44. As a developer, I want a machine with no artifacts to get an `unknown` or an `ok` that says no work has been recorded yet, never a `gap`, so that a new project is not told it is behind.

### Pointing at `binn init`

45. As a developer, I want the audit to recommend `binn init` for each Binnacle file that is missing, so that I know what init would offer.
46. As a developer, I want `binn init`'s Summary to suggest `binn audit`, so that the two commands lead to each other.
47. As a maintainer, I want the audit and `binn init` to read the same things the same way where they overlap, such as the instruction sets, the tracker provider and the Matt Pocock layout, so that they never disagree about a repository.

### `binn init` asks once

48. As a developer, I want `binn init` to work out every write first and show them as one plan, so that I read all of it before anything is written.
49. As a developer, I want one question for the whole plan, so that I am not asked eight times.
50. As a developer, I want Enter to accept the plan when stdin is a terminal, so that the common answer needs no typing.
51. As a developer, I want `n` to decline the plan and leave nothing written, so that I can look first.
52. As a developer, I want `binn init` run without a terminal to write nothing, so that a script or a pipe never changes a repository (ADR-0034).
53. As a developer, I want the one question that is not about a write, the history import window, asked before the plan, and the tracker proposed from the remote and shown in the plan rather than asked, so that the plan reflects my answers without one more question (the owner, 2026-10-02).
54. As a developer, I want init to still never overwrite a file, never commit and extend a file only by a section I have seen, so that ADR-0026's guarantees hold.

### Working from another harness

55. As a developer, I want a README section on working from another harness, so that I can move a Product session to Codex or opencode alone.
56. As a developer, I want that section to say that Codex reads a project's `.codex/config.toml` only in a trusted project, so that I know why a registration is not seen.
57. As a developer, I want it to say that the Codex desktop app ships its CLI outside `PATH`, so that I know where to point it.
58. As a developer, I want it to say that GLM is a model reached through a harness such as Claude Code or opencode, so that I do not look for a GLM adapter.
59. As a developer, I want `binn init`'s Summary to print the exact next step for a harness other than Claude Code, including the prompt that makes an agent read the Binnacle skill and follow it, so that I am not left to work it out.
60. As a Russian-speaking developer, I want `README.ru.md` to carry the same section, so that the two READMEs stay one (`AGENTS.md`).
61. As a developer, I want to run the audit from the chat with `/binnacle:audit` and read its findings there, so that I do not switch to a terminal (the owner, 2026-10-02).

## Implementation Decisions

- **A new CLI command `binn audit [path]`**, with `--json`. It is a CLI command of its own, not part of `binn init`. It does not go through the daemon, so there is no new daemon operation and no new MCP tool. MCP and the dashboard do not show the audit in this epic. A skill, `/binnacle:audit`, runs the command and presents its findings in the chat, because the owner wants everything done from the chat (2026-10-02, ticket 09).
- **Findings are a list of plain records**: a check code, an area, a status of `ok`, `gap` or `unknown`, a reason and a recommendation. The text output and `--json` are two renderings of the same list. There is no overall score and no weighting between findings.
- **The areas are those of phase 6**: Git and tracker; docs, ADRs and context; the Matt Pocock layout; `.scratch`; Serena, Graphify and Context7; agent instructions; tests, CI and structure; telemetry readiness.
- **The audit reads files and Git, and nothing else.** It runs no process but Git, makes no network call and writes nothing. A check that files cannot answer is `unknown`.
- **`gap` and `unknown` are never mixed.** `gap` means a file or setting the audit looked for and found absent or wrong. `unknown` means the answer is not in the files: a token that might work, a tool configured in user settings, a machine with no session artifacts.
- **Capabilities are read from configuration files only.** The audit looks in the repository's own files, `.binnacle/project.yaml`, `.mcp.json`, `.codex/config.toml`, `.serena/` and the like, and in the user-scope files only where the harness defines one. It names the files it looked in.
- **The tracker is read locally**: the remote's URL for the provider, and the presence of a token in the environment or in the credentials file, never its value and never whether it works.
- **The exit code is 0 unless the audit could not run.** Gaps are recommendations (`docs/05-mvp-plan.md`: "migration recommendations, not automatic fixes").
- **Shared reading with `binn init`**: the agent instruction sets, the tracker provider from the remote and the detection of the Matt Pocock layout are read by one piece of code that both commands use. The instruction sets already are (`instructionSets` in the core package, written for this purpose). Where init has the detection inside it, it moves to where the audit can reach it; nothing is duplicated.
- **`binn init` is restructured, not extended**: its steps first work out what they would write, then the plan is shown whole and asked once, then written (ADR-0034). The questions that are not about a write are asked before the plan. With stdin not a terminal, the plan is shown and nothing is written. This replaces the per-write prompts and their default of no. ADR-0026's other terms stand.
- **`binn init`'s Summary** gains two lines: `binn audit` as a next step, and, for a harness it detected other than Claude Code, the exact next step for it, including the prompt that makes an agent read the Binnacle skill and follow it. No skill format for another harness is added.
- **The README and `README.ru.md`** gain a section on working from another harness, written in the same change. It covers a trusted project for Codex's `.codex/config.toml`, the Codex desktop CLI outside `PATH`, and GLM as a model reached through a harness.
- **No new dependency, no new package.** The audit is TypeScript on the Node standard library, in the CLI app and the core package that already exist (`AGENTS.md`, mandatory principle 9).
- **Documentation is updated with the code**: `docs/03-mcp-and-skills.md` and `docs/operations/05-installation-checklist.md` where they describe init's prompts, and the roadmap.

## Testing Decisions

- **One seam: the `binn` process.** Tests run `binn audit` and `binn init` as a process on temporary Git repositories and check what comes out: stdout, the exit code and the files on disk. A good test checks what a person running the command could see, never the audit's internals.
- **Fixture repositories for the audit**: a bare repository with one commit; a partly adopted one, with a context file and an ADR directory but no ticket-header convention; one with a `.scratch` that Git does not ignore, and one with a `.scratch` that holds the only copy of a spec; one with a `CLAUDE.md` that imports `AGENTS.md`, and one with two instruction files that do not import each other; one with a configuration file for a tool and one without any.
- **`--json` is the contract of the findings.** The tests read the JSON for the check code, the status and the area, and the text output only for what a human needs to see: that it names each finding and its recommendation.
- **The audit writes nothing**: a test lists the files of a fixture before and after, with the daemon's home and `~` pointed at an empty directory, and expects no difference. A second test runs the audit with the network unreachable and expects the same output.
- **The audit needs no daemon, no registration and no `.binnacle/project.yaml`**: a test runs it on a bare fixture with the daemon not started.
- **The exit code**: 0 on a repository with gaps; non-zero on a missing path and on a directory that is not a Git repository.
- **A tracker token is never printed**: a test sets a token in the environment and checks that the value appears in neither output.
- **`binn init` asks once**: tests run init with a pseudo-terminal or a stand-in for one, accepting the plan with Enter and declining it with `n`, and check that exactly the planned files are written or none; and with stdin not a terminal, that nothing is written. The existing init tests are updated to the new prompts rather than kept beside them.
- **The README section** is checked in review, not by a test. A test that README and `README.ru.md` change together would be a test of prose.
- **Prior art**: `apps/cli/test/init.test.ts`, which spawns the CLI on temporary Git repositories, strips `GIT_*` and tracker tokens from the environment, and checks the files written.
- **The exit demonstration**: the owner runs `binn audit` on this repository, expecting a clean report, and on a repository of their own, expecting recommendations they agree with. A large third-party repository stays post-v1 (`docs/00-scope.md`).

## Out of Scope

- Applying any recommendation. The audit never fixes, and `binn init` is the only writer.
- An audit through MCP or in the dashboard.
- Network checks: whether a tracker token works, whether a remote tracker is reachable.
- Running tests, CI or any tool to see whether they pass or are installed.
- An overall score or a ranking of findings.
- Reading the content of sessions, tickets or ADRs beyond what a check needs.
- A skill format for harnesses other than Claude Code, and any new harness adapter (Later list).
- Running the audit on a large third-party repository, which is post-v1.
- The question of how much memory `binn init` used in the owner's IDE. It was not reproduced (ticket 01).

## Further Notes

- Ticket 01 of this epic, `binn init` finishing and saying what it waits on, is done and needed no spec.
- ADR-0034 records why init now asks once and what Enter means. ADR-0026 is superseded in part.
- Vocabulary: **audit** and **finding** are new terms for `CONTEXT.md`; `to-tickets` or the first implementation ticket adds them once the words have been used in code.
