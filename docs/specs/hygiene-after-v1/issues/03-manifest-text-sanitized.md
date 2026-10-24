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

## Comments

- Decisions where the ticket is silent:
  - `terminalText` lives in `packages/core/src/terminal.ts`, exported from `@binnacle/core`. It escapes `\p{Cc}` but tab and newline, so DEL (U+007F) too, and the listed bidi controls, as `\u{<lowercase hex>}`.
  - `binn audit` reads no `tracker.host` from the manifest: its tracker checks quote the remote's host and repository, as the spec's *One sanitizer in core* names them. The test puts the C1 control and the bidi override in the remote's host, and in the manifest's `knowledge.docs`, the manifest value the audit does quote (the roadmap's path).
  - The sanitizer wraps each command's whole human output rather than each value, so that a value added later cannot miss it: `binn audit`'s report, every line `binn init` says (not `--plan`'s JSON), the autostart token warning (`binn daemon autostart on`, and `binn init`'s Summary through the same function), and `binn project register`, `list` and `status`, which print a manifest's id and name. The `--json` outputs are unchanged.

### Review

Against `main`, in a sub-agent, on the standards, the spec and the ticket's Security role. Typecheck and the full suite (899 tests) pass; every criterion is pinned through the `binn` process, and core's purity test passes.

1. **Raw bidi characters in the sources**: the sanitizer's character class and the new tests held U+202E and the other bidi controls as raw characters, the Trojan Source pattern the ticket guards against. **Fixed**: written as `\u` escapes in `packages/core/src/terminal.ts` and the three tests.
2. Import order of `@binnacle/core` before `node:` in two files. **Kept**: the repository mixes both orders.
3. No other standards finding; commits carry one author and no assistant attribution.
4. The decisions hold: `binn audit` reads its host from the remote only, so the remote's host is the right fixture, and `knowledge.docs` covers a manifest value the audit quotes; `binn project`'s commands are within "every place the CLI prints a manifest value".

#### Security

The escape set matches the ticket byte for byte, CR escaped, tab and newline kept; the JSON outputs are unchanged.

5. **A failed daemon call printed its details raw**: `reportFailure` (`apps/cli/src/report.ts`) printed a `yaml.syntax` detail, which quotes a line of the manifest, and a `capabilities.<name>` path to stderr unsanitized, under `binn project register` and the other daemon commands. **Fixed**: both lines go through `terminalText`.
6. **A failed `skills` call in `binn init` would show its colours as escapes**, now that every line init says is sanitized. **Fixed**: `skillsFailed` strips SGR sequences first, as `installedInto` does; any other control in a tool's output is escaped.
7. The escape is not injective: a literal `\u{85}` in a value reads as an escaped U+0085. **Kept**: harmless for human output, and the function is idempotent.
