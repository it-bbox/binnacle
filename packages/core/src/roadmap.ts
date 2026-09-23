import type { Diagnostic, TrackerTask } from './tracker.ts';

/**
 * The roadmap of a project on the local Markdown tracker (ADR-0017), whose format is a
 * contract: one table headed `# | Epic | Status | Spec`, and a `## Current focus` section.
 * It is parsed strictly. A row that does not parse is reported and left out, never
 * repaired, because a guessed position is worse than a missing one.
 */

/** The status vocabulary, in the order an epic moves through it. */
export const ROADMAP_STATUSES = ['not started', 'spec', 'tickets', 'in progress', 'done'] as const;
export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export type Epic = {
  number: number;
  title: string;
  status: RoadmapStatus;
  /** The spec slug from `specs/<slug>/spec.md`; null for `—`. */
  spec: string | null;
};

export type Roadmap = {
  epics: Epic[];
  /** `## Current focus` as written, trimmed; null when the section is not there. */
  focus: string | null;
  /** Every other `##` heading, in order. */
  sections: string[];
};

const HEADER = ['#', 'Epic', 'Status', 'Spec'];
const SEPARATOR = /^\|?(\s*:?-+:?\s*\|)*\s*:?-+:?\s*\|?$/;
const SPEC_LINK = /^\[[^\]]*\]\(specs\/([^/()\s]+)\/spec\.md\)$/;
const FOCUS = 'Current focus';

export function parseRoadmap(text: string): { roadmap: Roadmap; diagnostics: Diagnostic[] } {
  const lines = text.split(/\r?\n/);
  const diagnostics: Diagnostic[] = [];

  // The focus runs from its heading to the next heading of its level or above.
  let focus: string[] | null = null;
  let inFocus = false;
  const sections: string[] = [];
  for (const line of lines) {
    const heading = /^(#{1,2})\s+(.*?)\s*$/.exec(line);
    if (heading) {
      inFocus = heading[1] === '##' && heading[2] === FOCUS && focus === null;
      if (inFocus) focus = [];
      else if (heading[1] === '##') sections.push(heading[2]!);
    } else if (inFocus) {
      focus!.push(line);
    }
  }
  if (focus === null) {
    diagnostics.push({ code: 'roadmap.focus_missing', message: `The roadmap has no "## ${FOCUS}" section.` });
  }

  const header = lines.findIndex((line) => sameCells(cells(line), HEADER));
  const epics: Epic[] = [];
  if (header === -1 || !SEPARATOR.test(lines[header + 1]?.trim() ?? '')) {
    diagnostics.push({ code: 'roadmap.table_missing', message: `The roadmap has no table headed "| ${HEADER.join(' | ')} |".` });
  } else {
    for (let index = header + 2; index < lines.length && lines[index]!.trim().startsWith('|'); index++) {
      const parsed = parseRow(cells(lines[index]!)!);
      if (typeof parsed === 'string') {
        diagnostics.push({ code: 'roadmap.row_invalid', message: `Roadmap line ${index + 1} is left out: ${parsed}.` });
      } else {
        epics.push(parsed);
      }
    }
  }

  return { roadmap: { epics, focus: focus === null ? null : focus.join('\n').trim(), sections }, diagnostics };
}

/** An epic, or why the row is not one. */
function parseRow(row: string[]): Epic | string {
  if (row.length !== HEADER.length) return `it has ${row.length} cells, not ${HEADER.length}`;
  const [number, title, status, spec] = row as [string, string, string, string];
  if (!/^\d+$/.test(number)) return `# ${JSON.stringify(number)} is not a number`;
  if (title === '') return 'its Epic cell is empty';
  if (!(ROADMAP_STATUSES as readonly string[]).includes(status)) {
    return `Status ${JSON.stringify(status)} is not one of ${ROADMAP_STATUSES.map((value) => `"${value}"`).join(', ')}`;
  }
  const link = SPEC_LINK.exec(spec);
  if (spec !== '—' && !link) return `Spec ${JSON.stringify(spec)} is neither "—" nor a link to specs/<slug>/spec.md`;
  return { number: Number(number), title, status: status as RoadmapStatus, spec: link ? link[1]! : null };
}

/** The cells of a table row, or null for a line that is not one. */
function cells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return null;
  return trimmed.replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

const sameCells = (row: string[] | null, expected: string[]): boolean =>
  row !== null && row.length === expected.length && row.every((cell, index) => cell === expected[index]);

/**
 * Where the roadmap and the tickets disagree, and where an epic that has been specified
 * cannot be followed to its spec. An epic reaches its Tasks through its spec slug: on the
 * local Markdown tracker a Task's identity is `<spec-slug>/<NN>`.
 *
 * Deterministic only. Nothing here judges how long something has taken or whether a
 * branch was merged; those checks produce false positives, and a noisy list gets ignored.
 */
export function roadmapAttention(epics: Epic[], tasks: TrackerTask[]): Diagnostic[] {
  const attention: Diagnostic[] = [];
  const rank = (status: RoadmapStatus): number => ROADMAP_STATUSES.indexOf(status);
  const finished = (task: TrackerTask): boolean => task.state === 'DONE' || task.state === 'CANCELLED';

  for (const epic of epics) {
    const name = `Epic ${epic.number} (${epic.title})`;
    if (epic.spec === null) {
      if (rank(epic.status) >= rank('spec')) {
        attention.push({ code: 'roadmap.spec_missing', message: `${name} is at "${epic.status}" on the roadmap, but its Spec cell is "—".` });
      }
      continue;
    }

    const own = tasks.filter((task) => task.id.startsWith(`${epic.spec}/`));
    const mismatch = (message: string): void => void attention.push({ code: 'roadmap.status_mismatch', message: `${name} ${message}` });
    if (epic.status === 'done') {
      const open = own.filter((task) => !finished(task)).map((task) => task.id);
      if (open.length > 0) mismatch(`is "done" on the roadmap, but these tickets are not DONE or CANCELLED: ${open.join(', ')}.`);
    } else if (epic.status === 'not started') {
      if (own.length > 0) mismatch(`is "not started" on the roadmap, but its spec ${epic.spec} already has ${own.length} ticket${own.length === 1 ? '' : 's'}.`);
    } else if ((epic.status === 'tickets' || epic.status === 'in progress') && own.length > 0 && own.every(finished)) {
      mismatch(`is "${epic.status}" on the roadmap, but every ticket of ${epic.spec} is DONE or CANCELLED.`);
    }
  }
  return attention;
}
