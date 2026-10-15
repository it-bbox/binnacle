# 08: A registration whose directory is gone

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** a registered project whose directory no longer exists stops showing on every page (spec, *A registration whose directory is gone*). The daemon's projection tells such a registration from one whose manifest cannot be read, with its own reason. The dashboard leaves it off the overview, the sidebar and the other pages, and shows it on the projects page as one row with `binn project unregister <path>` to copy. The registry file is never changed by the daemon; a directory that comes back shows as before. The skills and briefs that try the CLI on a throwaway repository say to set a temporary `BINNACLE_HOME`.

- [x] Through the daemon's HTTP: a registration whose directory is removed reads as gone; one with a broken manifest reads as before; the registry file is unchanged.
- [x] A directory restored reads as an ordinary project again.
- [x] Checked in a browser: the gone project is absent from the overview and the sidebar, and the projects page shows its row with the command to copy.
- [x] The skills and briefs that run the CLI on a throwaway repository name a temporary `BINNACLE_HOME`.

## Comments

- Decisions where the ticket is silent: the projection's row carries `gone`, true when the registered directory does not exist (`project.path_not_found` from the manifest read), and keeps `unavailable` with its reason, `No directory at <path>.`; a manifest that cannot be read is `gone: false`, as before. The column needed the store's schema version bumped to 2, so the `project` table is dropped and re-derived from the registry on the first start, with `store.rebuilt` in the history, as ADR-0015 has it. The CLI and MCP keep showing such a project with its reason; only the dashboard leaves it off. The copied command always single-quotes the path for a POSIX shell, as the CLI's own `shellQuote` does.
- The dashboard: the rail, the sidebar, the selection and the Attention page read only the projects whose directory is there; an address naming a gone project moves to the first present one, or drops its `project` when none is left. Projects lists the gone one as a row, its name unlinked, with `binn project unregister '<path>'` to copy.
- The skills: the autopilot brief already set a temporary `BINNACLE_HOME`; `/binnacle:task run` now says the same for a session started by hand, where in the worktree to keep it, and to start its daemon with `BINNACLE_PORT=0`. No other skill tries the CLI on a throwaway repository.
- Checked in a browser on 2026-10-15, against a temporary daemon generated from this branch, with one project present and one whose directory was moved away: the rail and the sidebar show only the present one, Attention lists only it, an address naming the gone one moves to it, and Projects shows the gone row with its command. Moved back, the directory shows as an ordinary project again; with every project gone, the Overview says none is registered and Projects keeps the row. To repeat it: register two projects with a temporary `BINNACLE_HOME`, move one's directory away, `pnpm dashboard:generate`, open `binn dashboard`.
- For the Product session: the product-inbox entry on the scratchpad registration (`docs/product-inbox.md`) is closed by this ticket.

### Review

Against `main`, in a sub-agent, on the standards and the spec. Typecheck (root and the dashboard's `nuxt typecheck`) and the full suite pass (854 tests); criteria 1 and 2 are pinned through the daemon's HTTP in `apps/daemon/test/projects.test.ts`, criterion 4 in `apps/cli/test/pack.test.ts`, criterion 3 in a browser. Standards: no finding.

1. **With every project gone, an address naming one kept it selected**: the sidebar printed its path and the Overview polled `task.list` on it. **Fixed**: `apps/dashboard/app/app.vue` drops `project` from the address when no present project is left.
2. **The shell's sentence on the selected project** could read as falling back to a gone one. **Fixed** in `docs/04-telemetry-dashboard.md`.
3. **The task skill's sentence did not say where the temporary home lives**, the collision `dashboard-design-and-languages/12` fixed for autopilot. **Fixed**: inside the worktree in a directory Git ignores, never a shared scratchpad, its address from `binn daemon status`; `pack.test.ts` pins it.
4. The copied command's single quotes do not suit Windows cmd. **Kept**: the CLI's `shellQuote` follows the same convention, and PowerShell takes them.
5. With every project gone, the Overview says no project is registered while Projects lists the gone one. **Kept**: it reads as nothing to work on, and Projects carries the command.
