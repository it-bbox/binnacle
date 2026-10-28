# 04: The Russian wording left after 0.4.0

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-0-4-0/spec.md`
Roles: Developer, Reviewer

**What to build:** the Russian vault has no reason marked `(англ.)` and spells "пулл-реквест" as `/binnacle:product` does (spec, *The Russian wording*; product inbox, *Left after epic 20's tickets*). Each pair in `impact.pairs` gains `kind` (`unmapped`, `shared`, `neighbours`, `apart`) and `params` with the values its `reason` names, the English `reason` kept; `wording.ts` words each kind, and the vault words the pair through it, in lower case after its dash. A failed Graphify run gets the code `graph.build_failed` with the tool's output in `params`: Russian names the failure in words and quotes the output as the tool's, with no `(англ.)`. "пул-реквесты" becomes "пулл-реквесты".

- [ ] Through `project.snapshot`: each pair carries its `kind` and `params` beside its unchanged `reason`.
- [ ] Through `wordMessage`: each pair kind and `graph.build_failed` are worded in Russian; `apps/daemon/test/codes.test.ts` keeps every code worded.
- [ ] Through the vault, in Russian: no `(англ.)` for a pair or a failed Graphify run, a reason after a dash in lower case, and "пулл-реквесты".
- [ ] The dashboard, wherever it shows a pair's reason, words it through the same code in Russian.
