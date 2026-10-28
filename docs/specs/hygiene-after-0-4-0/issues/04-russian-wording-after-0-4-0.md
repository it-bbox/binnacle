# 04: The Russian wording left after 0.4.0

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`
Roles: Developer, Reviewer

**What to build:** the Russian vault has no reason marked `(англ.)` and spells "пулл-реквест" as `/binnacle:product` does (spec, *The Russian wording*; product inbox, *Left after epic 20's tickets*). Each pair in `impact.pairs` gains `kind` (`unmapped`, `shared`, `neighbours`, `apart`) and `params` with the values its `reason` names, the English `reason` kept; `wording.ts` words each kind, and the vault words the pair through it, in lower case after its dash. A failed Graphify run gets the code `graph.build_failed` with the tool's output in `params`: Russian names the failure in words and quotes the output as the tool's, with no `(англ.)`. "пул-реквесты" becomes "пулл-реквесты".

- [x] Through `project.snapshot`: each pair carries its `kind` and `params` beside its unchanged `reason`.
- [x] Through `wordMessage`: each pair kind and `graph.build_failed` are worded in Russian; `apps/daemon/test/codes.test.ts` keeps every code worded.
- [x] Through the vault, in Russian: no `(англ.)` for a pair or a failed Graphify run, a reason after a dash in lower case, and "пулл-реквесты".
- [x] The dashboard, wherever it shows a pair's reason, words it through the same code in Russian.

## Comments

### Decisions

- One code per message, as `next.alternative` is: `impact.pair` words a pair by its `kind`, and core's `pairMessage(pair)` builds the message, so the vault and the dashboard word it the same way. A pair's `params`: `unmapped`, `task` and `from` (`branch` or `ticket`), with `other` and `otherFrom` when both Tasks touch no module; `shared`, `modules` joined by `, `; `neighbours`, each two neighbouring modules joined by `, `, the twos by `; `; `apart`, none. `Params` holds only flat values, hence the separators; a module path holding one of them would split wrongly, marked `ponytail:` in `wording.ts`.
- A failed run's `params`, stored in the `graph.failed` event's payload beside its English `reason`: `kind` `output` (the tool's last stderr line, `output`), `spawn` (`error`), `signal` (`signal`) or `exit` (`exitCode`), and `command` when the report step failed rather than the extract. A run recorded before this change, with no `params`, reads as `kind: 'recorded'` with its reason as `output`, quoted as recorded, never marked.
- `graph.update_failed` carries the run's `params` beside its `reason`, and its Russian names the failure through the same words as `graph.build_failed`.
- One full stop after a quoted output: the output's own last one is dropped in Russian.
- The dashboard's own pair wording (`pairReason`, `pairReasons` in both dictionaries) is gone, and `DaemonReason`'s `translated` prop with it: the Overview shows `pairMessage(pair)` through `DaemonReason`. The graph card's last run, which `DaemonReason` already shows, is worded now that the run has a code.

### For the next ticket

- A Russian vault still marks `(англ.)` for a reason the daemon gives with no code at all; a pair and a failed Graphify run are no longer among them.
- Ticket 08's exit demonstration: a Russian vault's *Параллельная работа* and *Граф* sections, with a graph and a failed run, carry no `(англ.)`, and its CI heading reads "Открытые пулл-реквесты".

### Review

On the project's standards and the ticket's spec, in a sub-agent. The typecheck, the dashboard's typecheck and the full suite (905 tests) pass.

- Fixed: `apps/dashboard/app/i18n/en.ts` kept the removed `pairReasons`' comment above `runningNow`; removed.
- Fixed: `DaemonReason`'s `translated` prop had no caller left; removed with its branch and its mention in the comment.
- Fixed: the Russian of an output ending in a full stop gave two, «…graph.».; the output's own last one is dropped.
- Fixed: a failed run recorded before its failure was coded was only checked in core's wording test; `apps/daemon/test/graph.test.ts` now strips `params` from a recorded event and reads `lastRun` and the attention item back through `project.snapshot`.
- Kept: a pair whose two Tasks both touch no module is checked in core's wording test only; the snapshot's encoding of it is two lines beside the one-Task case that `impact.test.ts` checks.
- Kept: in Russian, a failed run whose params core could not use would end without a full stop after `(англ.)`; the daemon always writes usable params, so it does not arise.
- Kept: the separators in `neighbours`, marked `ponytail:` with their ceiling.

The dashboard in Russian was checked in a browser on a throwaway project with a graph and four READY Tasks: under *Риск конфликта*, each pair's reason showed core's wording, "Обе затрагивают src/a.ts.", "Их модули соседствуют в графе: src/a.ts и src/b.ts." and "Тикет alpha/04 не называет ни одного модуля графа."
