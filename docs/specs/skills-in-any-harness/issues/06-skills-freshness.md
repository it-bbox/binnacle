# 06: Stale skills are reported and reinstalled

Status: DONE
Triage: ready-for-agent
Blocked by: 04
Spec: `docs/specs/skills-in-any-harness/spec.md`

**What to build:** installed Binnacle skills are read from `~/.agents/skills/binnacle-*`, where the `skills` CLI keeps canonical copies (spec, *Freshness*). A set where any skill's `metadata` version differs from the package copy's, or where some skills are missing while others are present, is stale. `binn audit` reports it as one finding, with a code in the group its other tool and harness findings use; a current set or none at all is not reported. `binn init`'s skills step plans the add for a stale set and nothing for a current one, and says which.

- [x] Audit tests in a temporary home: stale version, partly missing set, current set, no set.
- [x] Init tests with the fake `npx`: a current set plans no Binnacle add and says it is current; a stale one plans it.

## Comments

### Decisions

- **Where**: `binnacleSkills()` in `apps/cli/src/tools.ts`, read by both `binn audit` (`capabilities`, in `audit-tools.ts`) and `binn init`'s skills step. It compares each skill of the package's copy with `~/.agents/skills/<skill>/SKILL.md`: none of them there is `none`; each at the copy's `metadata` version is `current`; otherwise `stale`, naming the skills at another version (or with none) and the missing ones.
- **The finding**: `capabilities.binnacle_skills`, status `gap`, in the `capabilities` area beside Serena, Graphify and Context7; it recommends running `binn init`. A current set or none at all gives no finding.
- **A `binnacle-*` skill the copy no longer has** is not judged: `skills add` does not remove it, so it would stay stale for ever.
- **`binn init` with a current set** plans nothing and records `found Binnacle's skills: current`. It prints the add and removal commands instead, for a harness installed since: see the first Review finding. With a stale set it says which skills are stale and plans the same add and removal as ticket 04.
- **A missing package copy** (no `prepare` run) reads as `none`, so the audit stays silent rather than failing; `binn init` already needs the copy, as ticket 04's review kept.

### Review

`mattpocock-skills:code-review` ran against `main`, on both axes, with its sub-agents in the foreground.

**Standards: no hard violation.** Findings:

1. **A current set skips the add, so a harness installed after the skills were does not get them, while the next step says to run `binnacle-product` there.** **Kept, mitigated**: the spec's *Freshness* says `binn init` "plans nothing for a current one", reading `~/.agents/skills` alone. The step now prints the add and removal (with any `--skip-harness`) for a harness installed since, marked `ponytail:`. The conflict with user story 8 is a question for the owner, below.
2. **`SKILLS_COPY` recomputed the package directory, and init wrote `~` with an unanchored `replace` beside the audit's `tilde`.** **Fixed**: `PACKAGE_DIR` and `tilde` live in `tools.ts`, shared.
3. **`const copy = SKILLS_COPY` only renamed a constant.** **Fixed**.
4. **The `metadata` version is read as text, taking `version` as the first key.** **Fixed** by a `ponytail:` comment naming the ceiling: the package's build writes it so; a YAML parser if another writer reorders it.
5. **The stale reason names the first skill's version as the package's.** **Kept**, with a comment: the build gives every skill of the copy the plugin's one version.
6. **The stale finding was spread after the tools' `map`.** **Fixed**: the tools' findings are built first, the skills finding appended.

**Spec: every criterion implemented, with a test; no scope creep beyond the retired-skill rule above.** Findings:

1. **A current set ignores a newly installed harness and `--skip-harness`** — Standards 1. **Kept, mitigated**, as there.
2. **The version read is fragile to key order** — Standards 4. **Fixed** by the comment.
3. **An unreadable package copy reads as `none`.** **Kept**, as under *Decisions*.

### Question for the owner

The spec's *Freshness* ("plans nothing for a current one", read from `~/.agents/skills` alone) and user story 8 / ADR-0039 ("running `binn init` again after installing another harness adds it") disagree once the skills are current: the `skills` CLI's canonical copy is current, so `binn init` plans no add, and the new harness gets the skills only from the printed commands. Either keep this, or have a current set still plan the add when asked (for example only with `--skip-harness` or a new flag), or read each harness's install through the `skills` CLI. A Product session decides.
