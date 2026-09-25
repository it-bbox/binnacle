# Spec: Tracker and Matt Pocock Integration

Status: READY
Triage: ready-for-agent

Epic 3 of v1, as defined in `docs/05-mvp-plan.md` phase 3. Exit criterion: a remote issue task can be represented as a Binnacle Task and a compact task brief.

## Problem Statement

Binnacle works on exactly one kind of project today: one that keeps its tickets as Markdown files in Git, like this repository. A project whose tickets are GitHub or GitLab issues gets a Product Snapshot with no Tasks, no roadmap and one attention item saying the tracker cannot be read. That is most projects, and `docs/workflow/04-git-tracker-worktrees.md` recommends exactly that setup for any serious remote project.

Even on this repository, a session that starts one ticket has to find the file itself, read it whole with its comments, look up each dependency's state by opening more files, and invent the branch name. The snapshot names a ticket's path and stops there. There is no task brief, no `task_get` and no `/binnacle:task`.

And adopting Binnacle in another project is manual work nobody has written down end to end: hand-writing `.binnacle/project.yaml`, registering the project, writing each harness's MCP configuration, copying the `binnacle` plugin's skills from this repository, and teaching `/to-tickets` the ticket header so that the tickets it writes can be read at all. Each step is a chance to get it slightly wrong, and every copied skill goes stale.

## Solution

**Remote trackers.** A project declares `tracker.provider: github` or `gitlab`, with its repository and optionally its host, in the manifest. Binnacle then reads that repository's issues on every call, read-only, with a read-only token from the environment or `~/.binnacle/credentials.json`, or anonymously when there is none and the project is public. Each issue is a Task: `#42`, its title, and the state, dependencies and spec from the **ticket header** at the top of its body (ADR-0024). Closing an issue outranks its `Status:` line, and a disagreement between the two is an attention item. The snapshot, the daily delta and the checkpoint work on a remote tracker as they do on the local one, and the roadmap is read from `docs/roadmap.md` on every tracker (ADR-0025).

**The task brief.** `task_get` over MCP, and `/binnacle:task <id>` in Claude Code, return what a session needs to start one Task and nothing more: its fields, its dependencies with their titles and states, its spec's path, the ticket body without comments, and the branch name that maps to the Task. It works on every tracker.

**`binn init`.** A human runs `binn init` in a repository. It detects what is there — the Git remote, the knowledge layout, the harnesses installed on the machine, the Matt Pocock layout, the agent instruction files — and proposes, one at a time, a manifest, the project's registration, an MCP registration per detected harness, the `binnacle` plugin from the installed package (ADR-0027), and the ticket-header section for `docs/agents/issue-tracker.md`. It shows each file or addition and writes it only after the human confirms. It never overwrites a file and never commits (ADR-0026). It ends with a list of what it wrote, for the human to review and commit.

Binnacle remains optional and read-only everywhere else: the daemon and the MCP server write nothing into a repository and nothing into a tracker.

## User Stories

### Remote trackers

