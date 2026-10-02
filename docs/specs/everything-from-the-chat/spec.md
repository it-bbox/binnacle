# Spec: Everything from the chat

Status: READY
Triage: ready-for-agent

Epic 9 of v1, as defined in `docs/05-mvp-plan.md` phase 9, from the owner's baseline (`docs/baseline.md`, *MCP and skills*: "the owner should not keep going to a terminal from Claude or Codex") and ADR-0037. Exit criterion, restated while specifying: in a Claude Code chat, with the daemon stopped and no terminal opened, the owner sets up a new repository with `/binnacle:init` and one yes in the chat, starts the daemon, registers the project, checks its status and opens the dashboard; and after autopilot merges a change to the `binnacle` plugin's skills, the next session runs the changed skill without anyone running `pnpm install`. The phase was grilled on 2026-10-02 with epics 8 to 12; the owner confirmed this spec's test seams on 2026-10-02, recorded under *Further Notes*.

## Problem Statement

The baseline makes MCP plus skills the owner's main interface, yet everything that sets Binnacle up or keeps it running still needs a terminal. `binn init` asks for its confirmation at a terminal and writes nothing without one (ADR-0034), so it cannot be run from a chat at all. Starting and stopping the daemon, registering a project and opening the dashboard are `binn` commands with no skill. When the daemon is stopped, every Binnacle skill fails with `daemon.unreachable` and tells the human to go to a terminal and run `binn daemon start`. There is no `/status`, though the baseline lists it among the base workflows and the `project_status` tool already exists.

On this repository a second gap hides the work Binnacle does on itself. Claude Code loads the `binnacle` plugin from the copy that `binn init` installed through the npm package's marketplace (ADR-0027), and that copy shadows the skills-directory plugin at `.claude/skills/binnacle/` (ADR-0023). The copy is refreshed only when someone runs `pnpm install`, whose `prepare` script copies the skills into the package, and Claude Code then updates its own cached copy. A skill changed by a merged ticket therefore does not reach the owner: the next session runs the old one.

## Solution

**Every `binn` action the owner needs has a skill.** The `binnacle` plugin gains `/binnacle:init`, `/binnacle:daemon`, `/binnacle:register`, `/binnacle:dashboard` and `/binnacle:status`. The first four run `binn` through the harness's shell, as `/binnacle:audit` does, so they work with the daemon stopped. `/binnacle:status` reads the existing `project_status` tool and gives a concise status of the project and this session's checkout. Like every Binnacle skill, each one is started by a human only (`disable-model-invocation`).

**`binn init` is confirmed in the chat** (ADR-0037). `binn init --plan --json` works out the plan exactly as an interactive run does, writes nothing, asks nothing, and prints the plan with an identifier. `/binnacle:init` shows that plan in full in the chat and asks the human. On a yes in the chat, it runs `binn init --apply <id>`, which works the plan out again and writes it only if it is the same plan. A plan that changed since it was shown is refused, nothing is written, and the skill shows the new plan and asks again. A run without a terminal and without `--apply` still writes nothing. The history import window, the one question asked before the plan, becomes an option of both forms. The skill shows the history and the window the plan uses, and asks for another window only if the human wants one.

**The skills that need the daemon point to the chat.** Where `/binnacle:product`, `/binnacle:daily`, `/binnacle:task`, `/binnacle:checkpoint` and `/binnacle:autopilot` meet `daemon.unreachable` or `project.not_registered`, they name `/binnacle:daemon start` or `/binnacle:register` beside the `binn` command.

**Opening the dashboard keeps its token out of the chat.** `binn dashboard` opens the browser and prints the address without its token. `binn dashboard --print` still prints the address with the token, for a human at a terminal. A skill's shell output reaches the model's provider, and the token authorises the daemon's local API (ADR-0031).

**Autopilot refreshes the plugin it changes.** When a merge on this repository changes the `binnacle` plugin's skills, autopilot copies them into the CLI package and has Claude Code update its installed copy, in the same step where it regenerates a changed dashboard. It reports that a new session loads the changed skills. The development workflow names the same two steps for a merge done by hand.

## User Stories

### Setting up a repository from the chat

