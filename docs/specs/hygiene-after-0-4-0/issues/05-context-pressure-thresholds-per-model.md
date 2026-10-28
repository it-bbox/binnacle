# 05: Context-pressure thresholds per model, set on the Settings page

Status: READY
Triage: ready-for-agent
Blocked by: 03
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** the context-pressure warning follows the session's model, and the owner sets its numbers on the dashboard (spec, *Thresholds per model*, *The daemon's endpoint*, *The Settings page*, *This repository's manifest*; ADR-0046). The machine's settings gain `contextPressure`, `{ tokens, models: { <model name>: <tokens> } }`, each a whole number of at least 1 000, 150 000 when unset. A session's threshold is the project manifest's `telemetry.context_pressure.tokens`, else the number for the model of its latest call, else the machine's default, else 150 000; the item's `params` gains `model` and `thresholdSource`. `context_pressure.get` and `context_pressure.set` read and write that key alone, as `parallel.get` and `parallel.set` do theirs. The Settings page gains a section beside the Parallel limit's: the default, a row per model, a field to add one with the models of the machine's last seven days offered through a native `<datalist>`, a control to remove a row, and the registered projects whose manifest overrides it, in both languages. This repository's `.binnacle/project.yaml` loses `telemetry.context_pressure`.

- [ ] Through `project.snapshot`: a session of a model with its own number warns at it, another model at the machine's default, and a manifest's number wins over both; `params` names the model and the source.
- [ ] An invalid `contextPressure` in the settings file gives an attention item, as `parallel_limit.invalid` does, and the warning falls back to 150 000.
- [ ] Through `context_pressure.set`: a write keeps the file's other keys, the Parallel limit included; a refused value names its rule; a file that cannot be read as a JSON object is not rewritten.
- [ ] Through `context_pressure.get`: the default, the numbers per model, the recent models and the projects whose manifest sets the key.
- [ ] Checked in a browser: adding, changing and removing a model's number, the default, a refused value and an overriding project, in English and Russian; `apps/dashboard/test/i18n.test.ts` keeps both dictionaries complete.
- [ ] This repository's manifest sets no `telemetry.context_pressure`, and `CONTEXT.md`'s *Context pressure* and `docs/04-telemetry-dashboard.md` describe the threshold's order.