1. As a developer whose tickets are GitHub issues, I want Binnacle to read them as Tasks, so that the Product Snapshot shows my real work instead of an unavailable tracker.
2. As a developer whose tickets are GitLab issues, I want the same, so that the choice of forge does not decide whether Binnacle is useful.
3. As a developer, I want to declare the tracker's repository and host in the manifest, so that Binnacle reads the tracker I chose rather than one it guessed from a remote.
4. As a developer on GitHub Enterprise or a self-hosted GitLab, I want to declare my own host, so that a neutral hostname is not mistaken for a mismatch.
5. As a developer, I want a remote Task to be identified by its issue number, `#42`, so that I refer to it the way the tracker does.
6. As a developer, I want a remote Task's state, dependencies and spec read from the same ticket header a local ticket uses, so that one convention serves every tracker.
7. As a developer, I want a closed issue to be `DONE` whatever its body says, so that closing an issue is enough to finish it.
8. As a developer on GitHub, I want an issue closed as not planned to be `CANCELLED`, so that abandoned work is not counted as done.
9. As a developer, I want an issue closed with a `Status:` of `CANCELLED` and no close reason from the tracker to stay `CANCELLED`, so that GitLab, which has no close reasons, can express abandoned work.
10. As a developer, I want an open issue whose body says `DONE`, or a closed one whose body says `ACTIVE`, reported as `tracker.state_mismatch`, so that both "forgot to close" and "forgot to update the line" are caught.
11. As a developer, I want an open issue with no `Status:` line to have a `null` state and a diagnostic, so that an issue filed by hand is visible and never given a guessed state.
12. As a developer, I want `Blocked by:` on an issue to list issue numbers, with or without `#`, so that dependencies read naturally in the tracker's own UI.
13. As a developer, I want a dependency on an issue that does not exist reported as dangling, as on the local tracker, so that a typo does not block work forever.
14. As a developer, I want a dependency on an issue closed as done to count as met, and one closed as cancelled to stay unmet, so that finishing a ticket unblocks the next one without editing anything else, while abandoned work never silently unblocks what depended on it.
15. As a developer, I want pull requests left out of the Tasks, so that GitHub's habit of listing them among issues does not pollute the snapshot.
16. As a developer, I want a remote Task's triage role taken from its labels, so that the triage axis stays separate from the state axis (ADR-0017).
17. As a developer, I want each remote Task to carry its issue's URL as its ticket, so that I can open it in one click.
18. As a developer, I want the tracker read on every call, so that an issue I just edited or closed is reflected in the next answer.
19. As a developer, I want every page of issues read, so that a large tracker is never silently cut short.
20. As a developer, I want the roadmap read from `docs/roadmap.md` whatever my tracker is, so that the snapshot's position works the same on GitHub, GitLab and Markdown (ADR-0025).
21. As a developer on a remote tracker, I want the roadmap's consistency checks to link an epic to its issues through their `Spec:` line, so that "epic done but a ticket still open" is caught there too.
22. As a Product Steward on a remote tracker, I want `/binnacle:daily` to show Task transitions since the previous daily, so that I see what closed, started or got blocked.
23. As a Product Steward on a remote tracker, I want new issues since the previous daily listed, so that new work is visible the day it is filed.
24. As a Product Steward on a remote tracker, I want the daily to say plainly when transitions cannot be computed — on the first daily, after a fallback, or with an explicit `since` — so that "no transitions" is never mistaken for "nothing happened".
25. As a Product Steward, I want the checkpoint's delta to show remote transitions since the last checkpoint the same way, so that promotion starts from facts.
26. As a Product Steward, I want the snapshot, the daily and the checkpoint to keep answering when the tracker is unreachable, with the Task sections unavailable and the reason stated, so that a network problem does not blind me to Git and the roadmap.
27. As a developer, I want a Git remote that does not match the declared host and repository reported as `tracker.remote_mismatch`, so that a manifest copied from another project is noticed.

### Credentials

28. As a developer, I want Binnacle to use a read-only token, so that a leaked token cannot change my repository (ADR-0013).
29. As a developer, I want to give the token through an environment variable per provider, so that I can set it the way I set any other secret.
30. As a developer, I want to keep tokens in `~/.binnacle/credentials.json`, one per host, so that I can work with more than one forge.
31. As a developer, I want Binnacle to refuse a credentials file readable by other users, so that a careless permission does not expose my tokens.
32. As a developer with a public repository, I want Binnacle to read it without a token, so that trying Binnacle costs nothing.
33. As a developer, I want a missing, rejected or insufficient token reported with a code that says which, so that I know whether to create one, fix one or widen its read scope.
34. As a developer, I want no token imported from `gh` or `glab`, so that a token that can write never reaches Binnacle.
35. As a developer, I want a token never to appear in any response, diagnostic, event or log, so that it does not end up in an agent transcript.

### Task brief

