# 01: binn init prints its plan as JSON

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** `binn init --plan --json [--window <days|all>] [path]` works out the same plan an interactive run would, in the same order, and prints it as one JSON object without writing, running or asking anything. This is what `/binnacle:init` (ticket 03) shows in the chat. The object carries the repository `root`, the plan's `id`, the `plan` items (each `heading` and `body`), `notes` (what init says outside the plan: a printed JSON entry, a skipped step with its reason, a prerequisite with its command), `history` (each harness's sessions in this repository) and `window` (the window the plan uses, and whether the manifest already declares one). The `id` is a hash of the root and every item's heading and body, in order. `--window` is also accepted by the interactive form, where it skips the window question. See the spec's *Implementation Decisions*, the `--plan` and identifier entries.

- [ ] `--plan --json` on a fixture repository lists the same items, in the same order, as the interactive plan on the same fixture.
- [ ] It writes no file, runs no fake on PATH, reads no stdin, and does not run the tracker check.
- [ ] Its `notes` carry what init says outside the plan, such as a printed JSON entry and a registration skipped because the daemon is not running.
- [ ] `--window 7` puts `window_days: 7` in a proposed manifest's body and changes the `id`. Without `--window`, the default is used and `window` says so.
- [ ] An empty plan prints an empty `plan` with an `id`.
- [ ] Plain `binn init` asks and writes as before. With `--window` it does not ask the window question. Without a terminal it still writes nothing.
- [ ] The CLI help names `--plan`, `--json` and `--window`.

## Comments
