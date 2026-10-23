# 03: Manifest text reaches a terminal sanitized

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/hygiene-after-v1/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** one sanitizer in `@binnacle/core` for text printed to a terminal, used by every place the CLI prints a manifest value (spec, *One sanitizer in core*; product inbox, *A shared sanitizer for manifest text in output*). C0 controls other than tab and newline, C1 controls and the bidi controls (U+061C, U+200E–U+200F, U+202A–U+202E, U+2066–U+2069) are printed as their `\u{…}` escape, not dropped.

- [ ] `binn audit` on a fixture whose manifest's tracker host holds a C1 control and a bidi override shows their escapes in its human output, in English and in Russian.
- [ ] `binn audit --json` keeps the value as it is.
- [ ] `binn daemon`'s missing-token line and `binn init`'s plan, where they quote a manifest value, go through the same sanitizer.
- [ ] `@binnacle/core` keeps no runtime dependency (its purity test).
