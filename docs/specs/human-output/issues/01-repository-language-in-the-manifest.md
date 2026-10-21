# 01: The repository language in the manifest and in binn init

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/human-output/spec.md`

**What to build:** a project states its documentation language, and `binn init` proposes it (spec, *The repository's language*; ADR-0045). The manifest gains `knowledge.language`, `en` or `ru`: null when unwritten and read as English where it is used; any other value a warning, not a problem, read as English. `binn init` proposes it from the root `README.md`, Russian when Cyrillic letters outnumber Latin ones outside code blocks and inline code, English otherwise, and from the person's language (`LC_ALL`, then `LANG`) when there is no README. The interactive form asks once with the proposal as its default, as it asks the window; `--language <en|ru>` answers it in every form; `--plan --json` reports the proposal, where it came from and whether the manifest declares one. A new manifest gets the line in the plan; an existing one with none gets it printed, never written, and only when the answer is not English. `/binnacle:init` shows the proposal in the chat, asks, and passes `--language` to `--plan` and `--apply`. `project.yaml.example` documents the field, and `docs/operations/01-new-project.md`, `02-existing-project-adopt.md` and their twins say how the language is proposed and where it is stated.

- [ ] Through the daemon's manifest tests: `en`, `ru` and absent validate; an unknown value is a warning and the manifest stays usable.
- [ ] Through the `binn` process: an English README proposes `en`, a Russian one `ru`, a README that is mostly code by its prose, no README by the locale.
- [ ] `--language` answers in the interactive form, `--plan` and `--apply`; `--plan --json` carries the proposal and its source.
- [ ] A new manifest in the plan holds `knowledge.language`; an existing one without it gets the line printed and its file unchanged; an English answer prints nothing.
- [ ] `/binnacle:init` asks the language in the chat and passes the answer (checked in review).
