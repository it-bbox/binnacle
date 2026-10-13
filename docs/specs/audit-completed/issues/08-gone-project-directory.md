# 08: A registration whose directory is gone

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** a registered project whose directory no longer exists stops showing on every page (spec, *A registration whose directory is gone*). The daemon's projection tells such a registration from one whose manifest cannot be read, with its own reason. The dashboard leaves it off the overview, the sidebar and the other pages, and shows it on the projects page as one row with `binn project unregister <path>` to copy. The registry file is never changed by the daemon; a directory that comes back shows as before. The skills and briefs that try the CLI on a throwaway repository say to set a temporary `BINNACLE_HOME`.

- [ ] Through the daemon's HTTP: a registration whose directory is removed reads as gone; one with a broken manifest reads as before; the registry file is unchanged.
- [ ] A directory restored reads as an ordinary project again.
- [ ] Checked in a browser: the gone project is absent from the overview and the sidebar, and the projects page shows its row with the command to copy.
- [ ] The skills and briefs that run the CLI on a throwaway repository name a temporary `BINNACLE_HOME`.
