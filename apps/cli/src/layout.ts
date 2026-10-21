import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nextActionAttention, parseRoadmap, type Language } from '@binnacle/core';

/**
 * What a repository's documentation layout looks like, read the same way by `binn init` and
 * `binn audit` (spec stories 24 to 27 and 47). Reads files; writes nothing.
 */

export const ISSUE_TRACKER = 'docs/agents/issue-tracker.md';
export const TRIAGE_LABELS = 'docs/agents/triage-labels.md';
export const DOMAIN = 'docs/agents/domain.md';

/** The convention files Matt Pocock Skills read, which `binn init` writes where missing. Any of them present is the layout. */
export const MATT_POCOCK_FILES = [ISSUE_TRACKER, TRIAGE_LABELS, DOMAIN];

export const mattPocockFiles = (root: string): string[] => MATT_POCOCK_FILES.filter((path) => existsSync(join(root, path)));

/** `docs/specs/<slug>/`: a directory under `docs/specs` is a spec's slug. */
export const specSlugs = (root: string): string[] => {
  try {
    return readdirSync(join(root, 'docs/specs'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
};

/**
 * The roadmap `binn init` proposes where there is none: Binnacle's format (ADR-0025) with no
 * epic yet, and a current focus whose Next action is the planning step (ADR-0032), in the
 * repository language (ADR-0045). The table's header, its statuses, `## Current focus` and
 * `Next action:` are markers Binnacle parses, English in both.
 */
export const ROADMAP_SKELETON: Record<Language, string> = {
  en: `# Roadmap

Where the project stands: each epic's status and spec, and the current focus. Binnacle reads this file, so keep the table's header and the \`## Current focus\` heading as they are.

**Status vocabulary:** \`not started\` → \`spec\` → \`tickets\` → \`in progress\` → \`done\`. A Spec cell is \`—\` or a link to \`specs/<slug>/spec.md\`.

| # | Epic | Status | Spec |
| --- | --- | --- | --- |

## Current focus

Nothing is planned yet.

Next action: turn the vision into a roadmap of epics. \`/binnacle:roadmap\`
`,
  ru: `# Роадмап

Где стоит проект: статус и спецификация каждого эпика и текущий фокус. Binnacle читает этот файл, поэтому заголовок таблицы и заголовок \`## Current focus\` оставляйте как есть.

**Статусы:** \`not started\` → \`spec\` → \`tickets\` → \`in progress\` → \`done\`. Ячейка Spec — \`—\` или ссылка на \`specs/<slug>/spec.md\`.

| # | Epic | Status | Spec |
| --- | --- | --- | --- |

## Current focus

Пока ничего не запланировано.

Next action: превратить видение в роадмап из эпиков. \`/binnacle:roadmap\`
`,
};

/** What keeps a roadmap's text from Binnacle's format, each as a sentence; empty when it is in the format. */
export function roadmapGaps(text: string): string[] {
  const { roadmap, diagnostics } = parseRoadmap(text);
  // Without a focus, roadmap.focus_missing already says so; no Tasks, so only a missing Next action is reported.
  return [...diagnostics, ...(roadmap.focus === null ? [] : nextActionAttention(roadmap, null))].map(({ message }) => message);
}

/** The section is recognised by its heading, at any level, so that it is never appended twice. */
const TICKET_HEADER_HEADING = /^#{1,6}\s+Ticket header\s*$/im;

/** Whether the issue tracker file holds the ticket-header section (ADR-0024). False when the file is missing. */
export const hasTicketHeaderSection = (root: string): boolean => {
  try {
    return TICKET_HEADER_HEADING.test(readFileSync(join(root, ISSUE_TRACKER), 'utf8'));
  } catch {
    return false;
  }
};

/** The agent instruction files present at the root, by name, with their text; input to `instructionSets`. One that cannot be read is left out. */
export const instructionFiles = (root: string): Record<string, string> =>
  Object.fromEntries(
    ['AGENTS.md', 'CLAUDE.md'].flatMap((name) => {
      try {
        return [[name, readFileSync(join(root, name), 'utf8')]];
      } catch {
        return [];
      }
    }),
  );

/** The sets as one sentence part: `CLAUDE.md, which imports AGENTS.md; ...`. */
export const describeSets = (sets: string[][]): string =>
  sets.map(([entry, ...imported]) => (imported.length === 0 ? entry : `${entry}, which imports ${imported.join(' and ')}`)).join('; ');
