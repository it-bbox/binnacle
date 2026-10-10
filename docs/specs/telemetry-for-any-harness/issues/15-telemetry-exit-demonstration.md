# 15: The exit demonstration of epic 10

Status: DONE
Triage: ready-for-human
Blocked by: 01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 16, 17
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** epic 10's exit criterion, demonstrated by the owner on their machine (spec, *Further Notes*).

- [x] `binn init` with one yes configures the export in Claude Code, Codex and Gemini CLI.
- [x] One session in each of Claude Code, Codex, Gemini CLI, opencode, Antigravity, ZCode and pi on one repository appears with its level; one shows as running before its artifact is written, and counts once afterwards.
- [x] A Task taken through a Review and a fix shows implementation, review and rework apart.
- [x] A long Product session raises `context.pressure`.
- [x] The usage page shows Ponytail's before and after.

Gemini CLI and Antigravity are marked not verified, by the owner's decision of 2026-10-08 (spec, *Further Notes*): their sessions are shown if they run, and the demonstration passes without them.

## Comments

- Left to this demonstration by 07 and 08, each in its ticket's *Decisions*:
  - ZCode: that `input_tokens` holds the input written to cache, which the reader subtracts. A call that writes cache shows whether its input is right (08).
  - Antigravity, if it runs: that a conversation lands in its own project, since the reader takes the first `file://` URI of its summary rather than a numbered field (07, with its script).

### Demonstrated on 2026-10-08

On the owner's machine, on this repository, with the owner:

- **`binn init`**, one yes, merged the export into `~/.claude/settings.json`, `~/.codex/config.toml` and `~/.gemini/settings.json`, each checked. Its skills step failed for Matt Pocock Skills and Ponytail and left them in Claude Code twice: epic 14's ticket 10.
- **Claude Code**: level 4; its session ran as `claude-code:otel:…` before its file was read; afterwards 3 calls, 706 output tokens: the file's 2 calls matched by request id, and one Haiku call only the export carried.
- **Codex**, run as `codex --no-daemon`, since the CLI linked from the ChatGPT app (0.162.0-alpha.2) refuses to start without it: level 4; running from its events, then 6 calls, 470 output tokens, its rollout's 5 matched by time and one call only the export carried. A second session's 2 events, with no rollout, stay in no project, as designed.
- **opencode**, first read on a real install: level 3; provider `opencode` and model apart; its 2 finished steps, with reasoning added to output; an aborted call with no step counts nothing.
- **ZCode**: level 3; 5 calls of `GLM-5.3` from `account:zai-individual-coding-plan`, input less cache read per call. Every row has `cacheWriteTokens: 0`, as the GLM coding plan reports no cache writes, so 08's assumption on cache writes stays unconfirmed: it holds exactly for this provider, and a provider that reports cache writes would confirm it.
- **pi**: level 3; 4 calls, an errored one with null counts and the total `partial`, the rest matching its file.
- **Gemini CLI** and **Antigravity**: skipped, not verified, as decided; 07's question on Antigravity's `file://` stays open with them.
- **Review and rework**: not shown. Every Task of this epic had no review run and almost no rework, since its session committed its fixes before its Review. The owner kept the roles and changed the per-ticket order (spec, *Further Notes*): ticket 17, run in that order, shows them.
- **`context.pressure`**: raised by this Product session, 246 714 tokens of context against 150 000.
- **Ponytail**: the usage page shows after, 49 765 output tokens per Task over 88 Tasks, and for before the reason: no Task with runs was completed before 2026-09-19, so this repository can never show both. Counted as shown, by the owner's decision.
- Not shown: that Claude Code's and Codex's desktop apps export too (spec, *Further Notes*), since no desktop session started after `binn init`.

### Demonstrated on 2026-10-10

- **Review and rework**: shown on the dashboard's page for epic 10's 17, which committed its Review before its fixes. Usage by role, apart: implementation 18 records and 8 767 output tokens, review 20 and 8 246, rework 18 and 12 468, as `task_get` reads them. Every criterion now holds, Gemini CLI and Antigravity left not verified as decided.
