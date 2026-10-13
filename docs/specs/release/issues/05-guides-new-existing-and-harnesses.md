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

## Comments

### Decisions

- **Checked against the code, and against one run.** Each claim was traced to `apps/cli/src/bin.ts`, `init.ts`, `audit.ts`, `audit-files.ts`, `audit-tools.ts`, `tools.ts`, `export.ts` and the plugin's `roadmap`, `init`, `audit`, `help` and `autopilot` skills; `binn init --plan --json`, run on an empty repository with a temporary `BINNACLE_HOME`, gave the plan items in the order *The plan, item by item* lists them.
- **No new test.** The spec's seams are the twin and link test, which covers these pages, and the short paths' order in `pack.test.ts`; readability is the owner's judgement (spec, *Testing Decisions*). Every paragraph and list item is at most about 400 characters, four lines on GitHub at a laptop's width.
- **Headings moved.** `02-existing-project-adopt.md`'s *What `binn audit` and `binn init` do* became *1. Audit* and *The plan, item by item*, one numbered item per plan item in the plan's order; `01-new-project.md` and its twin link the new anchor.
- **What was stale, and where its rule went.** `01-new-project.md`'s "Expected responsibilities" list became what the plan holds; *Workflow tools* became a table of how each tool is installed; *Installation philosophy*'s rule, a tool already there is not reinstalled, is in *Workflow tools*, and its required, recommended and optional tiers, which `binn init` does not apply, were dropped (ADR-0006 and ADR-0035 hold the decision). `02-existing-project-adopt.md`'s "`binn init` should" list named things only the audit does, or nothing does (languages, `.scratch`); its *Audit* list and *Output* named areas and a migration plan the audit lacks. They became the eight areas `binn audit` prints. The migration plan and the secrets and security areas are already `docs/05-mvp-plan.md`'s phase 12.
- **Added where the code does it and the guide was silent**: the autostart question, the tracker check after the plan, the `new` and `existing` arguments of `/binnacle:roadmap`, VS Code's next step, and a table of the fourteen skills with both names.
- **Logical names dropped** from `01-new-project.md` (`/product`, `/daily`): each step names the Claude Code skill, and the short path's note links the naming in another harness.

### For the owner

The old *Audit* list named four checks no phase plans: branch conventions, Serena memory duplication, Graphify ignore rules beyond `binn init`'s own, and typecheck and lint presence. If any is wanted, a Product session can put it in the product inbox.

### For ticket 06

- The three guides now link `06-other-harnesses.md#binnacles-skills-in-another-harness` and `02-existing-project-adopt.md#the-plan-item-by-item`, and the Russian twins their Russian anchors; renaming those headings needs the links changed with them.
