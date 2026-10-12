import { ROLES, TASK_STATES, type TrackerProvider } from '@binnacle/core';
import { DOMAIN, ISSUE_TRACKER, TRIAGE_LABELS } from './layout.ts';

/**
 * The planning conventions `binn init` writes where they are missing, in the shape
 * `/setup-matt-pocock-skills` writes them, so that Matt Pocock Skills read them as their own
 * (ADR-0042): `docs/agents/issue-tracker.md` for the tracker, with the ticket header (ADR-0024),
 * `triage-labels.md`, `domain.md` for a single context, and the *Agent skills* block that points
 * to the three. Text only: init plans and writes it.
 */

const ISSUE_NUMBERS = 'the issue numbers of the issues it waits for, such as `#12, #15`';
const PATH_OR_LINK = 'its path, such as `docs/specs/<slug>/spec.md`, or a link to that file pinned to a commit';
const KEEP_CURRENT = 'Binnacle reports any disagreement between the two, so keep the line current when you close the issue.';
/** A question's options, alike on every tracker. */
const QUESTION_OPTIONS =
  'After its text, a question lists its options, each with its cost, the recommended one first and marked "(recommended)"; ' +
  'the owner chooses one or writes their own answer.';
const REMOTE_QUESTIONS =
  'A question only the owner can answer, and its answer, are issue comments that start with `### Question` and `### Answer`; ' +
  `the answer is written by the owner or \`/binnacle:answer\`, never by an agent. ${QUESTION_OPTIONS}`;

/**
 * What the section says differently on each tracker (ADR-0024). `rule` follows the fields: on
 * the local tracker, the unique slug a ticket's branch needs; on a remote one, the spec's closed-issue states.
 * `questions` says where a question for the owner and its answer go (ADR-0040).
 */
const CONVENTIONS: Record<TrackerProvider, { ticket: string; blockedBy: string; example: string; spec: string; rule: string; questions: string }> = {
  local: {
    ticket: 'ticket',
    blockedBy: 'the numbers of the tickets in the same spec it waits for, such as `01, 03`',
    example: '01, 03',
    spec: 'its path, such as `docs/specs/<slug>/spec.md`',
    rule:
      "A ticket's slug, its file name without the number, is unique across every spec's tickets: it names the ticket's branch, `feat/<slug>`, " +
      'and Binnacle credits the work on a branch two tickets share to neither.',
    questions:
      'A question only the owner can answer goes under a `### Question` heading inside `## Comments`, in a commit that changes only the ticket, on the branch where the work is; ' +
      "the owner's reply goes right after it under `### Answer`, written by the owner or `/binnacle:answer`, never by an agent. " +
      `Binnacle reads them from the Task's branch while it is unmerged. ${QUESTION_OPTIONS}`,
  },
  github: {
    ticket: 'issue body',
    blockedBy: ISSUE_NUMBERS,
    example: '#12, #15',
    spec: PATH_OR_LINK,
    rule:
      'Closing an issue outranks its `Status:` line: an issue closed as completed is done, and one closed as not planned or as a duplicate is cancelled, whatever the line says. ' +
      `An issue closed with no reason is cancelled when its \`Status:\` says \`CANCELLED\`, and done otherwise. ${KEEP_CURRENT}`,
    questions: REMOTE_QUESTIONS,
  },
  gitlab: {
    ticket: 'issue body',
    blockedBy: ISSUE_NUMBERS,
    example: '#12, #15',
    spec: PATH_OR_LINK,
    rule:
      'Closing an issue outranks its `Status:` line, and GitLab reports no reason for closing: a closed issue is done, unless its `Status:` says `CANCELLED`. ' +
      `Set \`Status: CANCELLED\` before closing work that was abandoned. ${KEEP_CURRENT}`,
    questions: REMOTE_QUESTIONS,
  },
};

/** The convention `/to-tickets` writes by, for the tracker in use. It leads with a blank line, after the file's last section. */
export function ticketHeaderSection(provider: TrackerProvider): string {
  const { ticket, blockedBy, example, spec, rule, questions } = CONVENTIONS[provider];
  const states = TASK_STATES.map((state) => `\`${state}\``).join(', ');
  return `
## Ticket header

Binnacle reads a ticket's state, dependencies and spec from its header: these lines, one per line, at the top of every ${ticket}, before anything else. Write them in every ticket, and keep \`Status:\` current.

- \`Status:\` — the ticket's state, one of ${states}.
- \`Blocked by:\` — ${blockedBy}, or \`None\`.
- \`Spec:\` — the spec it implements, as ${spec}.
- \`Roles:\` — the roles the Task needs, comma-separated, from ${ROLES.join(', ').replace(/, (\w+)$/, ' and $1')}, such as \`Developer, Reviewer, Security\`. Optional: without it a Task needs a Developer and a Reviewer. Binnacle shows its own suggested roles beside the line and never changes it.

${rule}

${questions}

For example:

\`\`\`text
Status: READY
Blocked by: ${example}
Spec: \`docs/specs/<slug>/spec.md\`
Roles: Developer, Reviewer, Security
\`\`\`
`;
}