1. As the owner, I want to run `/binnacle:init` in a chat opened at a new repository, so that I can set it up without opening a terminal.
2. As the owner, I want `/binnacle:init` to show me init's whole plan in the chat before anything is written, so that I confirm exactly what I read, as I would at a terminal (ADR-0034).
3. As the owner, I want each write in the plan shown in full, a file or an addition to a file, a command to run, a setting outside the repository, so that the chat shows no less than the terminal does.
4. As the owner, I want what init only reports, such as a JSON entry it prints for me to add, a step it skips and why, or a prerequisite it cannot install, shown beside the plan, so that I see the whole picture before I answer.
5. As the owner, I want to answer yes in the chat and have exactly that plan written, so that one answer does what Enter does at a terminal.
6. As the owner, I want any answer other than a clear yes to write nothing, so that a vague reply never becomes a confirmation.
7. As the owner, I want a plan that changed between being shown and being confirmed to be refused, and the new plan shown to me, so that my yes never covers a write I did not see.
8. As the owner, I want to see each harness's session history in this repository and the import window the plan will use, so that I can choose the window before I confirm.
9. As the owner, I want to name another window, a number of days or all, and see the plan again with it, so that the window is still mine to choose.
10. As the owner, I want init's Summary after the writes, what was created, extended, run, failed or skipped, shown in the chat, so that I know what to review and commit.
11. As the owner, I want the tracker check that init runs after the writes shown in the chat, with its fix when the tracker cannot be read, so that I can set the token without guessing.
12. As the owner, I want `/binnacle:init` to tell me, when the daemon is not running, that registration was left out and that `/binnacle:daemon start` then `/binnacle:init` again adds it, so that I can finish setup from the chat.
13. As the owner, I want `/binnacle:init` to work on a path I pass, as `binn init [path]` does, so that I can set up a repository other than the session's.
14. As the owner, I want `/binnacle:init` never to commit, so that I review and commit init's writes myself, as at a terminal.
15. As an agent, I must not be able to start `/binnacle:init` on my own or answer its question for the human, so that only a human confirms a write into the repository (ADR-0037).
16. As a developer at a terminal, I want `binn init` to ask and to write exactly as it does today, so that the chat form changes nothing for me.
17. As a developer scripting Binnacle, I want `binn init` without a terminal and without `--apply` still to write nothing, so that the ADR-0034 invariant holds.
18. As a developer scripting Binnacle, I want `binn init --plan --json` to print the plan as JSON with an identifier and to write nothing and read no input, so that any client can show the plan and ask.
19. As a developer scripting Binnacle, I want `binn init --apply <id>` to fail with a clear code and write nothing when the plan's identifier differs, so that a stale confirmation can never write.

### Running the daemon from the chat

20. As the owner, I want `/binnacle:daemon start` to start the daemon and say where it listens, so that a skill that needs it works again without a terminal.
21. As the owner, I want `/binnacle:daemon start` on a running daemon to say it is already running, so that I can run it without checking first.
22. As the owner, I want `/binnacle:daemon stop` to stop the daemon, so that I can stop it from the chat too.
23. As the owner, I want `/binnacle:daemon status`, and `/binnacle:daemon` with no argument, to say whether a daemon is running and where, so that I can tell why a skill reports the daemon unreachable.
24. As the owner, I want a failure to start shown with `binn`'s message and the log tail it prints, so that I can see why the daemon did not start.
25. As the owner, I want the MCP tools to answer again after `/binnacle:daemon start` in the same session, without restarting the harness, so that starting the daemon from the chat is enough.

### Registering a project from the chat

26. As the owner, I want `/binnacle:register` to register the repository the session is in, so that Binnacle tracks it without a terminal.
27. As the owner, I want `/binnacle:register` in a linked worktree to register the main checkout, and say so, so that I never register a worktree by mistake.
28. As the owner, I want `/binnacle:register` with a path to register that repository, so that I can register another one.
29. As the owner, I want a registration that fails, such as a daemon that is not running or a missing manifest, shown with `binn`'s message and the skill that fixes it, so that I know what to run next.

### Opening the dashboard from the chat

