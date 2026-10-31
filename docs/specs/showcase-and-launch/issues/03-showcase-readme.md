# 03: The README storefront

Status: DONE
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** a README and its Russian twin that show Binnacle in seconds: the demo and the screenshots, the install path first, the requirements up front, one sentence on why not Docker, and pointers to the container guide, the mod and the site.

- [x] The demo GIF and the screenshots are embedded, and the install path — `binn init`, then everything from the agent's skills — comes before any reference to `docs/`.
- [x] The requirements come first: Node 24 LTS, and the loopback port, `127.0.0.1:7717` by default, changed with `BINNACLE_PORT`.
- [x] One sentence says why not Docker, in both languages.
- [x] The README points to the container guide, the Claude Code mod and the site.
- [x] The autostart service's behaviour with a non-default `BINNACLE_PORT` is checked, so the README's port statement is true; a defect is reported, not fixed here.
- [x] The Russian twin matches, linked both ways, and the user-guides test passes.

## Comments

### `BINNACLE_PORT` check

Checked on 2026-10-31 on a throwaway `BINNACLE_HOME` inside the worktree, with `BINNACLE_PORT=7799` and a fake `systemctl` on `PATH`, so the owner's daemon and its autostart entry were not touched.

- With autostart off, a daemon started by `binn daemon start` answered on `http://127.0.0.1:7799`: `BINNACLE_PORT` is honoured there, and the README says so.
- The autostart unit carries `BINNACLE_HOME` and `PATH` only; `BINNACLE_PORT` is absent from its `Environment=` lines.

**Defect, reported and not fixed here:** with autostart on, `binn daemon start` starts the daemon through the service manager (`apps/cli/src/daemon-commands.ts`, `start`), and the service always binds the default `7717`, so `BINNACLE_PORT` is ignored. `binn init` turns autostart on by default, so this is the common path. The same limitation already applies to `BINNACLE_GITHUB_TOKEN`, `BINNACLE_GITLAB_TOKEN` and `BINNACLE_GIT_TIMEOUT_MS` (`docs/operations/05-installation-checklist.md`, *Environment variables*). A fix is a ticket of its own, outside epic 24; the README states the port truthfully as "with autostart off".

### Review

Reviewed the branch against `main` on 2026-10-31, in a sub-agent separate from the implementation, on two axes: the project's standards and the ticket's spec.

Fixed:
- The requirements bullet claimed `binn daemon start` takes `BINNACLE_PORT` unconditionally. With autostart on, `start` goes through the service, whose unit carries `BINNACLE_HOME` and `PATH` only, so the claim was false on the common path. Both READMEs now scope it with "with autostart off".

Kept:
- The site URL `https://it-bbox.github.io/binnacle/` is the default GitHub Pages address for `github.com/it-bbox/binnacle`; it answers only once ticket 05 publishes the site, which the launch checklist covers. The user-guides test does not check external URLs.

Checked:
- The install path (`binn init`, `/binnacle:roadmap`, `/binnacle:product`, then the epic and ticket skills) precedes the first `docs/` reference in both READMEs; the demo GIF and the five asset paths resolve.
- The requirements precede the install commands; Node 24 LTS matches `engines` (`>=24 <27`), and `7717` matches the daemon's `DEFAULT_PORT`.
- One sentence explains why not Docker in both languages; the README points to the container guide, the mod and the site; both twins link each other.
- No `/home/...` path, worktree path, session or ticket id appears in either README.
- `node --test apps/cli/test/user-guides.test.ts`: 2 pass. `pnpm typecheck`: exit 0. `LANGUAGE=C pnpm test`: 982 pass, 1 skipped, 0 fail.

### Notes for the next tickets

- Ticket 05 (site): the README links `https://it-bbox.github.io/binnacle/`, so Pages must serve the site at that address; if it does not, change the link in both READMEs with the site.
- The site repeats the requirements (spec, *Implementation Decisions*); if it names `BINNACLE_PORT`, scope it as the README does, "with autostart off".
- The autostart `BINNACLE_PORT` defect above is a ticket of its own, outside this epic (spec, *Contested points*); it is not filed here.
