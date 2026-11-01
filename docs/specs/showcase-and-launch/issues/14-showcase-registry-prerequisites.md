# 14: Prepare the Registry ownership marker and correct the launch path

Status: READY
Triage: ready-for-agent
Blocked by: 04, 06, 07
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** make the prepared MCP Registry submission possible and state its release prerequisite, without publishing anything.

- [ ] The manifest produced by `apps/cli/src/manifest.ts` carries `mcpName: io.github.it-bbox/binnacle`, matching the proposed Registry name. A regression check covers the actual published manifest shape.
- [ ] `docs/showcase/listings.md` names the required marker and explains that published 0.7.1 lacks it. Replace the unconditional claim that no listing needs a release with the real prerequisite: a separate owner release containing the marker before an npm-backed Registry submission.
- [ ] The launch checklist and ticket 08 agree on that prerequisite and its order. The epic prepares metadata and instructions; neither the release nor the submissions are performed by this ticket.
- [ ] The documented publisher steps and executable arguments agree with the official Registry documentation and Binnacle's `binn mcp` command; cite the primary source.
- [ ] Manifest checks, typecheck and the tarball test pass; no package version is raised and nothing is submitted or pushed.

## Notes

On 2026-11-01 the published `@it-bbox/binnacle@0.7.1` metadata had no `mcpName`. The Registry checks it in the published package, not merely the checkout: <https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/package-types.mdx#ownership-verification>. Correcting a Markdown claim alone does not make that package eligible.

## Comments

### Decisions

- **The `server.json` arguments.** The package installs two commands, `binn` and `binnd`, so `npx @it-bbox/binnacle mcp` fails with "could not determine executable to run" (tried on npm 11 with a two-bin package). A client runs an npm entry as `npx <runtimeArguments> <identifier>@<version> <packageArguments>`, so the entry ends `runtimeArguments` with a bare `--package` and puts `binn mcp` in `packageArguments`: `npx -y --package @it-bbox/binnacle@<version> binn mcp`, which runs. No `binnacle` bin was added: the ticket asks for the marker only. The schema has no bin selector yet (registry issue #1629); `listings.md` says to use one if it exists at submission time.
- **A shorter Registry description.** The schema caps `description` at 100 characters; the identity line is 121. The `server.json` carries a 99-character variant, and the manifest test pins the limit.
- **The order.** mcp.so, Smithery and the awesome lists need no release, so they come before it; the release, the Registry entry and the PulseMCP and Glama check close the listings, in `listings.md` and the launch checklist alike. Ticket 08 already says the owner cuts that release separately, before the Registry submission, and needed no change.
- **The manifest test** reads the `server.json` block from `listings.md` and checks it against `publishManifest`: the name equals `mcpName`, the identifier equals the package name, `binn` is a bin. The tarball test checks `mcpName` in the installed manifest.

### Review

Sub-agent review against `main`, standards and spec. No must-fix finding.

- Fixed: `listings.md` said nothing else waited on the release while the ordered list put the release before mcp.so, Smithery and the awesome lists, and the PulseMCP and Glama check does wait on it. The release and the Registry entry moved after the four release-free steps, with the check last, in `listings.md` and `launch-checklist.md`; the sentence now names the check.
- Fixed: the step mentioning `mcp-publisher init` read as if `init` were needed; it now says it is not.
- Fixed: the comment in `apps/cli/src/manifest.ts` had an ambiguous "it"; it now names the Registry.
- Checked, no finding: the publisher steps match the official quickstart (install, `login github`, `publish`, the search `curl`); `title` and positional `value` are valid in the 2025-12-11 schema; no version raised; the commit has no attribution trailer; the test follows its neighbours.
