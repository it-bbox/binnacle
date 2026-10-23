# 05: The Suggested step and the graph's reason worded in Russian

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer

**What to build:** no line of Russian output is an English reason marked `(англ.)`, and `/binnacle:product`'s Russian report reads as Russian (spec, *The Suggested step's wording*, *The graph's reason in the vault*, *`/binnacle:product`'s Russian*; product inbox, *Wording left after epic 13*). Each Suggested step keeps its `kind` and English `description` and gains `params`, the values its description names; `wording.ts` words each kind in Russian, and the vault and the dashboard word the steps through it. The vault words the graph's unavailable reason from its code, as it words every other unavailable value. `/binnacle:product` lists "пулл-реквест" among its Russian terms and says a counted phrase agrees with its noun.

- [ ] Through `project.snapshot`: each kind of Suggested step carries the values its description names in `params`, and every other field is as before.
- [ ] Through `wordMessage`: each kind is worded in Russian from its `params`.
- [ ] Through the vault: a Russian vault has no `(англ.)` for a Suggested step or for the graph's reason.
- [ ] The dashboard in Russian shows the Suggested step in Russian, checked in a browser.
- [ ] In the package build's test, `/binnacle:product`'s text and its copy carry the term and the agreement rule.