36. As an implementation session, I want `task_get` with a Task id to return a compact brief, so that I start a ticket without reading the whole tracker.
37. As an implementation session, I want the brief to carry the Task's identity, title, state, triage role and ticket path or URL, so that I know exactly what I am working on.
38. As an implementation session, I want each dependency listed with its title, state and whether it is met, so that I know without opening another ticket whether I can start.
39. As an implementation session, I want the spec's path in the brief, so that I read the spec only when I need it.
40. As an implementation session, I want the ticket body without its comments, so that the brief stays compact and the history is read only when needed.
41. As an implementation session, I want a very long ticket body cut at a fixed limit with a truncation marker, so that one oversized issue cannot blow up my context, and I know when I have not seen all of it.
42. As an implementation session, I want the branch name that maps to the Task, so that the work can later be attributed to it (ADR-0018).
43. As an implementation session in a linked worktree, I want the brief read from my own checkout on the local tracker, so that a ticket edited on my branch is what I see.
44. As an implementation session, I want an unknown id answered with a stable error code, so that I can tell a typo from a broken tracker.
45. As a developer in Claude Code, I want `/binnacle:task <id>`, so that starting a ticket is one command.
46. As a developer, I want `/binnacle:task` to present the brief and change nothing, so that starting to read a ticket never starts work by itself.
47. As a maintainer, I want `task_get` to map one-to-one onto a daemon operation `task.get`, as every other tool does, so that there is no second implementation.

### `binn init`

48. As a developer adopting Binnacle, I want one command that sets up a repository, so that adoption is not a page of manual steps.
49. As a developer, I want `binn init` to show each file, or each addition to a file, before writing it, so that nothing lands in my repository unseen (ADR-0026).
50. As a developer, I want to decline any single step and keep the rest, so that I adopt Binnacle as far as I choose.
51. As a developer, I want `binn init` never to overwrite a file, so that running it on a configured repository cannot destroy anything.
52. As a developer, I want `binn init` never to commit, so that I review and commit what it wrote like any other change.
53. As a developer, I want `binn init` to end with the list of files it created or extended, so that I know exactly what to review.
54. As a developer, I want a manifest proposed from what is actually there — the Git remote, `CONTEXT.md`, `docs/`, the ADR and specs directories — so that I do not write it from a template by hand.
55. As a developer with a GitHub or GitLab remote, I want the manifest to propose that tracker with the remote's repository and host, so that the common case needs no editing.
56. As a developer without a remote tracker, I want the manifest to propose the local Markdown tracker, so that Binnacle is useful offline from the first day.
57. As a developer, I want the proposed manifest to leave out anything that is not there, so that it declares no path that does not exist.
58. As a developer with an existing manifest, I want `binn init` to validate it and leave it alone, so that my choices stand.
59. As a developer, I want `binn init` to register the project with the running daemon after confirmation, so that the project is tracked without a second command.
60. As a developer whose daemon is not running, I want `binn init` to finish everything else and print the commands that start the daemon and register the project, so that a stopped daemon does not stop adoption.
61. As a developer, I want `binn init` to detect which harnesses are installed on the machine, so that I am offered only registrations I can use.
62. As a developer using Claude Code, Codex, opencode or VS Code, I want the MCP registration proposed in that harness's own project-scoped configuration, so that everyone who clones the repository gets it.
63. As a developer whose harness configuration file already exists, I want the Binnacle entry appended when the format allows a pure append, and printed for me to add otherwise, so that nothing else in the file is touched.
64. As a developer whose harness configuration already registers `binnacle`, I want that step skipped and reported, so that running `binn init` twice is harmless.
65. As a developer using a harness Binnacle has no template for, I want a generic stdio snippet printed, so that any harness that speaks MCP can be connected (ADR-0014).
66. As a developer using Claude Code, I want the `binnacle` plugin installed from the Binnacle package I have installed, after confirmation, so that the skills always match the tools they call (ADR-0027).
67. As a developer, I want the plugin installed through Claude Code's own CLI and never by editing its settings files, so that Claude Code stays the owner of its configuration.
68. As a developer who already has the plugin, I want that step skipped and reported, so that nothing is installed twice.
69. As a developer using Matt Pocock's skills, I want `binn init` to detect their layout, so that it knows whether `/to-tickets` has a convention file to learn from.
70. As a developer whose `docs/agents/issue-tracker.md` lacks the ticket-header convention, I want it offered as an appended section, so that `/to-tickets` writes tickets Binnacle can read (ADR-0024).
71. As a developer whose convention file already has that section, I want the step skipped, so that it is never appended twice.
72. As a developer without the Matt Pocock layout, I want to be told how to set it up, and nothing run on my behalf, so that the interactive setup stays mine to start.
73. As a developer, I want my agent instruction files reported as one set when one imports the other, so that a `CLAUDE.md` importing `AGENTS.md` is not presented as two sets of rules.
74. As a developer on a remote tracker, I want `binn init` to check that the tracker can be read and explain how to create a read-only token when it cannot, so that the first snapshot is not the first time I find out.
75. As a developer, I want `binn init` to ask for confirmation before any write outside the repository too — the registry, the plugin — so that my user-level configuration is not changed unseen.
76. As a developer, I want `binn init` to treat the end of its input as "no", so that running it without a terminal writes nothing.

