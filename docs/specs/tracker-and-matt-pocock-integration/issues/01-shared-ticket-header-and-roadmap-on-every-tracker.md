# 01: One ticket-header parser, the roadmap on every tracker, and the write guarantee

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** the prefactoring every remote tracker needs, verifiable on its own. A project whose manifest declares `github` or `gitlab` gets the roadmap section of its snapshot and daily, not only `tracker.unavailable`; the roadmap consistency checks link an epic to its Tasks by spec slug rather than by the local id prefix; and one parser reads the ticket header for every tracker. A test states that no daemon operation writes into a repository. Decided in the spec, under *Workspace*, *Remote adapters* (spec slug), *Roadmap on every tracker* and *Testing Decisions* (the write guarantee).

- [ ] The ticket-header parser is a pure function in core over text. The header block is the first run of non-blank lines at the top, after one leading heading if the text starts with one. The local Markdown adapter uses it, and its behaviour on existing tickets is unchanged.
- [ ] A Task carries the slug of its spec. On the local tracker it is the spec directory the ticket lives in.
- [ ] The roadmap checks (status disagreement, `not started` with tickets) link an epic to its Tasks by that slug. Existing roadmap tests stay green unchanged.
- [ ] The roadmap is read from `<knowledge.docs>/roadmap.md` whatever `tracker.provider` is. A fixture declaring `github` shows the roadmap in the snapshot and its changes in the daily, with Tasks still unavailable.
- [ ] A test calls every operation the daemon exposes against a fixture repository and asserts that the working tree and the index are unchanged afterwards. It iterates the operation table, so an operation added later is covered without editing the test.
- [ ] Typecheck and the full suite stay green.
