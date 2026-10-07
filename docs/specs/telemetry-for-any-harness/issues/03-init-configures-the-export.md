# 03: `binn init` configures the OpenTelemetry export

Status: READY
Triage: ready-for-agent
Blocked by: 01, 02
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** `binn init`'s plan, for each detected harness that exports OpenTelemetry — Claude Code, Codex, Gemini CLI — shows the change to its user-scope settings pointing the export at the daemon's address, JSON over HTTP, prompt logging off, and makes it after the one confirmation (spec, *`binn init`'s telemetry step*). A harness already exporting elsewhere is left as it is and named; a harness that cannot export is named in the Summary with its reason. `binn audit`'s telemetry readiness reports whether each detected harness exports to Binnacle.

- [ ] Init tests with fake settings in a temporary home: the export written to each supporting harness after the yes; a declined plan writes nothing; `--plan --json` and `--apply` carry the same changes.
- [ ] An existing exporter is left alone and named; a harness without export is named with its reason.
- [ ] Audit tests: telemetry readiness says, per detected harness, whether it exports to Binnacle.

## Comments
