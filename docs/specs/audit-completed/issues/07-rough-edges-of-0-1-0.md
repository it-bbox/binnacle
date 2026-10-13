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