30. As the owner, I want `/binnacle:dashboard` to open the dashboard in my browser, already authorised, so that I can look at it from the chat.
31. As the owner, I want the dashboard's token never to appear in the chat, so that it does not reach the model's provider or the session's transcript.
32. As the owner, I want `/binnacle:dashboard` with the daemon stopped to say so and name `/binnacle:daemon start`, so that I know how to get there.
33. As the owner, I want the dashboard's address, without the token, shown in the chat, so that I know where it is even when no browser opened.
34. As a developer at a terminal, I want `binn dashboard --print` still to print the address with its token, so that I can open it by hand or on another browser.

### Status from the chat

35. As the owner, I want `/binnacle:status` to show the project, its manifest's tracker, and this session's checkout with its branch, commit and dirty state, so that I can check where I am in one step.
36. As the owner, I want `/binnacle:status` to say when this session runs in a linked worktree rather than the registered checkout, so that I know what its Git facts describe.
37. As the owner, I want `/binnacle:status` to show the project's diagnostics, such as a remote that does not match the manifest, so that a wrong setup is visible.
38. As the owner, I want `/binnacle:status` with the daemon stopped or the project unregistered to say which, and name the skill that fixes it, so that it never just fails.
39. As the owner, I want `/binnacle:status` to stay short and leave the roadmap, the Tasks and usage to `/binnacle:product`, so that it answers one question quickly.

### The other skills point to the chat

40. As the owner, I want `/binnacle:product`, `/binnacle:daily`, `/binnacle:task`, `/binnacle:checkpoint` and `/binnacle:autopilot` to name `/binnacle:daemon start` when the daemon is unreachable, so that the fix is one skill away.
41. As the owner, I want them to name `/binnacle:register` when the project is not registered, so that I can register it from the chat.
42. As the owner, I want every new skill to stop at `command not found` and point to the README's setup section, as `/binnacle:audit` does, so that a missing `binn` is named and not misread.

### Changed skills reach the owner

43. As the owner, I want a skill changed by a ticket that autopilot merged to be the one my next session runs, so that the work merged is the work I use.
44. As the owner, I want autopilot to report that it refreshed the plugin, and that a new session loads it, so that I know when the change takes effect.
45. As the owner, I want autopilot to refresh the plugin only when a merge changed the plugin's skills on this repository, so that it runs nothing it does not need.
46. As the owner, I want a refresh that fails reported, with the commands that were run, while the run goes on, so that a failed refresh never stops an epic.
47. As the owner, I want autopilot to skip the refresh and say why when Claude Code lists no `binnacle` plugin installed from the package, so that it never installs one I did not ask for.
48. As the owner merging a branch by hand, I want the development workflow to name the same two steps, so that a changed skill reaches me without autopilot too.

### The documentation

49. As a reader of `docs/03-mcp-and-skills.md`, I want the new skills listed with what each runs, so that the interface is documented where the others are.
50. As a reader of the README, in English and in Russian, I want setup described from the chat as well as from a terminal, so that I can choose either.

## Implementation Decisions

- **The skills.** Five new skills in the `binnacle` plugin, each with `disable-model-invocation: true`, an `argument-hint`, and the `/binnacle:audit` skill's handling of a missing `binn` (exit 127: stop, point to the README's setup section) and of any other non-zero exit (stop, give the code and quote stderr):
  - `/binnacle:init [path]`: the plan, the question and the apply, below.
  - `/binnacle:daemon [start|stop|status]`: runs `binn daemon <action>`, `status` by default, and shows what it printed. One skill rather than three, because the three share their procedure.
  - `/binnacle:register [path]`: runs `binn project register` with the path, or else with the main checkout, the first path `git worktree list` prints, and says when that differs from the session's checkout.
  - `/binnacle:dashboard`: runs `binn dashboard` and shows the token-free address it prints.
  - `/binnacle:status`: calls the `binnacle` MCP server's `project_status` and presents the project, the manifest's tracker, the checkout (registered or a linked worktree), branch, commit, dirty state and diagnostics. On `daemon.unreachable` or `project.not_registered` it names `/binnacle:daemon start` or `/binnacle:register`. No new tool and no new daemon operation.
