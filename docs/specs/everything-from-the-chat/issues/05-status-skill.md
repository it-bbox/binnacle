# 05: /binnacle:status

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** the baseline's `/status`, as `/binnacle:status`, over the existing `project_status` tool. It gives the project, the manifest's tracker, this session's checkout (registered, or a linked worktree, said plainly), its branch, commit and dirty state, and the diagnostics. On `daemon.unreachable` or `project.not_registered` it names `/binnacle:daemon start` or `/binnacle:register`. It stays short: the roadmap, Tasks and usage are `/binnacle:product`'s. No new tool and no new daemon operation.

- [ ] The skill exists in the `binnacle` plugin with `disable-model-invocation: true`, and calls `project_status` and nothing else.
- [ ] A test in `apps/cli/test/pack.test.ts` holds its wording: the linked-worktree line, the diagnostics, and the two fixes.
- [ ] The plugin's description and `docs/03-mcp-and-skills.md` name `/binnacle:status`.

## Comments
