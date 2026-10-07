# 03: `binn init` configures the OpenTelemetry export

Status: DONE
Triage: ready-for-agent
Blocked by: 01, 02
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** `binn init`'s plan, for each detected harness that exports OpenTelemetry — Claude Code, Codex, Gemini CLI — shows the change to its user-scope settings pointing the export at the daemon's address, JSON over HTTP, prompt logging off, and makes it after the one confirmation (spec, *`binn init`'s telemetry step*). A harness already exporting elsewhere is left as it is and named; a harness that cannot export is named in the Summary with its reason. `binn audit`'s telemetry readiness reports whether each detected harness exports to Binnacle.

- [x] Init tests with fake settings in a temporary home: the export written to each supporting harness after the yes; a declined plan writes nothing; `--plan --json` and `--apply` carry the same changes.
- [x] An existing exporter is left alone and named; a harness without export is named with its reason.
- [x] Audit tests: telemetry readiness says, per detected harness, whether it exports to Binnacle.

## Comments

- **Where it lives.** `apps/cli/src/export.ts`: per exporting harness, its user-scope settings file, how it reads them (`binnacle`, `none`, settings of its own, `unreadable`), the change shown and the whole new file; `NO_EXPORT` for detected harnesses that cannot export; `detected`, which init's other steps now share; `daemonAddress`. `telemetryStep` in `init.ts` plans the writes after the MCP servers; `telemetryExport` in `audit-tools.ts` gives `telemetry.export_<harness>` findings. The settings written are in `docs/operations/05-installation-checklist.md`, *Telemetry capability check*.
- **The formats, confirmed against each harness's source or docs on 2026-10-07.** Claude Code: `env` with `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_LOGS_EXPORTER=otlp`, `OTEL_EXPORTER_OTLP_PROTOCOL=http/json` and the generic `OTEL_EXPORTER_OTLP_ENDPOINT`, to which its SDK appends `/v1/logs`; prompts are logged only with `OTEL_LOG_USER_PROMPTS`, never set. Codex (`codex-rs/otel`): `[otel]` `exporter = { otlp-http = { endpoint, protocol = "json" } }`, whose endpoint is used verbatim, so it names `/v1/logs`, and `log_user_prompt = false`. Gemini CLI (`packages/core/src/telemetry/sdk.ts`): `otlpProtocol: "http"` uses `@opentelemetry/exporter-logs-otlp-http`, which is JSON, with `url` built by appending `v1/logs` to `otlpEndpoint`; `logPrompts` defaults to true, so it is written false; `target: "local"`, no `outfile`. Its file is `.gemini/settings.json` under `GEMINI_CLI_HOME` or `~`, as ticket 04 reads its sessions.
- **The address** is the running daemon's, else `http://127.0.0.1:` with `BINNACLE_PORT` or 7717, the daemon's `Host` check needing `127.0.0.1` rather than `localhost`. A question that blocked nothing, answered the smallest way: with no daemon and `BINNACLE_PORT` 0 (any free port), no setting can name the address, so init skips the step and says so, and the audit's finding is `unknown`. A daemon started on port 0 writes its random port, which changes at its next start; ponytail, as tests are the only ones to start one so.
- **Settings of a harness's own are left alone**, not only an export elsewhere: Claude Code's `env` with any `OTEL_` variable, Codex's file with an `[otel]` table (a second one would make the TOML invalid), Gemini CLI's with a `telemetry` block, unless they are exactly Binnacle's. `exporter = "none"` or `enabled: false` is the owner's choice, kept. A JSON file that does not parse, such as Gemini CLI's with comments, gets the change printed.
- **What the plan shows** is the change, not the whole file: a user's settings may hold keys and tokens that `--plan --json` would carry into a chat. A JSON file is rewritten with the change merged, keeping its other keys, and, as the vault step does, only if it is the text read when the plan was made.
- **Harnesses without an export**: opencode, as the spec says, and VS Code, which init detects for its MCP registration and Binnacle reads nothing of. Antigravity and ZCode are not detected by `binn init` yet: tickets 07 and 08, which learn where they live, should add them to `NO_EXPORT` with their reason. The audit reports these as `ok`, with the reason: nothing there is the owner's to fix.
- Rebased onto `main` after ticket 04 merged; the full suite passes on it.

### Review

`/code-review` against `main`, both axes.

- Standards: `Exporter` had `write: 'merge' | 'append'` and an optional `merged`, needing a `!` and a cast — **fixed**: each harness gives the whole new file (`next`), and every write is one checked `writeFileSync`.
- Standards: the harness list's executables and user directories now in `export.ts` beside init's `HARNESSES`, and `CLAUDE_CONFIG_DIR`/`CODEX_HOME` read a third time — **kept**: two strings per harness; `HARNESSES` describes MCP registration, `exporters` telemetry, and Gemini CLI is only in the second.
- Standards: init and audit both branch on the export state — **kept**: what they say differs; one table would cost more than the two cascades.
- Standards: Claude Code is detected by `~/.claude` while its settings follow `CLAUDE_CONFIG_DIR` — **fixed**: a comment says so. `found` holding a state in `telemetryStep` — **fixed**: `state`.
- Standards: init now writes Claude Code's settings, which `pluginStep`'s comment said it never did — **kept** without an ADR: ADR-0026's consequences already cover user-scope harness configuration written after confirmation, and the spec decides this write; the comment was corrected.
- Spec: Gemini CLI's endpoint without `/v1/logs` would post to `/` — **kept**: Gemini CLI's `sdk.ts` builds the HTTP exporter's `url` by appending `v1/logs` to `otlpEndpoint` (above).
- Spec: settings of a harness's own that export nowhere were named as an export elsewhere — **fixed**: init and the audit call them settings of its own.
- Spec: Antigravity and ZCode are not named — **left** to tickets 07 and 08 (above). VS Code named beside opencode — **kept**. The audit's `ok` for a harness that cannot export — **kept** (above).
