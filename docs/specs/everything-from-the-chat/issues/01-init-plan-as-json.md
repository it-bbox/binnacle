# 01: binn init prints its plan as JSON

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** `binn init --plan --json [--window <days|all>] [path]` works out the same plan an interactive run would, in the same order, and prints it as one JSON object without writing, running or asking anything. This is what `/binnacle:init` (ticket 03) shows in the chat. The object carries the repository `root`, the plan's `id`, the `plan` items (each `heading` and `body`), `notes` (what init says outside the plan: a printed JSON entry, a skipped step with its reason, a prerequisite with its command), `history` (each harness's sessions in this repository) and `window` (the window the plan uses, and whether the manifest already declares one). The `id` is a hash of the root and every item's heading and body, in order. `--window` is also accepted by the interactive form, where it skips the window question. See the spec's *Implementation Decisions*, the `--plan` and identifier entries.

- [x] `--plan --json` on a fixture repository lists the same items, in the same order, as the interactive plan on the same fixture.
- [x] It writes no file, runs no fake on PATH, reads no stdin, and does not run the tracker check.
- [x] Its `notes` carry what init says outside the plan, such as a printed JSON entry and a registration skipped because the daemon is not running.
- [x] `--window 7` puts `window_days: 7` in a proposed manifest's body and changes the `id`. Without `--window`, the default is used and `window` says so.
- [x] An empty plan prints an empty `plan` with an `id`.
- [x] Plain `binn init` asks and writes as before. With `--window` it does not ask the window question. Without a terminal it still writes nothing.
- [x] The CLI help names `--plan`, `--json` and `--window`.

## Comments

### For the next tickets

- **The JSON.** `{ root, id, plan: [{ heading, body }], notes: [string], history: [{ harness, sessions, oldest }], window: { days, declared, default } }`. `oldest` is the local date of the oldest session, `YYYY-MM-DD`, or `null` when there are none. `window.days` is a number or `"all"`. `declared` is true when the manifest already declares the window, which then wins over `--window`. `default` is true when `days` is the default, 90. `notes` is everything init says outside the plan, one entry per paragraph: printed entries, skipped steps with their reason, prerequisites with their command. The history and the window question are not repeated in the notes.
- **The id** is a SHA-256, in hex, of `JSON.stringify([root, ...plan.map(item => [heading, body])])`. It is computed by `planId` in `apps/cli/src/init.ts`, which is still private. Ticket 02 should compute the id the same way, by working out the plan again with the same window.
- **The window without `--window`.** `--plan` takes the default as if Enter were pressed at the question, so a new manifest's body ends with `window_days: 90`. `--apply` without `--window` has to do the same, or its id will not match. This differs from the end of input at the interactive question, which declares nothing.
- **Usage.** `--plan` and `--json` go only together. Either one alone, an empty or invalid `--window`, an unknown option or a second path is a usage error, exit 2. Arguments are parsed with `node:util`'s `parseArgs` in `apps/cli/src/bin.ts`.
- **Stdin** is opened at the first question only, in both forms. A run that asks nothing neither reads stdin nor holds it open.

### Decided while implementing

- **"Runs no fake on PATH."** `--plan` still runs `claude plugin list --json`, the read-only listing the interactive form also runs before its plan. The binnacle plugin, the skill plugins and the tools' items depend on it, and the spec requires the same items as the interactive plan. Nothing the plan proposes is run: the test checks that the listing is the only call a fake records, and that no installer runs. The criterion is ticked on that reading: the spec says "It writes nothing and runs nothing: no apply, and no tracker check".

### Review

Code review against `main` on two axes, Standards and Spec. No hard violations, and no missing requirement.

- Fixed: a note's first line lost its indentation, because `trim()` was used. Only the blank lines around a note are removed now.
- Fixed: `planId` was exported with no importer. It stays private until ticket 02 needs it.
- Fixed: `bin.ts` passed the path twice, once positionally and once inside the options. Its `node:util` import was also moved to the top, and `Session.history` got a doc comment.
- Fixed: `docs/04-telemetry-dashboard.md` said that `binn init` always asks for the window. It now names `--window` and `--plan --json`.
- Kept: the read-only `claude plugin list --json` under `--plan`, as decided above.
- Kept: `window.default` is true for an explicit `--window 90` as well. It says that the window is the default, not where the window came from.
- Kept: a window the manifest declares wins over `--window`, as at the interactive question. `declared: true` says so, and so does the note "declares telemetry.import.window_days". Ticket 03's skill should show it.
- Kept: `history[].oldest` is the local date, the same date the terminal shows.
- Kept, judgement call: `planOnly` is branched on in a few places in `init`. A separate code path would duplicate the steps that must stay in the same order.
- Left: the `{ heading, body }` shape is spelled out in `init` and again in the test's `PlanJson` type. The test describes the contract that a client sees.
