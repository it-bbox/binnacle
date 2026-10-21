# 04: binn audit in the person's language, plan first

Status: READY
Triage: ready-for-agent
Blocked by: 03
Spec: `docs/specs/human-output/spec.md`

**What to build:** `binn audit`'s text leads with what to do, in the person's language (spec, *`binn audit`'s findings carry their values*). Its findings carry the values their reasons and recommendations are written from, and the text output words them from the CLI dictionary: one line of totals, then the migration plan, its steps naming their areas rather than codes, then the gaps and unknowns by area, each with its reason and recommendation, then the `ok` findings one line each. No finding code is in the text. `--json` keeps today's English reasons and recommendations, the codes and `plan` as they are. `/binnacle:audit` is ticket 09.

- [ ] Through the `binn` process: the totals, then the plan, then gaps and unknowns by area, then `ok`, in English and in Russian.
- [ ] No code in the text; `--json` byte-for-byte the same under either locale.
- [ ] The existing tests that the audit writes nothing, runs offline and never prints a secret's value pass in both languages.
