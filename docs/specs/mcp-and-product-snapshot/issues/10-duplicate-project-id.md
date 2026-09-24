# 10: A second project with the same id registers silently

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

Found by ticket 08's hand check: a clone of this repository, registered beside it, kept the manifest id `binnacle`, and `binn project register` accepted it with no word. Two registered projects then share one id, and anything that names a project by id is ambiguous.

**What to build:** registration warns, and does not refuse. The registry stays keyed by path; a clone or a second checkout of the same repository is a legitimate thing to register.

- [ ] `project.register` returns a warning naming the other registered path when the manifest id is already used by another registered project, and registers anyway.
- [ ] `binn project register` prints that warning to stderr, as it prints manifest warnings.
- [ ] Registering the same path again raises no such warning.
- [ ] Tested through the daemon seam.

## Comments
