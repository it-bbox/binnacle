# 07: Live adapter tests — `pnpm test:live`

Status: READY
Triage: ready-for-human
Blocked by: 03, 04
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** a separate suite proves the GitHub and GitLab adapters against real test projects holding fixed issues, so that the real response shapes, pagination, close reasons and authentication errors are checked and not only imitated. Decided in the spec, under *Seam 2* and *Further Notes*.

**Needs the owner first.** A GitHub repository and a GitLab project holding the fixed issues below, and a read-only token for each: a fine-grained token with Issues read access on GitHub, `read_api` on GitLab. An agent can write the suite; its run criteria stay unticked until those exist.

- [ ] The owner has created both test projects with the fixed issues, and recorded their repository paths in this ticket's comments.
- [ ] Fixed issues: an open issue in each listed Task state; an open issue with no header; a closed completed issue; a closed not-planned issue on GitHub; a closed issue whose header disagrees; a `Blocked by:` naming a closed issue and one naming no issue; a `Spec:` as a permalink; on GitHub, a pull request.
- [ ] `pnpm test:live` runs the adapters against both projects with tokens from the environment, asserting the Tasks, states and diagnostics the fixed issues imply, and one authentication failure with a bad token.
- [ ] It skips with a clear message when its tokens are absent. `pnpm test` does not include it and stays offline.
- [ ] It has passed once against both projects, and the result is recorded in this ticket's comments.
