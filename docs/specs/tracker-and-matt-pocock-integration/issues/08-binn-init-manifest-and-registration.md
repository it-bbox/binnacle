# 08: `binn init` — confirmation, manifest and registration

Status: DONE
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** a human runs `binn init` in a repository and gets a manifest proposed from facts, the project registered, and a closing summary — each write shown first and made only after a yes. It never overwrites a file and never commits (ADR-0026). Later tickets add steps to the same command. Decided in the spec, under *`binn init`* (invocation, confirmation, writing rules, steps 1 and 2, summary) and *Seam 3*.

- [x] `binn init [path]`, default the working directory, works at the root of the enclosing Git repository and refuses outside one. `binn --help` lists it.
- [x] Each step prints the whole new file, the exact addition or the exact command, and asks yes or no, default no. End of input is a no. Declining one step skips only that step.
- [x] The writing rules are enforced in one place: create a missing file; append to an existing one only as a pure append at its end; never rewrite an existing JSON file, print the entry instead; never overwrite; never commit.
- [x] **Manifest.** An existing `.binnacle/project.yaml` is validated, its problems reported, and left alone. Otherwise one is proposed: `project.id` from the directory name; a GitHub or GitLab remote gives that provider with `repository`, and `host` when it is not the default; no such remote gives `local` with `docs/specs`; `knowledge` paths only for those that exist; `workflow.provider: matt-pocock` when `docs/agents/issue-tracker.md` exists. Nothing is written for anything not found.
- [x] **Registration** through `project.register` after confirmation. With no daemon running it prints `binn daemon start` and `binn project register` and moves on.
- [x] **Summary**: each file created or extended, each command run, each step declined, and that nothing was committed. Exit code `0` when it ran to the end.
- [x] Tests run the real `binn init` as a subprocess in a temporary Git repository with temporary `HOME` and `BINNACLE_HOME`, answers on stdin: manifests from a GitHub remote, a GitLab remote and none; an existing manifest untouched; every step declined writes nothing; closed stdin writes nothing; registration with and without a daemon; no commit made.

## Comments

- **What changed.** `binn init` is `apps/cli/src/init.ts`, dispatched from `bin.ts` and listed in `binn --help`. It finds the repository root with the Git adapter's `readGitFacts`, so a path inside the repository works and a path outside it exits `3`. Each step is a function over a `Session`, which holds the root, `ask`, `say` and the outcomes the summary lists. Registration reuses `register` from `project-commands.ts`. The CLI now depends on `@binnacle/adapters` and `@binnacle/core` (workspace packages only). The daemon now exports `readManifest`, `MANIFEST_RELATIVE`, `OperationError` and `resolveGitTimeout`, so init validates a manifest exactly as `project.register` does. `remoteLocation` in `packages/core/src/tracker.ts` is now exported, and it keeps the path's case: the proposal writes `Acme/Shop-Front` as it is written. `tracker.remote_mismatch` still compares in lower case. The tests are `apps/cli/test/init.test.ts`.
- **For tickets 09 and 11.** Every write goes through `offerFile(session, relative, text)`, which returns whether it wrote:
  - a missing file is shown whole and created with `wx`;
  - an existing `.json` file is never asked about, and the entry is printed;
  - any other existing file is offered `text` as an append, preceded by a newline when the file does not end with one.
  
  Pass the whole new file as `text` when the same text also works as an append, as a TOML table or a Markdown section does. A new step is one more `await` in `init` before the summary. The append and JSON branches have no caller yet. They are tested in-process by the last test in `init.test.ts`, which should go once your subprocess tests reach those branches through `binn init`.
- **For ticket 10.** Nothing here touches the plugin. The plugin step is a command run after a yes; record it as `ran` with the command, so that the summary lists it.
- **Questions answered in the smallest way the spec allows.**
  - *What counts as a GitHub or GitLab remote?* A host that is `github.com` or `gitlab.com`, or that has a `github` or `gitlab` label, such as `gitlab.example.com`. `origin` is tried first, then the other remotes in order. A forge host named otherwise gets `local`. The human sees the proposal before it is written, and probing a host's API would be network traffic the spec does not allow. The ceiling is marked `ponytail:` in `forgeRemote`.
  - *A remote with a port?* The port is dropped from the proposed `host`, because an SSH port says nothing about the API's port. A GitLab served over HTTPS on a non-default port needs its `host` edited.
  - *Is registration offered with no usable manifest?* No. When the manifest was declined, is missing or has problems, registration is skipped with that reason, and init says to run `binn project register` once there is one. `project.register` would only fail.
  - *A failed `project.register`?* It is listed as `failed` in the summary, and init still exits `0`, because it ran to the end.
  - *Which answers are a yes?* `y` or `yes`, in any case, with surrounding spaces allowed. Anything else, including an empty line and the end of input, is a no.
  - *Can every step be declined at once?* Declining the manifest leaves nothing to register, so only one question is asked. Declining registration is tested separately, once a manifest exists.

### Review

`/code-review` ran against `main` on both axes.

**Standards: no hard violations, and seven judgement calls.**

1. The ticket was not yet marked done. **Fixed** by this commit.
2. The writing-rules test imports `offerFile` and asserted `session.outcomes`, an internal record. **Fixed**: that assertion is gone. **Kept**: the in-process test itself, because no step of this ticket reaches the append or JSON branch through the subprocess. Its comment says when to delete it.
3. `offerFile` and `Session` are exported, and the append and JSON branches have no caller yet. **Kept**: the ticket requires the writing rules enforced in one place now.
4. The daemon-alive check repeats `callAndReport`'s. **Left**: it is two lines, and the two places answer differently.
5. `makeHome` and `binnIn` resemble `project.test.ts`'s helpers. **Left**: each CLI test file keeps its own.
6. `note` and `lines` said little. **Fixed**: they are `record` and `answers`.
7. The test context was typed by hand. **Fixed**: it uses `TestContext`.

**Spec: every criterion is met, no scope creep, and no work from steps 3 to 7.**

1. With no manifest, registration was skipped without saying what to do next. **Fixed**: init now says to run `binn project register` once there is a manifest.
2. Test gaps.
   - A valid existing manifest was not tested. **Fixed**: it is, with a warning reported.
   - The "every step declined" test answers only one question. **Kept**, as answered above.
3. A port on a self-hosted forge is dropped. **Kept**, as answered above.
4. The hostname-label heuristic. **Kept**, as answered above.
5. A manifest with problems was still offered for registration. **Fixed**: registration is skipped with that reason, and a test covers it. A failed registration still exits `0`: **kept**.
