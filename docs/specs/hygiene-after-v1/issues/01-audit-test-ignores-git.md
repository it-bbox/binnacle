# 01: The audit's test ignores Git's own files

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer

**What to build:** the audit's "nothing written" test compares the fixture's working tree only, so that Git's background maintenance writing into `.git` mid-test can no longer fail CI, as it did on `main` at `d032715` (spec, *The audit's test*; product inbox, *A flaky audit test*).

- [x] The stranded-documents test, and every other audit test that lists the fixture's tree before and after, lists it without `.git`.
- [x] The test still fails when the audit writes a file in the working tree: checked once by hand, by making the audit write one, and said so in the Review.
- [x] `pnpm test` passes.

## Comments

### Decisions

- The filter sits in the one shared helper, `listing()` in `apps/cli/test/audit.test.ts`, which all three tree comparisons call: "writes nothing", "does not run what it finds" and the stranded-documents test. It drops every entry named `.git`, at any depth: a nested repository's `.git` is Git's too.
- No other test file was touched: `apps/daemon/test/write-guarantee.test.ts` is not an audit test.

### Review

On the project's standards and the ticket's spec, in a sub-agent. The typecheck and the full suite (896 tests) pass.

- Checked by hand: with `binn audit` made to write `AUDIT-WROTE` at the repository's root, both "writes nothing" and the stranded-documents test failed, naming the file; with the same write inside `.git`, both passed. The change was reverted.
- Kept: the filter hides `.git` at any depth, not only at the root; no fixture has a nested repository, and one would see Git's maintenance too.
- Kept: the tests no longer catch the audit writing inside `.git` (its config or hooks); the spec compares the working tree only.