### Standing guarantees

77. As a developer, I want no daemon operation and no MCP tool ever to write into my repository, and a test that says so, so that `binn init` stays the only path that does (ADR-0026).
78. As a developer, I want Binnacle never to write to my tracker, so that it cannot change anything my team sees there (ADR-0013).
79. As a developer, I want the only network traffic Binnacle makes to be read requests to the tracker host my manifest declares, so that I know exactly what leaves my machine.
80. As a maintainer, I want one ticket-header parser for every tracker, so that the local and remote readings cannot drift apart.
81. As a maintainer, I want the GitHub and GitLab adapters to implement the Task-reading contract from epic 2, so that the snapshot, the daily and the brief are written once.
82. As a maintainer, I want the adapters tested against real GitHub and GitLab projects by a separate live suite, so that "works with GitHub" means it worked with GitHub.
83. As a maintainer, I want `pnpm test` to stay offline, so that the ordinary suite runs anywhere and needs no token.
84. As a maintainer, I want the packed CLI to contain the plugin and its marketplace manifest, so that ADR-0027's promise is checked rather than assumed.
85. As a maintainer, I want the exit criterion demonstrated in a real session against a real remote issue, so that "works" means it worked.

## Implementation Decisions

### Workspace

- The ticket-header parser moves into `packages/core` as a pure function over text, and both the local and the remote adapters call it. The header block is the first run of non-blank lines at the top of the text, after one leading heading if the text starts with one — which covers a Markdown ticket and an issue body with the same rule.
- The GitHub and GitLab adapters live in `packages/adapters`, next to the Git adapter and the local tracker. They use the platform `fetch` and no client library. Each is one function from a declared repository, host and optional token to a `TaskReading`.
- The daemon gains `task.get`. `packages/mcp` gains `task_get`, mapped to it one-to-one.
- `apps/cli` gains `binn init`. It is the only code in Binnacle that writes into a project's repository.
- The `binnacle` plugin gains a `task` skill.
- The CLI package gains the plugin and a marketplace manifest in its packed contents. How the plugin directory gets there from its source at `.claude/skills/binnacle/` (ADR-0027) is the implementing ticket's choice; the packed result is what is tested.

### Manifest

- `tracker` gains two fields: `repository` — `owner/name` on GitHub, the full project path on GitLab — and `host`.
- As with every manifest field, an unwritten `host` comes back `null`; the default, `github.com` or `gitlab.com`, is applied at the point of use.
- `host` is a hostname, or a base URL with a scheme, which is then used as the API root as given. A hostname maps to the provider's API: `github.com` to `https://api.github.com`, any other GitHub host to `https://<host>/api/v3`, a GitLab host to `https://<host>/api/v4`. The base-URL form is what lets offline tests point a manifest at a loopback server.
- A remote provider with no `repository` gives `tracker.unavailable`, naming the missing field. The repository is never inferred from a Git remote at read time; `binn init` proposes it once, and the human confirms it.
- `tracker.remote_mismatch` now compares each Git remote's host and path against the declared host and repository, instead of looking for a `github` or `gitlab` label in the hostname. That retires the ceiling recorded on the current check.