/** The Epic brief and the contested points, as conventions every tracker's file lists. */
const PLANNING_CONVENTIONS = `- A grilling ends with an Epic brief, \`docs/specs/<epic>/brief.md\`: what it decided, in the owner's words, in five parts — the problem, the outcome wanted, who it concerns, the systems it touches, constraints and open questions. The owner reads it whole before \`/to-spec\`, which starts from it, and a Next action that grills an epic names its brief
- A spec lists its contested points under a \`## Contested points\` heading: where requirements conflict or a choice was close, each with the option taken`;

/** On a remote tracker the tickets are issues, and the spec and the brief stay in Git (ADR-0017). */
const REMOTE_SPECS = `- A spec is \`docs/specs/<slug>/spec.md\`, committed to Git, never an issue; an issue names it on its \`Spec:\` line
${PLANNING_CONVENTIONS}`;

const remotePublish = (forge: string): string => `## When a skill says "publish to the issue tracker"

Create a ${forge} issue for a ticket. A spec or a brief is a file under \`docs/specs/<slug>/\`, committed to Git.`;

/** `docs/agents/issue-tracker.md` before its ticket header, by tracker, after `/setup-matt-pocock-skills`'s seed templates. */
const TRACKER_FILES: Record<TrackerProvider, string> = {
  local: `# Issue tracker: Local Markdown

Specs and issues for this repo live as Markdown files in Git under \`docs/specs/\`.

## Conventions

- One effort per directory: \`docs/specs/<slug>/\`
- The spec is \`docs/specs/<slug>/spec.md\`
- Implementation issues are one file per ticket at \`docs/specs/<slug>/issues/NN-<slug>.md\`, numbered from \`01\`, never a single combined tickets file
- Two separate fields near the top of each issue file: \`Status:\`, the ticket's state (see *Ticket header* below), and \`Triage:\`, the role string from \`triage-labels.md\`
- Comments and conversation history append to the bottom of the file under a \`## Comments\` heading
${PLANNING_CONVENTIONS}

## When a skill says "publish to the issue tracker"

Create a new file under \`docs/specs/<slug>/\` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by \`/wayfinder\`. The **map** is a file with one **child** file per ticket.

- **Map**: \`docs/specs/<effort>/map.md\` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: \`docs/specs/<effort>/issues/NN-<slug>.md\`, numbered from \`01\`, with the question in the body. A \`Type:\` line records the ticket type (\`research\`/\`prototype\`/\`grilling\`/\`task\`); a \`Status:\` line records \`claimed\`/\`resolved\`.
- **Blocking**: a \`Blocked by: NN, NN\` line near the top. A ticket is unblocked when every file it lists is \`resolved\`.
- **Frontier**: scan \`docs/specs/<effort>/issues/\` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set \`Status: claimed\` and save before any work.
- **Resolve**: append the answer under an \`## Answer\` heading, set \`Status: resolved\`, then append a context pointer (gist + link) to the map's Decisions-so-far in \`map.md\`.
`,
  github: `# Issue tracker: GitHub

Issues for this repo live as GitHub issues, and specs as files in Git under \`docs/specs/\`. Use the \`gh\` CLI for all operations on issues.

## Conventions

- **Create an issue**: \`gh issue create --title "..." --body "..."\`. Use a heredoc for multi-line bodies.
- **Read an issue**: \`gh issue view <number> --comments\`, filtering comments by \`jq\` and also fetching labels.
- **List issues**: \`gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'\` with appropriate \`--label\` and \`--state\` filters.
- **Comment on an issue**: \`gh issue comment <number> --body "..."\`
- **Apply / remove labels**: \`gh issue edit <number> --add-label "..."\` / \`--remove-label "..."\`
- **Close**: \`gh issue close <number> --comment "..."\`
${REMOTE_SPECS}

Infer the repo from \`git remote -v\`; \`gh\` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to \`yes\` if this repo treats external PRs as feature requests; \`/triage\` reads this flag.)_

When set to \`yes\`, PRs run through the same labels and states as issues, using the \`gh pr\` equivalents:

- **Read a PR**: \`gh pr view <number> --comments\` and \`gh pr diff <number>\` for the diff.
- **List external PRs for triage**: \`gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments\` then keep only \`authorAssociation\` of \`CONTRIBUTOR\`, \`FIRST_TIME_CONTRIBUTOR\`, or \`NONE\` (drop \`OWNER\`/\`MEMBER\`/\`COLLABORATOR\`).
- **Comment / label / close**: \`gh pr comment\`, \`gh pr edit --add-label\`/\`--remove-label\`, \`gh pr close\`.

GitHub shares one number space across issues and PRs, so a bare \`#42\` may be either: resolve with \`gh pr view 42\` and fall back to \`gh issue view 42\`.

${remotePublish('GitHub')}

## When a skill says "fetch the relevant ticket"

Run \`gh issue view <number> --comments\`.

## Wayfinding operations

Used by \`/wayfinder\`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled \`wayfinder:map\`, holding the Notes / Decisions-so-far / Fog body. \`gh issue create --label wayfinder:map\`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (\`gh api\` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put \`Part of #<map>\` at the top of the child body. Labels: \`wayfinder:<type>\` (\`research\`/\`prototype\`/\`grilling\`/\`task\`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies**, the canonical, UI-visible representation. Add an edge with \`gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>\`, where \`<blocker-db-id>\` is the blocker's numeric **database id** (\`gh api repos/<owner>/<repo>/issues/<n> --jq .id\`, _not_ the \`#number\` or \`node_id\`). GitHub reports \`issue_dependencies_summary.blocked_by\` (open blockers only, the live gate). Where dependencies aren't available, fall back to a \`Blocked by: #<n>, #<n>\` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (\`gh issue list --state open\`, scoped to the map's sub-issues / task list), drop any with an open blocker (\`issue_dependencies_summary.blocked_by > 0\`, or an open issue in the \`Blocked by\` line) or an assignee; first in map order wins.
- **Claim**: \`gh issue edit <n> --add-assignee @me\`, the session's first write.
- **Resolve**: \`gh issue comment <n> --body "<answer>"\`, then \`gh issue close <n>\`, then append a context pointer (gist + link) to the map's Decisions-so-far.
`,
  gitlab: `# Issue tracker: GitLab

Issues for this repo live as GitLab issues, and specs as files in Git under \`docs/specs/\`. Use the [\`glab\`](https://gitlab.com/gitlab-org/cli) CLI for all operations on issues.

## Conventions

- **Create an issue**: \`glab issue create --title "..." --description "..."\`. Use a heredoc for multi-line descriptions. Pass \`--description -\` to open an editor.
- **Read an issue**: \`glab issue view <number> --comments\`. Use \`-F json\` for machine-readable output.
- **List issues**: \`glab issue list -F json\` with appropriate \`--label\` filters.
- **Comment on an issue**: \`glab issue note <number> --message "..."\`. GitLab calls comments "notes".
- **Apply / remove labels**: \`glab issue update <number> --label "..."\` / \`--unlabel "..."\`. Multiple labels can be comma-separated or by repeating the flag.
- **Close**: \`glab issue close <number>\`. \`glab issue close\` does not accept a closing comment, so post the explanation first with \`glab issue note <number> --message "..."\`, then close.
- **Merge requests**: GitLab calls PRs "merge requests". Use \`glab mr create\`, \`glab mr view\`, \`glab mr note\`, etc., the same shape as \`gh pr ...\` with \`mr\` in place of \`pr\` and \`note\`/\`--message\` in place of \`comment\`/\`--body\`.
${REMOTE_SPECS}

Infer the repo from \`git remote -v\`; \`glab\` does this automatically when run inside a clone.

## Merge requests as a triage surface

**MRs as a request surface: no.** _(Set to \`yes\` if this repo treats external merge requests as feature requests; \`/triage\` reads this flag.)_

When set to \`yes\`, MRs run through the same labels and states as issues, using the \`glab mr\` equivalents:

- **Read an MR**: \`glab mr view <number> --comments\` and \`glab mr diff <number>\` for the diff.
- **List external MRs for triage**: \`glab mr list -F json\`, then keep only MRs whose author is not a project member/owner (a contributor's MR, not a maintainer's in-flight work).
- **Comment / label / close**: \`glab mr note\`, \`glab mr update --label\`/\`--unlabel\`, \`glab mr close\`.

Unlike GitHub, GitLab numbers issues and MRs separately, so \`#42\` is unambiguous once you know which surface the maintainer means.

${remotePublish('GitLab')}

## When a skill says "fetch the relevant ticket"

Run \`glab issue view <number> --comments\`.

## Wayfinding operations

Used by \`/wayfinder\`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled \`wayfinder:map\`, holding the Notes / Decisions-so-far / Fog body. \`glab issue create --label wayfinder:map\`. (On GitLab tiers with native epics, an epic may hold the map instead; a labelled issue works everywhere.)
- **Child ticket**: an issue carrying \`Part of #<map>\` at the top of its description and labels \`wayfinder:<type>\` (\`research\`/\`prototype\`/\`grilling\`/\`task\`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitLab's **native blocking link**, the canonical, UI-visible representation. Add it with the \`/blocked_by #<n>\` quick action, posted as a note (\`glab issue note <child> --message "/blocked_by #<blocker>"\`). Native blocking links are a Premium/Ultimate feature; on the free tier (or where unavailable) fall back to a \`Blocked by: #<n>, #<n>\` line at the top of the description. A ticket is unblocked when every blocker is closed.
- **Frontier query**: \`glab issue list -F json\` scoped to the map's children, drop any with an open blocker: a native \`blocked_by\` link to an open issue (\`glab api projects/:id/issues/:iid/links\`), or an open issue in the \`Blocked by\` line, or an assignee; first in map order wins.
- **Claim**: \`glab issue update <n> --assignee @me\`, the session's first write.
- **Resolve**: \`glab issue note <n> --message "<answer>"\`, then \`glab issue close <n>\`, then append a context pointer (gist + link) to the map's Decisions-so-far.
`,
};

