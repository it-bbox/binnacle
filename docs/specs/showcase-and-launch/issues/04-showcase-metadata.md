# 04: The identity strings: description, topics, npm keywords

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** the short strings by which Binnacle is found — the GitHub description and topics as ready strings for the owner to apply, and the npm package's keywords and description in its manifest.

- [x] A one-line GitHub description and a set of topics are written as ready strings, for the owner to apply in the GitHub settings.
- [x] The npm package's manifest carries a non-empty keyword list and a description that matches the repository's.
- [x] A check verifies the keywords and the description are present in the published manifest.

## Comments

### Review

Reviewed the branch against `main` on 2026-10-31, in a sub-agent separate from the implementation, on two axes: the project's standards and the ticket's spec.

Fixed:
- The description said "AI engineering control plane" in lower case. `CONTEXT.md` declares *AI Engineering Control Plane* the canonical form used in public positioning, and both READMEs write it capitalized; the identity file and `apps/cli/src/manifest.ts` now match.

Kept:
- The test does not tie the identity strings to the README's wording. A paraphrase and its translation are not machine-checkable, and the ticket asks for the strings and their consistency with each other, not a copy of the README.
- `tarball.live.ts` compares the installed manifest with the same `publishManifest`, so alone it would not catch a removed field. `manifest.test.ts` closes that by comparing `publishManifest` with `docs/showcase/identity.md`, and the `tarball-live` CI job holds the installed artifact to it.

### Notes for the next tickets

- Ticket 06 (listings) and ticket 07 (checklist): the ready strings are in `docs/showcase/identity.md` — the one-line description and the 12 topics, the same list the npm package carries as `keywords`. The owner applies the description and topics in the GitHub settings.
- The npm description is the same line as the GitHub description; changing one means changing the other in `docs/showcase/identity.md` and `apps/cli/src/manifest.ts`, or `apps/cli/test/manifest.test.ts` fails.
- The npm keywords reach the package page only when the owner publishes a release; epic 24 releases nothing, so they appear with the next release the owner cuts.
