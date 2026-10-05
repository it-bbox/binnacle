# 16: Serena is registered with Codex in Codex's context

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** a defect found in epic 8's exit demonstration (2026-10-05). `binn init` registers Serena with Codex as `serena start-mcp-server --context=claude-code --project-from-cwd`: Claude Code's context, in Codex. Register it with the context Serena documents for Codex (check Serena's documentation through Context7). An entry init itself wrote with the wrong context is corrected by the plan; one the owner wrote is left alone and named in the Summary.

- [ ] Init's plan registers Serena with Codex in Serena's Codex context.
- [ ] An existing Codex entry with `--context=claude-code` is proposed for correction in the plan, and changed only on the owner's yes.
- [ ] A test in `apps/cli/test/init.test.ts`, with a fake `codex` on PATH, holds the command run.

## Comments
