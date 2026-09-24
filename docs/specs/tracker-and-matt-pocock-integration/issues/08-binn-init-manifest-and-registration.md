# 08: `binn init` — confirmation, manifest and registration

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** a human runs `binn init` in a repository and gets a manifest proposed from facts, the project registered, and a closing summary — each write shown first and made only after a yes. It never overwrites a file and never commits (ADR-0026). Later tickets add steps to the same command. Decided in the spec, under *`binn init`* (invocation, confirmation, writing rules, steps 1 and 2, summary) and *Seam 3*.

- [ ] `binn init [path]`, default the working directory, works at the root of the enclosing Git repository and refuses outside one. `binn --help` lists it.
- [ ] Each step prints the whole new file, the exact addition or the exact command, and asks yes or no, default no. End of input is a no. Declining one step skips only that step.
- [ ] The writing rules are enforced in one place: create a missing file; append to an existing one only as a pure append at its end; never rewrite an existing JSON file, print the entry instead; never overwrite; never commit.
- [ ] **Manifest.** An existing `.binnacle/project.yaml` is validated, its problems reported, and left alone. Otherwise one is proposed: `project.id` from the directory name; a GitHub or GitLab remote gives that provider with `repository`, and `host` when it is not the default; no such remote gives `local` with `docs/specs`; `knowledge` paths only for those that exist; `workflow.provider: matt-pocock` when `docs/agents/issue-tracker.md` exists. Nothing is written for anything not found.
- [ ] **Registration** through `project.register` after confirmation. With no daemon running it prints `binn daemon start` and `binn project register` and moves on.
- [ ] **Summary**: each file created or extended, each command run, each step declined, and that nothing was committed. Exit code `0` when it ran to the end.
- [ ] Tests run the real `binn init` as a subprocess in a temporary Git repository with temporary `HOME` and `BINNACLE_HOME`, answers on stdin: manifests from a GitHub remote, a GitLab remote and none; an existing manifest untouched; every step declined writes nothing; closed stdin writes nothing; registration with and without a daemon; no commit made.
