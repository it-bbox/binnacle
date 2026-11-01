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
