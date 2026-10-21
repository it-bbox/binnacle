# New Project Bootstrap

_Русская версия: [01-new-project.ru.md](01-new-project.ru.md)._

## The short path

1. `git init` — create the repository.
2. `binn init` — one plan of everything it sets up, confirmed once.
3. `/binnacle:roadmap` — the vision and the epics.
4. `/binnacle:product` — the first Product session.

Then each epic goes `/grill-with-docs` → `/to-spec` → `/to-tickets`, and each ticket `/binnacle:task run <ticket>`, in a session of its own. In a harness other than Claude Code, each `/binnacle:<action>` is `binnacle-<action>`: see [Working from another harness](06-other-harnesses.md#binnacles-skills-in-another-harness).

## 1. Create the repository

Run `git init`. If the project will live on GitHub or GitLab, add the remote now: `binn init` reads the tracker from it. Without a remote, the tracker is local, and tickets are Markdown files under `docs/specs/`.

## 2. Set it up with `binn init`

Run `binn init` in the repository. It works everything out first, shows it as one plan and asks once: Enter or `y` writes it, anything else writes nothing (ADR-0034). It never overwrites a file, extends one only by the section the plan shows, and never commits. Review and commit what it wrote yourself.

Before the plan, it asks up to three questions:

- **The import window.** It shows how many Claude Code and Codex sessions it found in this repository, and the date of the oldest. Then it asks how much of that history the daemon imports: 90 days by default, another number of days, or `all`. `--window <days|all>` answers it unasked.
- **The documentation language.** It proposes the language the repository is documented in, `en` or `ru`: the root `README.md`'s, Russian when Cyrillic letters outnumber Latin ones outside code, or, with no README, your locale's (`LC_ALL`, then `LANG`). Enter takes the proposal. The answer is stated in the manifest as `knowledge.language`, and a manifest without it reads as English. `--language <en|ru>` answers it unasked.
- **Autostart.** Where it is available and not yet on, it asks whether the daemon starts at login. A yes makes `binn daemon autostart on` the plan's last item. `--autostart <yes|no>` answers it unasked.

For a new repository, the plan holds:

- `.binnacle/project.yaml`, the manifest: the tracker, the docs, the tools found or to install, the import window and the documentation language;
- `docs/specs/` for local tickets, and a `docs/roadmap.md` skeleton whose Next action is `/binnacle:roadmap`;
- the planning conventions under `docs/agents/`, and the *Agent skills* block in `AGENTS.md` that points to them;
- the `binnacle` MCP server in the project file of each harness it detects, such as `.mcp.json` for Claude Code;
- outside the repository: the `binnacle` plugin and Binnacle's skills, the workflow tools and their MCP servers, the OpenTelemetry export, the Obsidian vault, and the project's registration with a running daemon.

Each item in detail: [Existing project](02-existing-project-adopt.md#the-plan-item-by-item), *The plan, item by item*. After the plan, a GitHub or GitLab tracker is read once, and init says whether it was readable and, if not, how to give it a read-only token. The Summary then lists what was created, extended, run, failed or skipped.

### Workflow tools

The plan installs what is missing of the Standard setup, outside the repository. A tool already on `PATH` or listed by Claude Code, or declared `false` under `capabilities` in the manifest, is left alone. The skill sets go into the other harnesses through the `skills` CLI again on every run, so that a harness installed since gets them. No installer script is ever run: only package managers and the harnesses' own CLIs.

| Tool | How `binn init` installs it | Its MCP server |
| --- | --- | --- |
| Matt Pocock Skills | Claude Code's plugin CLI; the `skills` CLI for other harnesses | — |
| Ponytail | Claude Code's plugin CLI; the `skills` CLI for other harnesses | — |
| Serena | `uv tool install` | registered with each detected harness |
| Graphify | `uv tool install`, then the first graph is built | registered for this project only |
| Context7 | nothing to install | registered with each detected harness |
| ast-grep | npm | — |
| Obsidian | not installed: init sets the vault when Obsidian lists exactly one | — |

Without `uv`, init names the command that installs it, and leaves Serena and Graphify out. Without npm, it leaves out Context7 and ast-grep in the same way.

### From the chat

In Claude Code, `/binnacle:init [path]` does the same from the chat:

1. It runs `binn init --plan --json`. Where autostart is available and not yet on, it first asks whether the daemon starts at login, and passes your answer to init as `--autostart`. Unless the manifest already states one, it shows the documentation language init proposes and where the proposal comes from, asks you, and passes your answer as `--language`. Then it shows the whole plan, every item in full, with the session history and the import window. Name another window, a harness to keep out of Binnacle's skills, or the other autostart answer, to see the plan again with it.
2. Only your yes in the chat writes it, through `binn init --apply <id>`. If the plan changed since it was shown, that writes nothing (`init.plan_changed`), and the skill shows the new plan and asks again (ADR-0037).
3. It shows what init printed, the Summary included.

The skill needs no daemon and never commits. With the daemon stopped, registration is left out of the plan: `/binnacle:daemon start`, then `/binnacle:register`, adds it. A yes to autostart makes `binn daemon autostart on` the plan's last item; with a no, nothing is installed and the Summary names that command for later.

When init writes `.mcp.json`, open a new session in the repository and approve the project's `binnacle` server: Claude Code reads `.mcp.json` only when a session starts. The skill itself comes with the `binnacle` plugin, which the first `binn init` on a machine installs at user scope, so run that first one at a terminal.

## 3. From a vision to a roadmap

Run `/binnacle:roadmap`. It needs no daemon, but it needs the manifest and the roadmap `binn init` writes, and stops without them.

1. It reads `<knowledge.docs>/vision.md`. Without one, it asks what the project is, who it is for and what it leaves out, one question at a time, and writes the vision in your words on your yes.
2. It proposes the epics in dependency order, the foundation first, each with one line of scope. Change, drop, merge or add epics before you say yes.
3. On your yes, it writes the roadmap's rows, its `## Epics` section and a Next action that grills the first epic. It commits only those files, and never pushes.

It takes this new-project entry when the history holds no commit beyond those that added `binn init`'s files, and Git tracks no source code; `/binnacle:roadmap new` takes it anyway. Run again, it proposes additions and reorders among the epics not started, never changes a `done` epic, and never removes a row that links a spec.

## 4. The first Product session

Open a fresh chat and run `/binnacle:product`, then `/binnacle:daily`. The Next action the roadmap wrote grills the first epic.

## 5. Each epic, then each ticket

Each epic the roadmap lists follows the project-design flow, starting from the Next action:

1. `/grill-with-docs` — talk the epic through; it ends with the epic's brief.
2. `/to-spec` — write it up as a spec under `docs/specs/<slug>/`.
3. `/to-tickets` — slice the spec into tickets.

These three come from Matt Pocock Skills, and read the conventions `binn init` wrote, so no setup skill runs first. `binn init` never runs them itself. Each ticket is then worked in a session of its own, with `/binnacle:task run <ticket>`.