### Remote adapters

- They read every issue of the repository, open and closed, following pagination to the end, on every call. There is no Task table and no cache.
- GitHub lists pull requests among issues; those are skipped. GitLab's issue number is its `iid`.
- **Identity** is `#<number>`. **Title** is the issue title. **Ticket** is the issue's web URL.
- **Header**: `Status:`, `Blocked by:` and `Spec:` from the body, through the shared parser. `Blocked by:` holds issue numbers, with or without `#`; `None`, with or without a parenthetical, means no dependencies.
- **State**, from ADR-0024, with one clarification made while specifying:
  - open: the `Status:` value, or `null` with `task.unknown_state` when it is missing or not a Task state;
  - closed with a reason the tracker reports: `completed` is `DONE`; `not_planned`, and `duplicate` where GitHub reports it, is `CANCELLED`;
  - closed with no reason reported — always on GitLab: `CANCELLED` when `Status:` says `CANCELLED`, otherwise `DONE`;
  - `tracker.state_mismatch` when an open issue's `Status:` is `DONE` or `CANCELLED`, or a closed issue's `Status:` is present and names a state other than the one closing gave it. A closed issue with no header is not a mismatch.
- **Triage** is the issue's label that equals one of the five canonical triage role strings (`docs/agents/triage-labels.md`), or `null`.
- **Spec slug.** The Task carries the slug of its spec: on the local tracker, the spec directory the ticket lives in, as today; on a remote tracker, the `<slug>` in `specs/<slug>/spec.md` inside the `Spec:` value, whether that value is a path or a commit-pinned permalink (ADR-0017), and `null` otherwise. The roadmap consistency checks link an epic to its Tasks by this slug on every tracker, instead of by the local id prefix.
- **Failure** never fails the operation. `tasks` is `null`, the other sections still answer, and one attention item states why:
  - `tracker.unauthorized` — the token was rejected, or an anonymous request was refused; the message says whether a token was used;
  - `tracker.forbidden` — the token lacks read access to issues;
  - `tracker.not_found` — no such repository, or not visible to this token;
  - `tracker.rate_limited`;
  - `tracker.unreachable` — network failure or timeout, under a fixed timeout constant.
- The only network requests Binnacle makes are these reads, to the declared host.

### Credentials

- Looked up for the declared host on every call, in this order: `BINNACLE_GITHUB_TOKEN` or `BINNACLE_GITLAB_TOKEN` from the daemon's environment for its provider; then the host's entry in `~/.binnacle/credentials.json` (a JSON object keyed by host); then none, and the request is anonymous.
- Generic names like `GITHUB_TOKEN` are not read: they commonly hold tokens that can write.
- A credentials file whose permissions allow access by anyone but its owner is not read, and gives `tracker.credentials_insecure`. The check applies where the platform has POSIX modes.
- Tokens are never imported from `gh` or `glab`, never written by Binnacle, and never included in any response, diagnostic, event or log line.

### Daily delta and checkpoint on a remote tracker

- A remote tracker has no history Binnacle can read at a past commit. So the `daily` and `checkpoint` events record the Task states — `{ id → state }` for every Task — on a remote tracker, alongside the head commit they already carry. The local tracker records nothing new: its transitions keep coming from Git.
- Transitions are the Tasks whose state differs from the one recorded by the baseline event. New tickets are the Tasks that recorded map does not contain.
- When the baseline carries no recorded states — no baseline yet, the fallback window, an explicit `since`, or an event recorded before this epic or while the tracker was unreadable — transitions and new tickets are unavailable, with the reason. They are never computed against a guess, and never shown as empty.
- The recorded states live in the existing event payloads, which are tier 2 under ADR-0015. No new table and no migration.

### Roadmap on every tracker

- The roadmap is read from `<knowledge.docs>/roadmap.md` whatever `tracker.provider` is (ADR-0025). The reading is unchanged; only the condition that limited it to the local tracker goes.
- Milestones are not read.

