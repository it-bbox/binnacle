# 05: A spec no roadmap row links is an attention item

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/starting-a-project/spec.md`

**What to build:** a spec the roadmap forgot is noticed (spec, *A spec no roadmap row links to*). A `spec.md` under the tracker's specs directory that no roadmap row's Spec cell links is the attention item `roadmap.spec_unlisted`, naming the spec. The check is deterministic and read where `roadmap.spec_missing` is. Blocked by 01 only because both change the roadmap's module.

- [x] Through `project.snapshot`'s attention: a spec no row links is reported with its path.
- [x] Every spec linked: nothing reported; on this repository, no such item.
- [x] A row linking a missing spec is still `roadmap.spec_missing`.

## Comments

- Where the spec is silent: "the tracker's specs directory" is read as `knowledge.specs`, since specs live in Git whatever the tracker (ADR-0017) and `binn init` declares it as the local tracker's issues directory; a project that declares none is not checked. "A row linking a missing spec" is read as the existing item, a row at `spec` or later whose Spec cell is `—`, which keeps its code; a link to a `spec.md` that is not there gets no new item.
- On this repository, a snapshot through a temporary daemon reports no attention at all.

### Review

Against `main`, on the standards and the spec; the ticket names no role beyond the Developer and the Reviewer.

1. **Specs were read from `tracker.local.issues`**, so a GitHub or GitLab project was never checked, though ADR-0017 keeps specs in Git whatever the tracker. **Fixed**: `readSpecs` in `apps/daemon/src/snapshot.ts` reads `knowledge.specs`; the test declares it.
2. **`roadmapAttention`'s `specs` had a default** only an old test relied on. **Fixed**: required, and the core test passes `[]`.
3. A link to a `spec.md` that is not there is reported by nothing. **Kept**: "still `roadmap.spec_missing`" names the existing item, which `docs/roadmap.md` defines as a `—` Spec cell.
4. The check runs only when the Tasks were read. **Kept**: read where `roadmap.spec_missing` is, as the spec says.
5. `{ slug, path }` is written twice, unnamed. **Kept**: one producer and one reader; name it when a third appears.
6. `readSpecs` lists a directory as `readLocalTasks` does. **Kept**: a different directory and one line.
7. "On this repository, no such item" is not pinned by a test. **Kept**: checked by a snapshot of this repository; a test would break on every new spec until its row lands.
