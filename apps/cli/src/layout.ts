import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * What a repository's documentation layout looks like, read the same way by `binn init` and
 * `binn audit` (spec stories 24 to 27 and 47). Reads files; writes nothing.
 */

export const ISSUE_TRACKER = 'docs/agents/issue-tracker.md';

/** The convention files `/setup-matt-pocock-skills` writes. Any of them present is the layout. */
export const MATT_POCOCK_FILES = [ISSUE_TRACKER, 'docs/agents/triage-labels.md', 'docs/agents/domain.md'];

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

/** The agent instruction files present at the root, by name, with their text; input to `instructionSets`. */
export const instructionFiles = (root: string): Record<string, string> =>
  Object.fromEntries(
    ['AGENTS.md', 'CLAUDE.md'].filter((name) => existsSync(join(root, name))).map((name) => [name, readFileSync(join(root, name), 'utf8')]),
  );