/** The whole `docs/agents/issue-tracker.md` for a tracker: its conventions, then the ticket header. */
const issueTrackerFile = (provider: TrackerProvider): string => TRACKER_FILES[provider] + ticketHeaderSection(provider);

const TRIAGE_LABELS_FILE = `# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| \`needs-triage\`             | \`needs-triage\`       | Maintainer needs to evaluate this issue  |
| \`needs-info\`               | \`needs-info\`         | Waiting on reporter for more information |
| \`ready-for-agent\`          | \`ready-for-agent\`    | Fully specified, ready for an AFK agent  |
| \`ready-for-human\`          | \`ready-for-human\`    | Requires human implementation            |
| \`wontfix\`                  | \`wontfix\`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.
`;

const DOMAIN_FILE = `# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **\`CONTEXT.md\`** at the repo root: the canonical glossary.
- **\`docs/adr/\`**: read the ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The \`/domain-modeling\` skill (reached via \`/grill-with-docs\` and \`/improve-codebase-architecture\`) creates them lazily when terms or decisions actually get resolved.

## File structure

This repo is **single-context**: one glossary and one ADR directory at the root.

\`\`\`
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
\`\`\`

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in \`CONTEXT.md\`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for \`/domain-modeling\`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
`;

/** Each convention file, by its path, as init creates it for a tracker. */
export const conventionFiles = (provider: TrackerProvider): Record<string, string> => ({
  [ISSUE_TRACKER]: issueTrackerFile(provider),
  [TRIAGE_LABELS]: TRIAGE_LABELS_FILE,
  [DOMAIN]: DOMAIN_FILE,
});

const WHERE_ISSUES: Record<TrackerProvider, string> = {
  local: 'Specs and issues live as Markdown files in Git under `docs/specs/<slug>/`.',
  github: "Issues live in this repository's GitHub Issues, and specs in Git under `docs/specs/<slug>/`.",
  gitlab: "Issues live in this repository's GitLab Issues, and specs in Git under `docs/specs/<slug>/`.",
};

/** The *Agent skills* block, recognised by its heading, so that one already there is never added again. */
export const AGENT_SKILLS_HEADING = /^##\s+Agent skills\s*$/m;

/** The block for an instruction file, pointing to the three files. It leads with a blank line, after the file's last section. */
export const agentSkillsBlock = (provider: TrackerProvider): string => `
## Agent skills

### Issue tracker

${WHERE_ISSUES[provider]} See \`docs/agents/issue-tracker.md\`.

### Triage labels

The five canonical triage roles, used verbatim as label strings. See \`docs/agents/triage-labels.md\`.

### Domain docs

Single-context: \`CONTEXT.md\` and \`docs/adr/\` at the repo root. See \`docs/agents/domain.md\`.
`;
