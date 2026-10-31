# 03: The README storefront

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** a README and its Russian twin that show Binnacle in seconds: the demo and the screenshots, the install path first, the requirements up front, one sentence on why not Docker, and pointers to the container guide, the mod and the site.

- [ ] The demo GIF and the screenshots are embedded, and the install path — `binn init`, then everything from the agent's skills — comes before any reference to `docs/`.
- [ ] The requirements come first: Node 24 LTS, and the loopback port, `127.0.0.1:7717` by default, changed with `BINNACLE_PORT`.
- [ ] One sentence says why not Docker, in both languages.
- [ ] The README points to the container guide, the Claude Code mod and the site.
- [ ] The autostart service's behaviour with a non-default `BINNACLE_PORT` is checked, so the README's port statement is true; a defect is reported, not fixed here.
- [ ] The Russian twin matches, linked both ways, and the user-guides test passes.
