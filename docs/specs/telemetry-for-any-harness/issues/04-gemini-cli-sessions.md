# 04: Gemini CLI's sessions read from its files

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/telemetry-for-any-harness/spec.md`

**What to build:** a reader for Gemini CLI's local session files, a pure function as the Claude Code and Codex readers are, gives a record per model call with its metadata and counts, nulls for counts it lacks, and the reason where a file cannot be read (spec, *New artifact readers*). The daemon finds a project's Gemini CLI sessions and ingests them, so history from before the export counts, and Gemini CLI's support level follows from them.

- [ ] Reader tests over a sample file: records, nulls, and the reason for an unreadable line.
- [ ] Daemon process test: a project's Gemini CLI sessions appear in `usage.get` and its level is 3.

## Comments
