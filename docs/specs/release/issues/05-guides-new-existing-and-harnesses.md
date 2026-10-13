# 05: Guides for a new project, an existing project and other harnesses

Status: READY
Triage: ready-for-agent
Blocked by: 04
Spec: `docs/specs/release/spec.md`
Roles: Developer, Reviewer

**What to build:** the three guides a new user reads after the README read as easily as it does, in both languages (spec, *The user guides*; the product inbox's *Readable documentation before the release*). The new-project guide, the existing-project guide and the guide for working from another harness are reworked into short paragraphs under headings, with lists where text enumerates steps or harnesses and tables where it compares; the forty-line paragraph on `binn audit` and `binn init` becomes steps. Each is checked against what `binn audit`, `binn init`, `/binnacle:roadmap` and the skills do today, and its Russian twin is updated in the same change.

- [ ] No paragraph in the three guides, in either language, runs past about six lines; enumerations are lists or tables.
- [ ] Every command, flag and skill named exists and behaves as described.
- [ ] Each English page and its Russian twin say the same thing; the twin and link test passes.
