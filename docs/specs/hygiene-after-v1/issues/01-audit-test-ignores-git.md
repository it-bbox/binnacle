# 01: The audit's test ignores Git's own files

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer

**What to build:** the audit's "nothing written" test compares the fixture's working tree only, so that Git's background maintenance writing into `.git` mid-test can no longer fail CI, as it did on `main` at `d032715` (spec, *The audit's test*; product inbox, *A flaky audit test*).

- [ ] The stranded-documents test, and every other audit test that lists the fixture's tree before and after, lists it without `.git`.
- [ ] The test still fails when the audit writes a file in the working tree: checked once by hand, by making the audit write one, and said so in the Review.
- [ ] `pnpm test` passes.
