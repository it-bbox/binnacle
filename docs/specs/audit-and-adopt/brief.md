# Audit and adopt: what the grilling starts from

Epic 7's scope is `docs/05-mvp-plan.md`, phase 6. This brief holds only the owner's feedback that reached it before its grilling. The grilling decides each question; nothing here is decided.

## The owner's feedback, 2026-09-27

- **Continuing in another harness is not discoverable.** Moving this project's Product session to Codex took five messages with an agent's help, and the owner asked how they would have done it alone, for Codex or for GLM:
  - `binn init` registers the MCP server for a detected harness, but for Codex only in the project's `.codex/config.toml`, which Codex reads in a trusted project alone. The Codex desktop app ships its CLI outside PATH, at `/usr/lib/chatgpt/resources/codex`.
  - Binnacle's skills install into Claude Code alone. Any other harness is left to "read `.claude/skills/binnacle/skills/product/SKILL.md` and follow it".
  - The README has no section on working from another harness. GLM is a model, reached through a harness such as Claude Code or opencode.
- **`binn init` asks too many questions.** Its eight steps confirm each write on its own (`ADR-0026`). The question: one plan shown, one confirmation?
- **Enter means no.** Every question defaults to no, so that a run without a terminal writes nothing (`ADR-0026`). The question: yes by default when stdin is a terminal, and no without one?

The hang the owner also met, init not exiting after its Summary, is a defect rather than a question, and is ticket 01.

## Decided in the grilling, 2026-10-02

The three questions above are answered. `to-spec` writes the spec from these:

- **Surface**: `binn audit`, a CLI command. MCP and the dashboard do not show it in this epic.
- **Target**: any path, the current directory by default. It needs no registration, no daemon and no `.binnacle/project.yaml`: adopting comes before `binn init`.
- **Report**: a list of findings, as text and with `--json`. Each has a check code, the phase 6 area, a status (`ok`, `gap` or `unknown`), the reason and a recommendation. No overall score. What it cannot tell is `unknown`, never guessed.
- **Serena, Graphify, Context7**: read from configuration files only (`.binnacle/project.yaml`, `.mcp.json`, `.codex/config.toml`, `.serena/` and the like). Not found is `unknown`, not `gap`. No other process is run.
- **No network**: Git and tracker are read locally: `git remote`, the tracker type from its URL, whether a token exists in the environment or `~/.binnacle/credentials.json`, never its value. Whether the token works is `unknown`.
- **Exit code**: 0 even when there are gaps. Non-zero only when the audit could not run, for example an unreadable path or no Git repository.
- **Other checks** are file-presence checks and follow the repository's own conventions: tests, CI and structure; `.scratch`; `AGENTS.md` and `CLAUDE.md` read as one set; the Matt Pocock layout under `docs/agents/`; telemetry readiness as the session artifacts Binnacle already reads.
- **Audit and `binn init`** are independent and point at each other: the audit recommends `binn init` for what Binnacle files are missing; init's Summary suggests `binn audit`. The audit writes nothing (ADR-0020); init stays the only writer (ADR-0026).
- **The three feedback items are tickets of this epic**, beside the audit:
  - `binn init` shows one plan and asks once, and Enter accepts it at a terminal (ADR-0034). A run without a terminal writes nothing.
  - Working from another harness: a README section, mirrored in `README.ru.md`, on Codex trusted projects for `.codex/config.toml`, the Codex desktop CLI outside PATH, and GLM being a model reached through a harness. `binn init`'s Summary prints the exact next step for another harness. No new skill format.
- **Verification**: fixture repositories in tests (bare, partly adopted, with `.scratch` not ignored), a test that the audit writes nothing, and a run on this repository. A large third-party repository stays post-v1 (`docs/00-scope.md`).