- **`binn init --plan --json [--window <days|all>] [path]`.** The same steps as an interactive run, in the same order, with the import window taken from `--window` or else the default, and no stdin read. It writes nothing and runs nothing: no apply, and no tracker check, which comes after the writes. It prints one JSON object: the repository `root`; the plan's `id`; `plan`, each item's `heading` and `body` in order; `notes`, what init said outside the plan, such as a JSON entry it printed, a skipped step with its reason, or a prerequisite with its install command; `history`, each harness's sessions in this repository; and `window`, the window the plan uses and whether the manifest already declares one. An empty plan has an `id` too.
- **`binn init --apply <id> [--window <days|all>] [path]`.** Works the plan out again with the same window. If its identifier is not `<id>`, it writes nothing and exits 3 with `init.plan_changed` on stderr. Otherwise it runs every item, as a confirmed interactive run does, then the tracker check, and prints the Summary. It needs no terminal: the confirmation is the human's yes in the chat (ADR-0037).
- **The plan's identifier** is a hash of the repository root and every item's heading and body, in order. It covers the window, which is part of the manifest's body when init creates the manifest. ADR-0026's run-time guards stay as they are: a file created since the plan was read is not overwritten, and a file that changed is not extended.
- **The interactive form is unchanged.** `binn init` with no new option asks the window question, shows the plan and asks once; without a terminal it writes nothing. `--window` is accepted there too and skips the window question. The plan text the terminal shows and the JSON's items come from the same items.
- **`/binnacle:init`'s procedure.** Run `binn init --plan --json`, with the path if one was passed. Show the root, the history and the window, every plan item in full, numbered, and the notes. If the plan is empty, say there is nothing to write and stop. Ask once whether to write this plan. Only a clear yes from the human in the chat confirms it. If the human names another window instead, run `--plan` again with it and show the new plan. On yes, run `binn init --apply <id>` with the same window and path. On `init.plan_changed`, show the new plan and ask again. Show the Summary and the tracker check as printed. When the notes say the daemon was not running, say that `/binnacle:daemon start` then `/binnacle:init` again adds the registration. The skill never answers its own question and never commits.
- **`binn dashboard`** opens the browser and prints the address without its `#token=…` fragment. When the browser cannot be opened, it says to run `binn dashboard --print` at a terminal. `--print` is unchanged. `docs/04-telemetry-dashboard.md` and the CLI help say so.
- **The daemon-dependent skills.** Their `daemon.unreachable` and `project.not_registered` lines name `/binnacle:daemon start` and `/binnacle:register` beside `binn daemon start` and `binn project register`. Nothing else in them changes.
- **Autopilot's refresh.** In step 7, only when this project is Binnacle itself and the merge changed `.claude/skills/binnacle/`, after any frozen install and before regenerating the dashboard, autopilot runs, in the main checkout:
  1. `pnpm --filter @binnacle/cli run prepare`, which copies the skills into the CLI package's plugin directory;
  2. only if `claude plugin list --json` lists `binnacle@binnacle`, `claude plugin marketplace update binnacle` then `claude plugin update binnacle@binnacle`.

  It reports under *Waiting for the owner* that the plugin was refreshed and that a new session loads it, or why it was skipped, or which command failed. A failure never stops the run.
- **The development workflow** (`docs/workflow/02-development-workflow.md`, *On this repository*) and the README's line about `pnpm install` name the same refresh for a branch merged by hand.
- **The plugin's description** in its manifest and in the marketplace listing names the new skills. `docs/03-mcp-and-skills.md` adds `/status`, `/init`, `/daemon`, `/register` and `/dashboard` to the logical actions, with their Claude Code names, and says that the four that run `binn` need no daemon.
- **No new ADR.** ADR-0037 records the chat confirmation and the non-interactive form. The token-free address follows from ADR-0031's token in the fragment. The refresh extends what ADR-0022's autopilot already does for the dashboard.

## Testing Decisions

- **Three seams, all existing** (the owner, 2026-10-02):
  1. **The `binn init` process**, as `apps/cli/test/init.test.ts` runs it: a temporary Git repository and home, fakes on PATH, stdout, stderr, exit codes and the files written.
  2. **The plugin's skill texts**, as `apps/cli/test/pack.test.ts` already checks autopilot's: the packed plugin carries every new skill, each with `disable-model-invocation: true`, and the texts hold the rules this spec fixes.
  3. **The `binn dashboard` process**, as `apps/cli/test/dashboard.test.ts` runs it against a daemon.
