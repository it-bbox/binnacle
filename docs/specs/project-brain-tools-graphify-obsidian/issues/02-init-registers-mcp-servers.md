# 02: `binn init` registers Serena, Context7 and Graphify with every harness

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/project-brain-tools-graphify-obsidian/spec.md`

**What to build:** each MCP server of the Standard setup registered with every harness init detected, through the harness's own CLI, at user scope (the owner, 2026-10-02), as the `binnacle` plugin already is. Graphify's server serves one project's graph, so it is registered at the harness's per-project scope outside the repository where one exists (Claude Code's local scope), and printed otherwise. A harness with no CLI for adding a server gets the entry printed. A server already registered with a harness, in any scope the audit reads, is reported and left as it is. Init writes no MCP entry for these tools into the repository. The registrations are rows of the tool table from ticket 01, in the same plan, after the installs. Take the exact `mcp add` forms from each harness's current docs through Context7.

- [ ] For each detected harness with an `mcp add` CLI, the plan shows the command per missing server, and after a yes the fake harness CLI records it at user scope.
- [ ] Graphify's server is registered at Claude Code's local scope, pointing at this project's graph, and printed for a harness without a per-project scope.
- [ ] A server already registered is reported and not registered again.
- [ ] A harness without such a CLI gets the entry printed, and the Summary says so.
- [ ] A tool declared `false`, or left out for a missing prerequisite, gets no registration.
- [ ] No file in the repository is created or changed by this step.
- [ ] `docs/operations/05-installation-checklist.md` says where init registers the servers.

## Comments
