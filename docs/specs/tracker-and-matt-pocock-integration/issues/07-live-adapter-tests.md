# 07: Live adapter tests — `pnpm test:live`

Status: DONE
Triage: ready-for-human
Blocked by: 03, 04
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** a separate suite proves the GitHub and GitLab adapters against real test projects holding fixed issues, so that the real response shapes, pagination, close reasons and authentication errors are checked and not only imitated. Decided in the spec, under *Seam 2* and *Further Notes*.

**Needs the owner first.** A GitHub repository and a GitLab project holding the fixed issues below, and a read-only token for each: a fine-grained token with Issues read access on GitHub, `read_api` on GitLab. An agent can write the suite; its run criteria stay unticked until those exist.

- [x] The owner has created both test projects with the fixed issues, and recorded their repository paths in this ticket's comments.
- [x] Fixed issues: an open issue in each listed Task state; an open issue with no header; a closed completed issue; a closed not-planned issue on GitHub; a closed issue whose header disagrees; a `Blocked by:` naming a closed issue and one naming no issue; a `Spec:` as a permalink; on GitHub, a pull request.
- [x] `pnpm test:live` runs the adapters against both projects with tokens from the environment, asserting the Tasks, states and diagnostics the fixed issues imply, and one authentication failure with a bad token.
- [x] It skips with a clear message when its tokens are absent. `pnpm test` does not include it and stays offline.
- [x] It has passed once against both projects, and the result is recorded in this ticket's comments.

## Comments

- **The test projects.** The owner created both, private, each holding issues #1 to #16 in the same order:
  - GitHub `it-bbox/binnacle-tracker-fixture`, where #17 is an open pull request;
  - GitLab `miker059/binnacle-tracker-fixture`.

  The issues are:
  - #1 to #8: open, one for each open Task state from `BACKLOG` to `MERGED`. #2 also carries `Blocked by: None`, `Spec: docs/specs/demo/spec.md` and the `ready-for-agent` label.
  - #9: open, no header, labelled `needs-triage`.
  - #10: open, with `Status: DONE`.
  - #11: closed with `Status: DONE`, as completed on GitHub.
  - #12: closed with `Status: CANCELLED`, as not planned on GitHub.
  - #13: closed with `Status: ACTIVE`, as completed on GitHub.
  - #14: `READY`, `Blocked by: #11`.
  - #15: `READY`, `Blocked by: #999`.
  - #16: `READY`, with `Spec:` a commit-pinned permalink to `docs/specs/demo/spec.md` in that repository.
- **What changed.**
  - `pnpm test:live` runs `{apps,packages}/*/test/**/*.live.ts`, which today is only `packages/adapters/test/remote-tracker.live.ts`. `pnpm test` matches only `*.test.ts`, so it stays offline.
  - `readGitHubTasks` and `readGitLabTasks` take an optional fourth argument, `perPage`, which defaults to 100. The daemon never passes it. The live suite reads five a page, so that it follows the real `Link` headers through four pages.
- **What the suite checks, per forge.**
  - **Tasks.** #1 to #16 are read as Tasks with the states their headers and closing imply, and GitHub's #17 is not one of them. #2's spec, slug and triage label are read, as is #16's permalink slug. #14 has no unmet dependency, because #11 is closed. #15's dependency is `task.dangling_dependency`.
  - **Diagnostics.** They are exactly three: `task.unknown_state` for #9, and `tracker.state_mismatch` for #10 and #13.
  - **Pagination.** Five issues a page gives the same reading.
  - **Bad token.** It is `tracker.unauthorized`, `(401); a token was used`, and the message holds no token.
  - **Close reasons, on GitHub only.** The issues it closed report `state_reason` `completed`, `not_planned` and `completed`.
- **Tokens.** Tokens come from `BINNACLE_GITHUB_TOKEN` and `BINNACLE_GITLAB_TOKEN`. A forge whose variable is unset or empty is skipped, and the skip names the variable and the repository. To run the suite with the tokens `binn` already uses, putting them in the command's environment only:
  ```sh
  BINNACLE_GITHUB_TOKEN=$(node -p 'require(require("os").homedir()+"/.binnacle/credentials.json")["github.com"]') \
  BINNACLE_GITLAB_TOKEN=$(node -p 'require(require("os").homedir()+"/.binnacle/credentials.json")["gitlab.com"]') \
  pnpm test:live
  ```
- **Result.** On 2026-09-25 the suite passed against both projects, 7 of 7:
  - GitHub, 4 tests: Tasks and diagnostics, pagination, close reasons and the bad token.
  - GitLab, 3 tests: the same without close reasons.
  - With neither variable set, both suites were skipped with their message.
- **Found live.** GitLab.com now answers an issue's `web_url` as `…/-/work_items/<n>`, not `…/-/issues/<n>`. The adapter passes it through as the Task's `ticket`, and nothing in the code parses it, so nothing else needed to change. The suite accepts both forms. The offline GitLab stand-in still serves `/-/issues/`, which the adapter handles the same way.
- **For ticket 12.** Point its scratch project at `it-bbox/binnacle-tracker-fixture`. #2 is the natural `/binnacle:task` subject, because it has a spec, a triage label and no blocker.
- **Question answered in the smallest way the spec allows.** *How can the fixtures show that the close reason was read, when every closed issue's `Status:` agrees with how it was closed?* The fixed issues are the owner's, and the tokens are read-only. So the suite checks GitHub's own `state_reason` on the closed issues, and the offline suite already checks how the adapter maps it. If the owner wants the Tasks themselves to show it, a closed-as-not-planned issue with no header would be read as `CANCELLED` only through its close reason. That issue would be #18 on GitHub.

- **Issue #18, decided by the owner on 2026-09-25: not added.** The suite already checks GitHub's `state_reason` on the three closed fixtures directly, and the close-state rule is covered offline; #18 would repeat that check at the cost of a write token and another test change.

### Review

`/code-review` ran against `main` on both axes.

**Standards: no hard violations, and six judgement calls.**

1. The forge constants were exported only so the test could reach them. **Fixed**: they are private again. The adapters take `perPage` instead.
2. Duplicated Code: the test rebuilt the adapters' first-page URLs to read five a page, so it could drift from what the adapters request. **Fixed** by `perPage`: the paged read uses the adapters' own URL.
3. Data Clumps: each project repeats its repository path in its regexes. **Kept**: literal patterns read plainly, and they are written once.
4. Mysterious Name: `variable`. **Fixed**: it is now `tokenVariable`.
5. The pagination test reads the whole list a second time. **Kept**: each test stands alone, and the cost is one request per forge.
6. `STATES` maps by index to issue numbers. **Kept**: a comment says so, and the fixture is fixed.

**Spec: every criterion is met, with two weak points.**

1. Close reasons were not really proved, because each closed fixture's `Status:` gives the same state without one. **Fixed** on GitHub by checking its `state_reason` directly. The stronger fixture is described above, for the owner.
2. The pagination test would pass if both reads failed the same way. **Fixed**: it also checks that the paged read found all sixteen Tasks.
3. The ticket was not updated yet. **Fixed** in this ticket's last commits.

