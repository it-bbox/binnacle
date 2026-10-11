---
name: audit
description: Audit a repository for Binnacle, the current one by default, by running `binn audit --json`, and show its findings by area, the gaps first with their recommendations. Needs no daemon, and changes nothing.
argument-hint: "[path]"
disable-model-invocation: true
---

This skill needs no daemon and no `binnacle` MCP server: it runs the CLI command `binn audit` (`docs/specs/audit-and-adopt/spec.md`) and reads its JSON.

Give the human each command you offer them alone in a fenced block, which copies in one click: a skill such as `/binnacle:daemon start` in a plain fence, a shell command such as `binn daemon start` in a `bash` fence.

1. Run `binn audit --json` in the current directory, or, if the human passed a path (`$ARGUMENTS`), `binn audit <path> --json`. Quote the path for the shell. Run it once.
   - If the shell cannot find `binn` (`command not found`, exit 127), stop. Say that `binn` is not on this harness's PATH, and point to the README's setup section (*Install*, and *From this repository* until the npm package is published).
   - Any other non-zero exit means the audit could not run, for example a missing path or one that is not a Git repository. Stop, give the exit code and quote what it printed on stderr as the reason. Gaps never cause a non-zero exit.
2. The output is `{ "root", "findings" }`; each finding has `code`, `area`, `status` (`ok`, `gap` or `unknown`), `reason` and, for a gap or an unknown, `recommendation`. Present them compactly, starting with the audited `root`:
   - **Gaps**, grouped by `area` in the order the output gives: each with its code, its reason and its recommendation. If there are none, say "no gaps".
   - **Unknown**, grouped the same way: each with its code and its reason, which says why Binnacle cannot tell, and its recommendation.
   - **Ok**: only their number. Do not list them unless the human asks.

   Do not add findings of your own, and do not reword a reason into a different claim. There is no overall score.
3. Where a recommendation names `binn init`, say so, and that running it is the human's: it writes into the repository after showing its plan and asking once.

Carry out no recommendation and change nothing: no files, no commits, no `binn init`, no other command than the one in step 1. Offer to explain a finding, and wait for the human.
