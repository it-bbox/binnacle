---
name: checkpoint
description: Close or rotate a Product session. Draft the durable decisions it made into this project's canonical sources, then write and commit them once the human confirms, and record the checkpoint with Binnacle.
disable-model-invocation: true
---

This session is disposable. Whatever it decided that the next session needs must reach the repository before it closes (`docs/workflow/01-product-workflow.md`). Binnacle writes no file (ADR-0020). This session writes and commits them, and only what the human confirms.

1. Call the `binnacle` MCP server's `project_detect` tool. If this session has no `binnacle` MCP tools, run each Binnacle tool this skill calls as `binn call <tool> '<arguments as one JSON object>'` in the shell instead, with the same arguments, and read the JSON it prints: what the tool returns, or the same error with its code. If it fails, stop. Quote the error's code and message, and give the human the fix without running it yourself:
   - `daemon.unreachable`: `/binnacle:daemon start`, or `binn daemon start` at a terminal.
   - `project.not_registered`: `/binnacle:register`, or `binn project register` run in the main checkout.
   - If the shell cannot find `binn` (`command not found`, exit 127), `binn` is not on this harness's PATH (see the README's setup section).

   Binnacle is optional. Until it answers, the decisions still belong in the project's context file, ADRs, tickets, specs and roadmap: offer to draft, confirm and commit them as in steps 3 to 5, and skip step 6.
2. Call `checkpoint_prepare`, with no arguments. It records nothing. It returns the delta since the last checkpoint (the same fields as `daily_get`), `targets` and `attention`.
3. Draft the promotions. Look at this session's conversation and at the delta, and find each durable decision that no canonical source holds yet. Leave out what is already written down, and anything that is not a decision. Classify each decision under one of the five `targets`, and write it into that target's path:
   - `vocabulary`: a domain term, which goes into the context file;
   - `trade_off`: a durable architectural trade-off, which gets a new ADR in the ADR directory;
   - `new_work`: a ticket in the tracker's issues directory, following the format of the tickets already there;
   - `product_rule`: a change to a spec in the specs directory;
   - `position`: the roadmap, meaning its status column and `## Current focus`.

   If a target's `path` is null, this project has no file for it. Show the decision anyway, and say that it cannot be written here.

   Also draft a fix for each attention item that the canonical sources can resolve, such as a `roadmap.status_mismatch`.

   When `attention` holds `next_action.stale` or `next_action.missing`, draft the roadmap's `Next action:` paragraph as a `position` item: the paragraph that ends its current focus, starting with `Next action:` and ending with exactly one command in backticks, the one the human types for the next step, with the text you propose in full. Like every draft, it is written only once the human says yes (step 4).
4. Show every draft, each with its type, its file and the exact text to add or change, and the branch the commit would land on. Then stop and wait for the human. Nothing is written until they confirm. They may edit, drop or add items. If they cancel, stop there and record nothing. If there is nothing to promote, say so and ask whether to record an empty checkpoint.
5. Write the confirmed items with your own file tools. Then commit only those files (`git add -- <paths>`), on the current branch. Follow `AGENTS.md` for commit messages and authorship. Do not push, merge or switch branches.
6. Call `checkpoint_record`, from this same checkout and after the commit, with `promoted` set to one `{ "type", "path" }` per committed item. The path is relative to the project directory. Pass `[]` if nothing was promoted. It records this checkout's HEAD as the next checkpoint's baseline.
7. Report the recorded `head` and the promoted items. If `diagnostics` is not empty, show each one (`checkpoint.uncommitted`, `checkpoint.path_missing`), and do not call the checkpoint clean. Suggest committing or fixing the path and running `/binnacle:checkpoint` again. Do not do either without being asked.