### Task brief (`task.get`)

- Input: the caller's path and a Task id, `<spec-slug>/<NN>` on the local tracker, `#<number>` or `<number>` on a remote one.
- Output: identity, title, state, triage, ticket path or URL, spec path as the `Spec:` line gives it, each declared dependency with its title, state and whether it is met (a dangling one says so), the ticket body, and the branch name.
- **Body**: the ticket text after the header block, up to the first `## Comments` heading on the local tracker; the issue body after the header block on a remote one. Issue comments are never read. It is cut at a fixed character limit, counted in code points, with an explicit truncation flag, as the current focus is.
- **Branch name**, the convention ADR-0018 makes load-bearing, defined here because the brief is the first thing to need it:
  - local tracker: `feat/<slug>`, where `<slug>` is the ticket's file name without its number and extension — this repository's existing practice;
  - remote tracker: `feat/<number>-<slug>`, where `<slug>` is the issue title lowercased, with every run of characters other than ASCII letters and digits replaced by one hyphen, trimmed of hyphens and cut to a fixed length.
  - Both are chosen so that epic 4 can map a branch back to a Task: by the leading number on a remote tracker, by the file slug on the local one. The inverse mapping itself is epic 4's.
- An unknown id is an error with code `task.not_found`. An unreadable tracker is an error carrying the tracker failure code above.
- On the local tracker the ticket is read from the caller's checkout, as the snapshot reads its tickets.

### `task_get` and `/binnacle:task`

- `task_get` takes one argument, `id`, and returns the brief as compact JSON, like every other tool.
- `/binnacle:task <id>`: detect the project, call `task_get`, present the brief, and state the branch name. It changes nothing: no branch, no `Status:` edit, no tracker write. It is procedure only, like the other four skills.

### `binn init`

- **Invocation.** `binn init [path]`, default the working directory, which must be inside a Git repository; the repository root is where it works. A human starts it; nothing else calls it.
- **Confirmation.** Each step prints what it will do — a whole new file, the exact text of an addition, the exact command it will run — and asks yes or no, default no. The end of input is a no. Declining a step skips only that step.
- **Writing rules** (ADR-0026):
  - a missing file is created;
  - an existing file is extended only when the addition is a pure append at its end, as for a TOML table or a Markdown section;
  - an existing JSON file is never rewritten; the entry to add is printed instead;
  - nothing is ever overwritten, and nothing is committed.
- **Steps**, in order:
  1. **Manifest.** An existing `.binnacle/project.yaml` is validated and its problems reported; it is never replaced. Otherwise one is proposed from facts: `project.id` from the directory name; the tracker from the Git remote — a GitHub or GitLab host gives that provider with its repository, and its host when it is not the default — or `local` with `docs/specs` when there is none; `knowledge` paths only for those that exist; `workflow.provider: matt-pocock` when that layout is detected. Nothing is written for anything not found.
  2. **Registration** with the running daemon through `project.register`. With no daemon, the step prints `binn daemon start` and `binn project register` and moves on.
  3. **Harnesses.** Detected by their executable on PATH or their user configuration directory. One template per known harness, each writing a stdio server named `binnacle` that runs `binn mcp` into that harness's project-scoped configuration: Claude Code's `.mcp.json`, Codex's `.codex/config.toml` (read by Codex in a trusted project), opencode's project configuration, and VS Code's `.vscode/mcp.json`. A harness whose configuration already names `binnacle` is skipped and reported. After the known ones, a generic stdio snippet is printed for any other harness. Adding a harness is adding a template.
  4. **Plugin**, only when Claude Code is detected: `claude plugin marketplace add <the installed package's directory>`, then `claude plugin install` of `binnacle` from that marketplace, at user scope. Skipped when Claude Code already lists the plugin. Claude Code's settings files are never edited directly.
  5. **Matt Pocock layout.** Detected by `docs/agents/issue-tracker.md` and its sibling convention files. When the tracker file exists and lacks the ticket-header section — recognised by its heading — that section is offered as an append. It states the header lines, their values, and for a remote tracker that `Blocked by:` lists issue numbers and that closing outranks `Status:`. Without the layout, init says that `/setup-matt-pocock-skills` sets it up, and runs nothing.
  6. **Agent instructions.** `AGENTS.md` and `CLAUDE.md` are read, and a `CLAUDE.md` that imports `AGENTS.md` (`@AGENTS.md`) is reported as one instruction set, not two. Init writes nothing to either. The reader is a pure function, so epic 6's audit reuses it.
  7. **Tracker check**, for a remote tracker: one read through the adapter. It reports readable, or the failure code with how to create a read-only token for that provider and where to put it. Init never asks for, stores or prints a token.
