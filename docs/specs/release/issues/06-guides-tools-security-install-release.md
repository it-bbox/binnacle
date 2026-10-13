# 06: Guides for tools, security, installation and the release

Status: READY
Triage: ready-for-agent
Blocked by: 03, 04
Spec: `docs/specs/release/spec.md`
Roles: Developer, Reviewer

**What to build:** the rest of the user guides read easily and match the published package, in both languages (spec, *The user guides*, *Install names in the docs*). The external tools guide, the security and resilience guide and the installation checklist are reworked as ticket 05 reworks its three, and checked against the current behaviour; installation is `npm i -g @it-bbox/binnacle`, with `npx -p @it-bbox/binnacle binn` for a one-off run. `CONTRIBUTING.md` gains the release: the build, the tarball test, and the owner's publishing steps — `npm login`, then `npm publish --access public` from the built package's directory. Each Russian twin is updated in the same change.

- [ ] No paragraph in these pages, in either language, runs past about six lines; enumerations are lists or tables.
- [ ] The installation checklist installs from npm and works as written on a clean machine, as ticket 03's tarball test drives it.
- [ ] `CONTRIBUTING.md` and its twin give the build, the test and the publishing steps.
- [ ] The twin and link test passes.
