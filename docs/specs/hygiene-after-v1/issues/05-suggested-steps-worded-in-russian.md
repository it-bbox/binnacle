# 05: The Suggested step and the graph's reason worded in Russian

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer

**What to build:** no line of Russian output is an English reason marked `(англ.)`, and `/binnacle:product`'s Russian report reads as Russian (spec, *The Suggested step's wording*, *The graph's reason in the vault*, *`/binnacle:product`'s Russian*; product inbox, *Wording left after epic 13*). Each Suggested step keeps its `kind` and English `description` and gains `params`, the values its description names; `wording.ts` words each kind in Russian, and the vault and the dashboard word the steps through it. The vault words the graph's unavailable reason from its code, as it words every other unavailable value. `/binnacle:product` lists "пулл-реквест" among its Russian terms and says a counted phrase agrees with its noun.

- [x] Through `project.snapshot`: each kind of Suggested step carries the values its description names in `params`, and every other field is as before.
- [x] Through `wordMessage`: each kind is worded in Russian from its `params`.
- [x] Through the vault: a Russian vault has no `(англ.)` for a Suggested step or for the graph's reason.
- [x] The dashboard in Russian shows the Suggested step in Russian, checked in a browser.
- [x] In the package build's test, `/binnacle:product`'s text and its copy carry the term and the agreement rule.

## Comments

### Decisions

- `params` per kind: one Task as `task`, several as `tasks`, each `<id> (<title>)`, so that the Russian agrees with the count without a count of its own; `autopilot`, `close` and `plan` carry `epic` and `title`; `blocked` carries them and `waits`, each READY Task with its Unmet dependencies in brackets, joined by `; `; `plan` carries `need` (`epics`, `grilling`, `spec` or `tickets`), one sentence each; `finished` carries none.
- One code, `next.alternative`, words every kind (by `kind`, and by `need` for `plan`). Core's `alternativeMessage(alternative)` builds the message, so the vault and the dashboard word a step the same way; `codes.test.ts` finds the code where it is emitted.
- The dashboard keeps its own short title per kind and shows core's wording as the reason, through `DaemonReason`, as it shows the attention; in English that is the description.
- The vault words the graph's reason, the conflict risk's, an unavailable Suggested step's and why it was served without Git from their code, as `notAvailable` does. `VaultWords.english` had no caller left and is gone.
- `/binnacle:product`'s term and agreement rule are a line of their own after the Words paragraph, not inside it: that paragraph is the same in every skill, and the spec names only `/binnacle:product`.

### For the next ticket

- A Russian vault still marks `(англ.)` where a value has no code: a conflict-risk pair's reason and a failed graph run's output. The product inbox's examples are covered; these stay English as story 27 allows.
- The vault's heading writes "пул-реквесты" (one л) and `/binnacle:product` "пулл-реквест", as the spec asks; the exit demonstration may want one spelling.

### Review

On the project's standards and the ticket's spec, in a sub-agent. The typecheck, the dashboard's typecheck and the full suite pass.

- Fixed: `blocked`'s Russian read "ждёт невыполненной зависимости, она в скобках" for several dependencies; now "ждёт невыполненных зависимостей (в скобках)".
- Fixed: `autopilot`'s "Пройдите его оставшиеся тикеты" read unnaturally; now "Запустите автопилот по его оставшимся тикетам".
- Fixed: `byHand` for several Tasks dropped "from Ready to start"; now "из готовых к старту".
- Fixed: the vault test checked the graph's reason only by the absence of `(англ.)`; it now matches the Russian line too.
- Fixed: `alternativeMessage` spread `params` after `kind`; `kind` now comes last, so a param cannot override it. `one` in the wording is a constant.
- Fixed: the new `Reason` type sat between the vault words' module comment and `VaultWords`; it now follows the type.
- Kept: the Overview page imports `alternativeMessage` from core directly rather than through `~/i18n`; a wrapper there would add a name and nothing else.
- Fixed: the reason the snapshot was served without Git has a code too, and was still marked `(англ.)`; the vault now words it.
- Kept: the `(англ.)` left for the two reasons with no code, above; outside the ticket's examples.

The dashboard in Russian was checked in a browser on a throwaway project with two READY Tasks: under "или (оценка)", both alternatives' reasons showed core's Russian wording, "У эпика 1 (Первый) есть задачи, готовые к старту…" and "first/01 (Один), first/02 (Два) готовы к старту, в любом порядке…". That was before the review reworded two of the sentences, which `packages/core/test/wording.test.ts` pins.