- **A good test checks what a person or an agent could see**: the JSON, the Summary, the files, the exit code, the printed address. Never a private function or the order of internal steps.
- **Init's plan**: `--plan --json` on a fixture repository lists the same items, in the same order, as the interactive plan on the same fixture, and writes nothing, runs no fake, and reads no stdin. Its notes carry a printed JSON entry and a skipped registration. `--window 7` puts `window_days: 7` in the proposed manifest's body, and changes the identifier.
- **Init's apply**: `--apply` with the identifier from `--plan` writes the plan with stdin not a terminal and prints the Summary. `--apply` after a file in the plan was created or changed exits 3 with `init.plan_changed` and writes nothing. `--apply` with a made-up identifier writes nothing. Plain `binn init` with stdin not a terminal still writes nothing, the ADR-0034 test kept as it is.
- **The skill texts**: `/binnacle:init` runs `--plan --json`, asks once, applies only after a yes from the human, with the identifier, and never commits. `/binnacle:dashboard` never prints the address with its token. Every daemon-dependent skill names `/binnacle:daemon start`. Autopilot's step 7 refreshes the plugin only when `.claude/skills/binnacle/` changed and Claude Code lists `binnacle@binnacle`.
- **The dashboard**: `binn dashboard` with a fake opener on PATH prints an address with no `#token=` and passes the opener the address with it. `--print` keeps its existing test.
- **No test runs a real `claude`, a real browser, or the network.** Every external command is a fake on PATH.
- **The exit demonstration**: in a Claude Code chat, with the daemon stopped and no terminal, the owner runs `/binnacle:init` on a fresh repository, confirms in the chat, runs `/binnacle:daemon start`, `/binnacle:register`, `/binnacle:status` and `/binnacle:dashboard`, and sees no token in the chat. Then an autopilot run merges a ticket that changes a skill, and the next session runs the changed skill.

## Out of Scope

- Skills for harnesses other than Claude Code. No skill format exists for them (`docs/03-mcp-and-skills.md`), and init already tells them to read the product skill's file.
- An MCP tool that runs `binn init`, starts the daemon or registers a project. The skills run `binn` in the harness's shell, because the daemon may be stopped.
- `binn project unregister` and `binn project list` from the chat. The owner did not ask for them.
- Starting the daemon at login, or as a system service.
- Refreshing the plugin in projects other than Binnacle. There it comes from the installed npm package, and updating `binn` updates it (ADR-0027).
- Changing what `binn init` proposes. Epic 8 decided the plan, and epic 10 adds telemetry export to it.
- Answering a ticket's questions from the chat. That is epic 11.

## Further Notes

- **Decision taken while specifying, by the owner on 2026-10-02**: tests at three existing seams, the `binn init` process, the plugin's skill texts and the `binn dashboard` process, with no end-to-end run of a skill by an agent.
- **Defaults taken from the docs and Ponytail, not asked**:
  - one `/binnacle:daemon` skill with an argument, rather than three;
  - `/binnacle:status` kept to `project_status`, as phase 9 says, rather than a second snapshot;
  - the window as an option, rather than a second round trip between the skill and `binn`;
  - the plan's identifier as a hash of what is shown, so that no state is kept between the two calls;
  - the token-free address, because a skill's shell output is sent to the model's provider;
  - the refresh limited to this repository and to a `binnacle@binnacle` that is already installed;
  - registration of the main checkout from a linked worktree, as every other Binnacle step uses the registered checkout.
- **Found while specifying**: on the owner's machine `claude plugin list --json` reports the skills-directory plugin `binnacle@skills-dir` as not loaded, because the installed `binnacle@binnacle` takes the name. ADR-0023's "an edited `SKILL.md` takes effect at once" therefore no longer holds on this repository once `binn init` has installed the plugin. This spec does not change ADR-0023. The refresh is what makes changed skills reach the owner.
- Vocabulary for `CONTEXT.md`, once the code uses it: **the chat confirmation** (ADR-0037).