- **Summary.** It ends by listing each file created or extended, each command run, each step declined, and a reminder that nothing was committed.
- **Exit codes** as for the rest of the CLI: `0` when it ran to the end, whatever was declined.

### Standing guarantees this epic must not break

- No model invocation (ADR-0012).
- No writes to the tracker (ADR-0013). The adapters issue only read requests, and credentials are read-scoped.
- No writes into the repository by the daemon, the MCP server or any command other than `binn init` (ADR-0020, ADR-0026).
- Binnacle is not a required runtime (`AGENTS.md` §3). A project set up by `binn init` still builds, tests and develops with the daemon stopped.
- Same state, same answer. On a remote tracker, the tracker's current contents are part of the state.

## Testing Decisions

### What a good test is here

As in epics 1 and 2: a test states an externally observable fact — the response an operation returns, the event it recorded, the file `binn init` wrote or did not write, the command it ran. It does not assert which function ran or how a module is structured.

### Seam 1: the daemon's HTTP API, offline

Still the main seam, through the existing in-process test daemon helper. Fixtures are real repositories, real ticket and roadmap files and real commits, as before.

For a remote tracker, the fixture manifest declares a `host` that is a loopback base URL. The test starts a small HTTP server on it, serving fixed JSON in the shape the GitHub or GitLab API returns, with pagination. That server is the only stand-in in the offline suite, and it sits at the network boundary, not inside Binnacle. `pnpm test` stays offline and needs no token.

Through this seam: remote Tasks in the snapshot, every state rule, `tracker.state_mismatch`, pull requests skipped, pagination followed to the end, triage from labels, spec slugs from both a path and a permalink, the roadmap checks on a remote tracker, each failure code, the credentials lookup order and the insecure-file refusal, remote transitions across two dailies and their unavailability after a fallback or with `since`, and `task.get` on both trackers.

Also through this seam, **the write guarantee**: every daemon operation is called against a fixture repository, and the repository's working tree and index are unchanged afterwards.

### Seam 2: live, `pnpm test:live`

The GitHub and GitLab adapters against real test projects holding fixed issues, with read-only tokens from the environment. It proves what the loopback server can only imitate: the real response shapes, pagination headers, close reasons and authentication errors. It runs on demand, never inside `pnpm test`, and skips with a clear message when its tokens are absent.

The fixed issues cover: an open issue in each listed Task state, an open issue with no header, a closed completed issue, a closed not-planned issue on GitHub, a closed issue whose header disagrees, a `Blocked by:` naming a closed issue and one naming no issue, a body with the `Spec:` as a permalink, and on GitHub a pull request.

### Seam 3: `binn init` as a subprocess

The real `binn init` runs as a subprocess, as `apps/cli/test/smoke.test.ts` runs the CLI today, in a temporary Git repository, with `HOME` and `BINNACLE_HOME` pointed at temporary directories. Answers are fed on stdin. A fake `claude` executable first on PATH records the arguments it is called with, and the fake harness directories decide which harnesses are "installed".

Through this seam: a proposed manifest from a GitHub remote, a GitLab remote and no remote; an existing manifest left alone; every step declined writes nothing; closed stdin writes nothing; a new `.mcp.json` created; an existing `.mcp.json` untouched with the entry printed; a Codex TOML appended; an existing `binnacle` entry skipped; the plugin commands run in order with the package path, and skipped when listed; the ticket-header section appended once and not twice; the agent instructions reported as one set; registration with and without a running daemon; and nothing committed.

