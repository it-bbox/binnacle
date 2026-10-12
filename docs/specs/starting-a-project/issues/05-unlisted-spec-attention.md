# 05: A spec no roadmap row links is an attention item

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** a spec the roadmap forgot is noticed (spec, *A spec no roadmap row links to*). A `spec.md` under the tracker's specs directory that no roadmap row's Spec cell links is the attention item `roadmap.spec_unlisted`, naming the spec. The check is deterministic and read where `roadmap.spec_missing` is. Blocked by 01 only because both change the roadmap's module.

- [ ] Through `project.snapshot`'s attention: a spec no row links is reported with its path.
- [ ] Every spec linked: nothing reported; on this repository, no such item.
- [ ] A row linking a missing spec is still `roadmap.spec_missing`.
