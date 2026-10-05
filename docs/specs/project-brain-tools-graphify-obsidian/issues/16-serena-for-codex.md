# 16: Serena is registered with Codex in Codex's context

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** a defect found in epic 8's exit demonstration (2026-10-05). `binn init` registers Serena with Codex as `serena start-mcp-server --context=claude-code --project-from-cwd`: Claude Code's context, in Codex. Register it with the context Serena documents for Codex (check Serena's documentation through Context7). An entry init itself wrote with the wrong context is corrected by the plan; one the owner wrote is left alone and named in the Summary.

- [x] Init's plan registers Serena with Codex in Serena's Codex context.
- [x] An existing Codex entry with `--context=claude-code` is proposed for correction in the plan, and changed only on the owner's yes.
- [x] A test in `apps/cli/test/init.test.ts`, with a fake `codex` on PATH, holds the command run.

## Comments

- **Init already registered Serena with Codex's context.** Serena's docs (Context7, `oraios/serena`: `client_setup.py` and `docs/02-usage/030_clients.md`) give Codex `--context=codex --project-from-cwd`, through `codex mcp add serena -- ...`, and `SERENA_CONTEXT` in `apps/cli/src/tools.ts` had held that since ticket 02, with a test. The owner's `--context=claude-code` entry in `~/.codex/config.toml` was then left alone as already registered. What was missing was its correction.
- **Init-written or the owner's.** Init cannot tell who wrote an entry, so it goes by where: Codex's user file is where init's `codex mcp add` writes, so an entry there with Claude Code's context is proposed for correction; the repository's `.codex/config.toml` init never writes a server into, so an entry there is the owner's, left alone, and the Summary's `found` line names its Claude Code context. The criterion's "changed only on the owner's yes" guards an owner-written user entry.
- **The correction is the same command.** `codex mcp add` writes over an entry of the same name (checked with codex-cli 0.160.0 against a scratch `CODEX_HOME`), so the plan shows `codex mcp add serena -- serena start-mcp-server --context=codex --project-from-cwd` and no `remove`.
- **Read textually.** Both `"--context=claude-code"` and `"--context", "claude-code"` in the `[mcp_servers.serena]` table count; an inline `serena = { ... }` entry is not read (a `ponytail:` comment).

### Review

Code review against `main`, both axes, with its sub-agents.

- **Fixed.** The user file was told from the repository's by an absolute path, so a relative `CODEX_HOME` made init read a missing file and throw; it is now compared with the user files the audit reads.
- **Fixed.** With Codex detected only by its directory, init said the plan registers Serena again, then that `codex` is not on PATH; it now says the plan does so only when it does.
- **Fixed.** The `ponytail:` comment names its upgrade path, a TOML parser.
- **Kept.** The one exception, Codex and Serena, sits in `serversStep` rather than in the harness or tool tables: one case, no table column for it.
- **Kept.** The section regex ends at the next line starting with `[`, so a sub-table written before `args` would hide it; `codex mcp add` writes `args` first.
- **Left.** When the repository's file also registers Serena, the user file's entry is not examined: `registeredWith` stops at the first file, and Codex reads the project's entry over the user's.

### Hand check (optional, the owner's)

The tests hold every criterion with a fake `codex`. To see it on this machine, where `~/.codex/config.toml` starts Serena with `--context=claude-code`: after the merge, run `binn init` in this repository, check that the plan shows `codex mcp add serena -- serena start-mcp-server --context=codex --project-from-cwd` with the line saying it is registered with Claude Code's context, and answer as you like; on a yes, `grep -A3 'mcp_servers.serena' ~/.codex/config.toml` shows `--context=codex`.