### The MCP smoke test

The existing single smoke test also lists `task_get` and calls it once. It stays one test.

### The packed CLI

One test packs the CLI package and asserts that the plugin, its skills and the marketplace manifest are in it.

### Not automated

The skills, as before: `/binnacle:task` is verified by the exit demonstration.

### Prior art

`apps/daemon/test/snapshot.test.ts`, `daily.test.ts` and `checkpoint.test.ts` for fixtures through the daemon seam; `apps/cli/test/smoke.test.ts` and `project.test.ts` for the CLI as a subprocess; `packages/mcp/test/smoke.test.ts` for the MCP smoke test.

## Out of Scope

- Writing to any tracker, and any tool that closes, labels or edits an issue (ADR-0013).
- Reading milestones, GitHub Projects boards, GitLab `workflow::` labels, native dependency links, sub-issues, or parent and subtask relations (ADR-0024, ADR-0025).
- Reading issue comments.
- A Task table, a cache, or any projection of tracker contents. If rate limits bite on a large tracker, that is a later change with its own measurement.
- Mapping a branch back to a Task, and everything else from session artifacts: epic 4. So is the historical-import question `binn init` gains then.
- Publishing `@binnacle/cli` to npm, and the build step that turns its TypeScript into JavaScript for installation from the registry.
- Storing or prompting for tokens in `binn init`, and importing tokens from `gh` or `glab`.
- `binn init` editing agent instruction files, running `/setup-matt-pocock-skills`, installing the Matt Pocock skills or any other capability, or filling the manifest's `capabilities` section.
- Command wrappers for harnesses other than Claude Code; other harnesses get MCP registration only (`docs/03-mcp-and-skills.md`).
- `.scratch` materialization, which phase 3 dropped, and `.scratch` hygiene, which is epic 6's audit.
- CI state in the snapshot; the Streamable HTTP transport; `/status` and `/audit` skills; `Question` and `Answer`.

## Further Notes

- **Decided while specifying this epic.**
  - A closed issue with no close reason from the tracker stays `CANCELLED` when its `Status:` says so. ADR-0024's "closing is a fact" is kept — closing is consistent with either terminal state — and GitLab, which reports no close reasons, can still express abandoned work. The first remote-adapter ticket should add this sentence to ADR-0024's decision.
  - The branch naming convention is defined here, not in epic 4 as epic 1's spec expected, because the task brief needs it first.
  - Declared `host` and `repository` retire the hostname-label heuristic in `tracker.remote_mismatch`.
- **The test projects are the owner's to create.** A GitHub repository and a GitLab project holding the fixed issues above, and a read-only token for each. The ticket that adds `pnpm test:live` needs them and should say so up front; its live criteria stay unticked until they exist.
- **Installing from npm needs a build.** Node refuses to strip types from files under `node_modules`, so the package cannot ship as `.ts` the way the linked workspace runs it today. That is the publishing work left out above. Until it is done, `binn init` is exercised from the linked CLI, where "the installed package's directory" is the linked package.
- **The plugin on this repository.** Running `binn init` here would install a user-scope copy of the plugin this repository already reads in place from its skills directory (ADR-0027), and Claude Code would see the skills twice. The plugin step should notice a project that provides `binnacle` itself and skip with that reason.
- **Codex's project configuration** is read only in a trusted project. The step for Codex says so when it writes `.codex/config.toml`.
- **Attention on a large tracker.** Every open issue without a header is an attention item (ADR-0024). On a repository with many hand-filed issues that is a long list; if it proves noisy, grouping them into one item with a count is the fix, made when it happens.
- **Exit demonstration.** The closing ticket registers a scratch project whose manifest points at the GitHub test repository, opens a fresh Claude Code session in it and runs `/binnacle:product` and `/binnacle:task #<n>` for real. It then runs `binn init` on a fresh clone of a repository with a GitHub remote, confirms every step, and checks that the resulting session has Binnacle's tools and skills. Defects are filed as tickets.
