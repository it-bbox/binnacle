# 11: `binn init` — Matt Pocock layout, agent instructions and the tracker check

Status: DONE
Triage: ready-for-agent
Blocked by: 08, 03
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** `binn init` teaches `/to-tickets` the ticket header by offering a section for `docs/agents/issue-tracker.md`, reports the repository's agent instructions as one set when one file imports the other, and checks that a remote tracker can be read. Decided in the spec, under *`binn init`*, steps 5 to 7, and ADR-0024.

- [x] The Matt Pocock layout is detected by `docs/agents/issue-tracker.md` and its sibling convention files.
- [x] When the tracker file lacks the ticket-header section, recognised by its heading, the section is offered as an append: the `Status:`, `Blocked by:` and `Spec:` lines and their values; on a remote tracker, that `Blocked by:` lists issue numbers and that closing outranks `Status:`. A second run offers nothing.
- [x] Without the layout, init says that `/setup-matt-pocock-skills` sets it up, and runs nothing.
- [x] `AGENTS.md` and `CLAUDE.md` are read by a pure function, and a `CLAUDE.md` importing `@AGENTS.md` is reported as one instruction set. Nothing is written to either.
- [x] On a remote tracker, one read through the adapter reports readable, or the failure code with how to create a read-only token for that provider and where to put it. Init never asks for, stores or prints a token.
- [x] Subprocess tests: the section appended once and not twice, the layout missing, one and two instruction sets, a readable and an unreadable tracker against the loopback stand-in.

## Comments

- **What changed.** Steps 5 to 7 are `mattPocockStep`, `instructionsStep` and `trackerStep` in `apps/cli/src/init.ts`. They run after ticket 10's plugin step and before the summary. The manifest is read once for both steps that need it, after steps 1 to 4, so a manifest written in this run is the one used.
  - **Step 5.** The layout is any of `docs/agents/issue-tracker.md`, `triage-labels.md` or `domain.md`, the files `/setup-matt-pocock-skills` writes. The manifest proposal now uses the same detection for `workflow.provider: matt-pocock`. The section's heading is `## Ticket header`, and it is recognised at any level, in any case. It is offered through `offerFile` as an append that starts with a blank line. Its text comes from one `CONVENTIONS` entry per provider, with every Task state listed from `TASK_STATES`, which `@binnacle/core` now exports.
  - **Step 6.** The pure function is `instructionSets` in `packages/core/src/instructions.ts`, for epic 6's audit to reuse. It maps file names to their texts and returns the sets, each importing file first. An import is Claude Code's `@AGENTS.md` or `@./AGENTS.md`. A mention inside inline code or a fenced block does not count.
  - **Step 7.** It reads through ticket 06's `readTracker`, now exported from `@binnacle/daemon`, so the credentials lookup and every failure code are the daemon's own. `credentialsKey(provider, host)` was pulled out of `trackerToken` in `apps/daemon/src/home.ts`. The advice therefore names the same key the daemon reads, and `credentialsPath` is exported with it.
- **Offline tests.** A proposed manifest now declares a real host, `github.com` or `gitlab.example.com`, and step 7 reads it. Every `binn` in `apps/cli/test/init.test.ts` runs with `NODE_USE_ENV_PROXY=1` and a proxy on a refused loopback port, with `NO_PROXY` set to loopback. A real host fails at once as `tracker.unreachable`, and the loopback stand-ins still answer. `binnInit` runs `binn init` asynchronously, so a stand-in in the test's own process can answer it. The tests also drop `BINNACLE_GITHUB_TOKEN` and `BINNACLE_GITLAB_TOKEN` from the inherited environment.
- **Merged with tickets 06, 09 and 10**, which landed while this ran. This branch was rebased onto each.
  - This branch's own remote read gave way to 06's `readTracker`.
  - The steps run in the spec's order, 1 to 7.
  - Ticket 09 removed the in-process writing-rules test, so the JSON-rule test this branch had kept went with it.
