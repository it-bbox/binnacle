# 05: Context-pressure thresholds per model, set on the Settings page

Status: DONE
Triage: ready-for-agent
Blocked by: 03
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** the context-pressure warning follows the session's model, and the owner sets its numbers on the dashboard (spec, *Thresholds per model*, *The daemon's endpoint*, *The Settings page*, *This repository's manifest*; ADR-0046). The machine's settings gain `contextPressure`, `{ tokens, models: { <model name>: <tokens> } }`, each a whole number of at least 1 000, 150 000 when unset. A session's threshold is the project manifest's `telemetry.context_pressure.tokens`, else the number for the model of its latest call, else the machine's default, else 150 000; the item's `params` gains `model` and `thresholdSource`. `context_pressure.get` and `context_pressure.set` read and write that key alone, as `parallel.get` and `parallel.set` do theirs. The Settings page gains a section beside the Parallel limit's: the default, a row per model, a field to add one with the models of the machine's last seven days offered through a native `<datalist>`, a control to remove a row, and the registered projects whose manifest overrides it, in both languages. This repository's `.binnacle/project.yaml` loses `telemetry.context_pressure`.

- [x] Through `project.snapshot`: a session of a model with its own number warns at it, another model at the machine's default, and a manifest's number wins over both; `params` names the model and the source.
- [x] An invalid `contextPressure` in the settings file gives an attention item, as `parallel_limit.invalid` does, and the warning falls back to 150 000.
- [x] Through `context_pressure.set`: a write keeps the file's other keys, the Parallel limit included; a refused value names its rule; a file that cannot be read as a JSON object is not rewritten.
- [x] Through `context_pressure.get`: the default, the numbers per model, the recent models and the projects whose manifest sets the key.
- [x] Checked in a browser: adding, changing and removing a model's number, the default, a refused value and an overriding project, in English and Russian; `apps/dashboard/test/i18n.test.ts` keeps both dictionaries complete.
- [x] This repository's manifest sets no `telemetry.context_pressure`, and `CONTEXT.md`'s *Context pressure* and `docs/04-telemetry-dashboard.md` describe the threshold's order.

## Comments

### Decisions

- `contextPressure` in the file may leave out `tokens` or `models` (150 000 and none); `context_pressure.set` takes both, as the spec's "the whole `{ tokens, models }`" says. A model name is not blank and at most 200 characters, a bound at the HTTP boundary, not from the spec.
- `params.model` and `params.thresholdSource` are given beside `threshold`, when the latest call crossed it; `model` only when the call names one. The English message names the source: `telemetry.context_pressure.tokens`, `the threshold for <model> on this machine`, `this machine's default threshold` or `the default threshold`; the Russian words each.
- The machine's thresholds are read only for a project whose manifest sets none, so a broken `contextPressure` gives `context_pressure.invalid` there alone, as `parallel_limit.invalid` does; an unreadable settings file gives both items.
- `context_pressure.get` gives the fallback for a value it cannot use, as `parallel.get` does; the snapshot's attention item says why.
- `setParallelLimit`'s write became `writeKey`, shared by both settings; `describe` names an object `a mapping`, which `SHAPES` words.
- The Settings page sends the whole form on Save; adding a model already listed changes its row.
- Checked in a browser against a temporary daemon, in Russian and English: the default set, a model added from the `<datalist>` and one typed by hand, a model's number changed to 500 and refused with the rule, a row removed and saved, and an overriding project listed. The review's fixes after it, a trimmed name and the rule's wording, are covered by the tests and the typecheck.

### Notes for the next ticket

- This repository's threshold is 150 000 once this is merged, until the owner sets a default or a number for the model on the Settings page (250 000 was the manifest's).

### Review

Reviewed in a sub-agent against `main`, on the project's standards, the ticket's spec and Security. No finding blocks.

- Fixed: `docs/operations/05-installation-checklist.md` and its Russian twin named only `parallelLimit` in `settings.json`; both now describe `contextPressure`.
- Fixed: a string refused for `tokens` read "string, given for tokens"; `describe` now says "a string", which `SHAPES` words.
- Fixed: the rule said a name of 1 to 200 characters while a blank one is refused; the rule says "not blank", and the page trims a name it adds, since a name with spaces around it never matches a call's model.
- Kept: an unreadable settings file gives both `parallel_limit.invalid` and `context_pressure.invalid`; each says which setting falls back.
- Kept: `context_pressure.get` does not carry the attention item, as `parallel.get` does not; the snapshot carries it.
- Kept: `pressureInformer` reads every registered project's records of seven days on each poll, as `usageLimitInformer` reads more; a `DISTINCT` query in the store if it ever shows.
- Kept: the Russian wording of a `context.pressure` item without `thresholdSource`, which items from before this change carry.

#### Security

No finding. The write is owner-only, through a fresh temporary file, and never over a file that cannot be read as a JSON object. Model names are kept as own properties through `Object.entries` and `Object.fromEntries` and looked up with `Object.hasOwn`, so `__proto__` or `toString` reach no prototype (`__proto__` is tested). Names are bounded at 200 characters and numbers are safe integers of at least 1 000; a refusal names a value's shape, never quoting a name back. Both operations need the daemon's token (tested). A model name from the harness's artifacts is text in the message, escaped by Vue on the page.
