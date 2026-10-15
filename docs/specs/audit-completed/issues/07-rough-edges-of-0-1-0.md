# 07: The rough edges of 0.1.0

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** the four small fixes found while publishing 0.1.0 (spec, *The release guide*, *Registering without a manifest*, *The skills' wording*, *ast-grep under npm's script policy*).

- `binn project register` without a manifest answers that the repository has no `.binnacle/project.yaml` and that `binn init` writes one, instead of pointing to a template only a checkout has.
- The skills' pointer to the README's setup drops "and *From this repository* until the npm package is published", in every skill and every copy that has it.
- `binn init` installs `@ast-grep/cli` with `--allow-scripts=@ast-grep/cli`, which npm 11 accepts for a global install. Check what an npm that does not know the flag does; if it fails, keep the old command for that npm.
- `CONTRIBUTING.md`'s *Releasing* and its twin say that npm publishes only from an account with two-factor authentication (`E403` otherwise), that the CLI then asks for the second factor in the browser, that a recovery code puts the account on a 72-hour hold with no publishing, and that a new package shows `0.0.0-stage` as `latest` for a few minutes before its version.

- [ ] Through the `binn` process: `binn project register` in a repository with no manifest names `binn init` and not the template.
- [ ] No skill, in the plugin or the harness copies, still says "until the npm package is published".
- [ ] `binn init`'s plan shows the ast-grep install with `--allow-scripts=@ast-grep/cli`; the ticket's comments say what an older npm does with it.
- [ ] *Releasing* and its Russian twin carry the four points.

## Comments

- **What an older npm does with `--allow-scripts`**, checked on 2026-10-15 by installing `@ast-grep/cli` 0.51.0 globally into a throwaway prefix: npm 10.9.8 (Node 22) takes `npm i @ast-grep/cli -g --allow-scripts=@ast-grep/cli` silently, exits 0, runs the postinstall as it always did, and `ast-grep --version` works. npm 11.16.0 (Node 24) exits 0 with the flag and no warning; without it, it warns that the postinstall is "not yet covered by allowScripts". So the flag breaks no npm, and init keeps one command for every npm, with no version check.
- Decisions where the ticket is silent: the manifest message is `No .binnacle/project.yaml in <root>. \`binn init\` writes one.`, the one `manifest.missing` answer, so the daemon's register and every reader of a missing manifest say the same; `MANIFEST_TEMPLATE`, used only there, is gone, and the template file stays for contributors. The skills' source is `.claude/skills/binnacle/`; `apps/cli/plugin/` and `apps/cli/skills/`, the plugin and harness copies, are generated from it by `prepare` and hold the new wording once it runs. `docs/operations/03-external-tools.md` and its twin show init's new ast-grep command.
- For the Product session: the three product-inbox entries on ast-grep's postinstall, the register template and the skills' clause (`docs/product-inbox.md`) are closed by this ticket.