- **For ticket 12.** Running `binn init` on this repository offers the section to `docs/agents/issue-tracker.md`. That file describes the header under `## Conventions` and `## Projects using a remote tracker`, not under `## Ticket header`. Decline it there, or give the file that heading.
- **Questions answered in the smallest way the spec allows.**
  - *What is "the layout" when only some of the convention files exist?* Any one of the three is the layout, and it is reported file by file. The section needs `issue-tracker.md`. Without that file, init says `/setup-matt-pocock-skills` writes it, and offers nothing.
  - *Which tracker does the section describe when there is no usable manifest?* The one the proposal would declare from the Git remote, otherwise `local`.
  - *Does the tracker check ask first?* No. It writes nothing, and the confirmation rule covers writes. It is one read, to the host the manifest declares. It runs only against a readable manifest that declares `github` or `gitlab`.
  - *What goes in the summary?* Step 5's outcome as for any file, and step 7's as `checked tracker: readable` or `failed tracker check: <code>`. Step 6 writes nothing and runs nothing, so it is only reported in place.
  - *Whose environment does the check read?* `binn init`'s own, with the lookup `trackerToken` does. When `BINNACLE_<PROVIDER>_TOKEN` is set in that shell, init says so, because the daemon reads the variable only from the environment it was started with.
  - *Token advice for every failure code?* For every code except a missing `tracker.repository`, where the fix is the manifest. On `tracker.credentials_insecure` and an unusable token, the message already names the cause, and the advice says where a good token goes.
- **Hand check, optional.** The token instructions name menu paths in GitHub's and GitLab's web UI, which no test can follow:
  ```sh
  # In a scratch repository whose manifest declares a private repository, with no token set:
  BINNACLE_HOME=$(mktemp -d) binn init   # answer n to every question
  # Follow the printed path on the provider's site; check that it reaches a read-only token page.
  ```

### Review

`/code-review` ran against `main` on both axes, before the rebase onto ticket 09. That rebase only merged test helpers and one environment variable, so it was checked by the full suite and not reviewed again.

**Standards: no hard violations, and six judgement calls.**

1. Duplicated Code: the manifest was read three times, and `forgeRemote` ran twice. **Fixed**: `init` reads the manifest once for steps 5 and 7. **Kept**: step 1 still reads it to validate it, and `forgeRemote` runs again only for a missing manifest. It is a pure function of the remotes.
2. Steps 6 and 7 do not always `record`. **Kept**: the summary lists writes, commands and declined steps (spec, *Summary*), and step 7 records every result it reaches.
3. Repeated Switches: five `remote ? … : …` in `ticketHeaderSection`. **Fixed**: one `CONVENTIONS` entry per provider, which the GitLab fix below needed anyway.
4. Speculative Generality: `instructionSets` takes any files. **Kept**: a two-file version is the same size and would tie the function to two names. The spec makes it the reader epic 6 reuses. Its `ponytail:` note gives the one-level-import ceiling.
5. Duplicated Code: the two test helpers built the same environment. **Fixed**: `envFor(home)`.
6. `reading.diagnostics[0]!`. **Kept**: `readTracker` gives a diagnostic on every path that gives no Tasks.

**Spec: every criterion is met, with one wrong text and three weak points.**

1. The section told a GitLab team that "closed as not planned" means cancelled. GitLab reports no close reason, so a closed GitLab issue is `CANCELLED` only when its `Status:` says so. **Fixed**: GitLab's section says that, GitHub's adds the no-reason case, and a test checks each.
2. The check reads the shell's token, while the daemon reads its own environment. **Fixed**: init says when it used a token from the shell, and what that means for the daemon.
3. Token advice after `tracker.unavailable` for a missing repository. **Fixed**: that case names the manifest field only, and a test covers it.
4. This repository's own tracker file would be offered the section. **Left**: recognition by heading is the spec's rule, and declining is one answer. It is recorded for ticket 12 above.
5. Scope: the manifest proposal's layout detection widened from `issue-tracker.md` alone to any convention file. **Kept**, as answered above: one detection for steps 1 and 5.
