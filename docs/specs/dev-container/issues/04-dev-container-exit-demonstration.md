# 04: The exit demonstration of epic 23, and 0.7.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03
Spec: `docs/specs/dev-container/spec.md`

**What to build:** epic 23's exit criterion, demonstrated by the owner, then the 0.7.0 release and the feature's 1.0.0 (spec, the exit criterion, *The exit demonstration*, *The release*).

- [ ] The CLI package's version is 0.7.0 and the feature's 1.0.0; 0.7.0 is published by `CONTRIBUTING.md`'s *Releasing*, and the feature to `ghcr.io/it-bbox`.
- [ ] In a clean dev container naming the published feature, with port 7717 published on `127.0.0.1`, the daemon starts with the container and `binn daemon status` gives 0.7.0.
- [ ] `binn init` registers the project inside the container, and the address `binn dashboard` prints opens the dashboard in the host's browser.
- [ ] A rebuild of the container keeps the registration and the token.
- [ ] A second container on host port 7718 runs beside the first, and both dashboards open.
- [ ] The OpenTelemetry endpoint of one container refuses a call from the other.
- [ ] A host install of 0.7.0 with nothing set binds `127.0.0.1` and behaves as 0.6.0 did.
- [ ] One daemon's resident memory and its home's size, one project per container, are measured and written into the guide and its twin, with the date and the setup.
