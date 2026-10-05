# 10: binn init leaves a layout Binnacle can read

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** two defects found in the exit demonstrations of epics 7 and 9 (2026-10-05).

1. On an empty repository, `binn init` wrote a manifest whose local tracker reads `docs/specs`, but created no `docs/specs/`, and declared no `knowledge.docs`, so the first `/binnacle:product` showed `tracker.issues_missing` and `roadmap.missing` and had no Next action.
2. On an existing repository whose `docs/roadmap.md` is not in Binnacle's format (no `| # | Epic | Status | Spec |` table, no `## Current focus` ending with a `Next action:`), init proposed nothing, and the dashboard showed three attention items.

When they are missing, init's plan proposes the issues directory the manifest names, `knowledge.docs`, and a `docs/roadmap.md` skeleton in Binnacle's format: the table's header with no rows, and a `## Current focus` whose `Next action:` is the planning step, `/grill-with-docs`. An existing roadmap is never rewritten: `binn audit` reports one not in the format as a gap naming what is missing, and init's Summary points to it.

- [ ] On an empty repository, after init's plan is confirmed, `/binnacle:product` shows no `tracker.issues_missing` and no `roadmap.missing`, and its Next action is the skeleton's.
- [ ] An existing roadmap is left byte for byte; `binn audit` reports one not in the format, and init's Summary says so.
- [ ] Tests in `apps/cli/test/init.test.ts` and the audit's tests hold both.

## Comments
