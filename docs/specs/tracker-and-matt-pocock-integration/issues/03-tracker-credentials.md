# 03: Read-only tracker credentials

Status: READY
Triage: ready-for-agent
Blocked by: 02
Spec: `docs/specs/tracker-and-matt-pocock-integration/spec.md`

**What to build:** a private GitHub or GitLab repository can be read. The daemon finds a read-only token for the declared host, refuses a credentials file others can read, and never lets a token reach a response. Decided in the spec, under *Credentials*.

- [ ] Lookup order, on every call: `BINNACLE_GITHUB_TOKEN` or `BINNACLE_GITLAB_TOKEN` from the daemon's environment for its provider; then the declared host's entry in `~/.binnacle/credentials.json` (a JSON object keyed by host, under the Binnacle home); then no token, and the request is anonymous.
- [ ] `GITHUB_TOKEN` and other generic names are not read. Nothing is imported from `gh` or `glab`.
- [ ] A credentials file whose permissions allow anyone but its owner is not read and gives `tracker.credentials_insecure`, where the platform has POSIX modes.
- [ ] `tracker.unauthorized` says whether a token was used.
- [ ] A test asserts that the token appears in no response, diagnostic, event or log line, including on an authentication failure.
- [ ] Tests through the daemon seam cover each lookup source, the order, the insecure file and the anonymous fallback, against the loopback stand-in checking the header it receives.
- [ ] `docs/operations/05-installation-checklist.md` names the two variables and the file.
