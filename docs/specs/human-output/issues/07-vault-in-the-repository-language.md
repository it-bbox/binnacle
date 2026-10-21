# 07: The vault in the repository language

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/human-output/spec.md`

**What to build:** the vault's own words follow the repository (spec, *The vault's own words in the repository language*). The daemon reads `knowledge.language` from the manifest it already reads, and writes the snapshot's and the daily's notes, their headings and generated lines, in it, with the spec's Russian terms. Notes copied from the repository are unchanged, and the generated marker, `generated-by: binnacle`, stays as it is. The autostart service's environment does not change. `docs/03-mcp-and-skills.md` and `docs/operations/05-installation-checklist.md` with its twin say so where they describe the projection.

- [x] Through the daemon's vault tests: a Russian repository's snapshot and daily notes in Russian, an English one's as today.
- [x] The generated marker is the same in both, and a note the human wrote is never touched.

## Comments

### Decisions

- **The vault's words are `apps/daemon/src/vault-text.ts`**, an English and a Russian `VaultWords`, chosen by `vaultWords(manifest.knowledge.language)` in `writeServed`, which already had the manifest: no extra read. The English set reproduces the notes as they were, byte for byte; the existing vault tests pin them.
- **A Task's state, an epic's status, CI's state and a conflict risk are worded in Russian** with `CONTEXT.md`'s words (`READY` reads готова, `in progress` в работе); a value the table does not know is written as it came.
- **An attention item in a Russian note is worded by core's `wordMessage` without its code**, as `binn` and the dashboard show it; one with no wording keeps its English, marked `(англ.)`. The English note keeps `` `code`: message `` as before.
- **A reason the daemon has only as an English sentence** (a section's `Unavailable.reason`, the graph's reason, a conflict pair's reason, a Suggested step's description) is written as it is and, in Russian, marked `(англ.)`. The daily's fallback is worded from its `reason` code, with the window's days.
- **What the repository says stays as written**: ticket titles, questions, epic titles, the Next action's description, commit subjects, ADR titles, as do the notes copied from the repository and the frontmatter.

### For the next tickets

- Ticket 08: the Russian words for states, CI and risk are a table in `vault-text.ts`; the dashboard's own dictionary is its own (spec, *The dashboard's page text stays in its own dictionary*), but `NO_FORGE` and the graph's reasons, marked `(англ.)` in the vault, are the uncoded reasons ticket 02 left for it.
- A Suggested step stays English in a Russian note, marked: an alternative carries its `kind` and Task ids but not the epic or the values its sentence is written from, so a Russian wording would drop them. Giving alternatives `params`, worded in `@binnacle/core` as the daemon's codes are, would serve the vault and the dashboard alike.

### Review

A Reviewer sub-agent ran against `main` on both axes. The English notes are byte for byte as on `main`; no new dependency, nothing outside the ticket; both criteria hold.

**Standards:**

1. **`fallback` took the window's days only Russian uses**, through an import in `vault.ts`. **Fixed**: `vault-text.ts` imports `FALLBACK_DAYS` itself.
2. **`VaultWords.reason` named a Suggested step's description.** **Fixed**: renamed `english`.

**Spec:**

1. **"(calculated)" as «(оценка)»**, which the dashboard's dictionary keeps for "estimated". **Kept**: the spec's *Marks of calculation* make «(оценка)» the one mark for Binnacle's calculations, conflict risk among them; the dashboard's «расчёт» is ticket 08's to replace.
2. **«без незакоммиченных изменений»** said there were none. **Fixed**: «незакоммиченные изменения не учтены».
3. **The Suggested step stays English, marked.** **Kept**: its wording needs values an alternative does not carry; recorded under *For the next tickets*.
4. **The Russian fallback drops the baseline's commit.** **Kept**: the daily's JSON and the English note name it; the Russian line says why the window was used.
5. **«7 дн.»** read clipped. **Fixed**: the day's plural by `Intl.PluralRules`.
6. **The guide did not say a Russian note words attention without its code**, and its autostart clause read oddly. **Fixed** in both twins.
7. **The test did not pin the fallback line or a marked English reason.** **Fixed**: one assertion each.

Typecheck is clean, and the full suite passes: 889 of 889.
