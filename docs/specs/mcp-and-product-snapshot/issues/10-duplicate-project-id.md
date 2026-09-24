# 10: A second project with the same id registers silently

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

Found by ticket 08's hand check: a clone of this repository, registered beside it, kept the manifest id `binnacle`, and `binn project register` accepted it with no word. Two registered projects then share one id, and anything that names a project by id is ambiguous.

**What to build:** registration warns, and does not refuse. The registry stays keyed by path; a clone or a second checkout of the same repository is a legitimate thing to register.

- [x] `project.register` returns a warning naming the other registered path when the manifest id is already used by another registered project, and registers anyway.
- [x] `binn project register` prints that warning to stderr, as it prints manifest warnings.
- [x] Registering the same path again raises no such warning.
- [x] Tested through the daemon seam.

## Comments

- **What exists.** `project.register` re-derives the registry after registering, as `project.list` does, and adds one warning per other registered path whose manifest holds the same id: `{ path: 'project.id', message: '"<id>" is also the id of the project registered at <other path>.' }`, in the same `warnings` array as the manifest's own. `binn project register` already printed every warning to stderr as `binn: <path>: <message>`, so the CLI needed no change; `apps/cli/test/project.test.ts` pins it. The code is in `apps/daemon/src/operations.ts`.
- **"The same path again", read narrowly.** Registering a path never warns about itself. Registering it again while another path really does share its id still warns about that other path, because warnings are computed on every call, like the manifest's, and the ambiguity is still there. A project whose manifest cannot be read has a null id and matches nothing.
- **Side effect, kept.** Because the registry is re-derived, a register records `project.manifest_changed` for any other project whose manifest changed since it was last read, exactly as a `project.list` would.

### Review

`/code-review` ran against `main` on both axes.

**Standards: no hard violations in the code.** The one hard finding was the ticket still `READY`, which the last commit fixes. Judgement calls:

1. Re-projecting the other entries by hand duplicated `projectRegistry`. **Fixed**: it calls `projectRegistry` and filters `store.projects()`, which also drops rows for entries no longer in the registry.
2. Re-deriving the registry records events for other projects. **Fixed**: said in the code comment and above.
3. The `row.id !== null` guard sits inside the filter. **Left**: the registry is re-derived either way, and the check costs nothing.
4. A registry-level fact travels as a `ManifestProblem`. **Kept**: `project.id` is a real manifest field, and the ticket asks for it to print as manifest warnings do.
5. `warnings.push` mutates the array `readManifest` returned. **Kept**: it is a fresh array on every call.
6. The CLI test relies on `root` being registered by an earlier subtest. **Left**: the file's existing pattern.

**Spec: every acceptance criterion implemented.** Findings:

1. Re-registering a path while another shares its id was untested. **Fixed**: a daemon test registers A, B, then A, and expects a warning naming B and not A.
2. Nothing out of scope.
