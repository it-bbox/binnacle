# 09: The skills build reads a Windows checkout

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** `pnpm install` works in a Windows checkout, so that ticket 07's live test runs on the Windows runner (spec, *CI*). On `windows-latest` Git checks files out with CRLF, and the CLI package's `prepare` (`apps/cli/src/prepare.ts`) refuses every `SKILL.md`, whose frontmatter it expects to open with `---\n`: `answer/SKILL.md: no frontmatter between two --- lines` (`main`'s CI at `e1916be`, job `autostart-live (windows-latest)`). The build reads a skill whether its lines end in LF or CRLF, and what it writes is the same either way; or the repository fixes its line endings, whichever is smaller and holds for a user cloning on Windows too.

- [ ] The package build's test builds the skills from a `SKILL.md` with CRLF line endings, and the output equals the LF one's.
- [ ] `main`'s CI after the merge: `autostart-live (windows-latest)` gets past `pnpm install` and runs the live test; ticket 07's Windows diagnostics are recorded in ticket 07.
