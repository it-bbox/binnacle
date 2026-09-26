import type { ObservedRun } from './domain.ts';
import { boardColumn, startCommand, type Diagnostic, type ResolvedTask, type TrackerTask } from './tracker.ts';

/**
 * The roadmap of a project, `<knowledge.docs>/roadmap.md` whatever its tracker (ADR-0025),
 * whose format is a contract: one table headed `# | Epic | Status | Spec`, and a `## Current focus` section.
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
 * cannot be followed to its spec. An epic reaches its Tasks through the spec slug each Task
 * carries, never through the shape of its identity, so every tracker is checked alike.
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

    const own = tasks.filter((task) => task.specSlug === epic.spec);
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

/** The roadmap's Next action (ADR-0032): what the focus says to do, and the command the owner types to do it. */
export type NextAction = { description: string; command: string };

const NEXT_ACTION = /^Next action:([\s\S]*?)(?<!`)`([^`]+)`$/;

/**
 * The Next action, read from the focus's last paragraph when that paragraph starts with
 * `Next action:` and ends with an inline code span: the span is the command, and the text
 * between them the description, whose own code spans stay text. Null otherwise.
 */
export function nextAction(focus: string | null): NextAction | null {
  const last = focus?.split(/\n[ \t]*\n/).map((paragraph) => paragraph.trim()).filter(Boolean).at(-1);
  const match = last === undefined ? null : NEXT_ACTION.exec(last);
  const command = match?.[2]!.trim();
  if (!match || !command) return null;
  return { description: match[1]!.replace(/\s*\n\s*/g, ' ').trim(), command };
}

/**
 * `next_action.missing` when the roadmap has no focus or its focus does not end with a Next
 * action, and `next_action.stale` when the Next action's command names a `DONE` or `CANCELLED`
 * Task: one of its words is the Task's ticket path, issue URL or id, which is `#<number>` on a
 * remote tracker. Only a roadmap that was read is checked; `tasks` null checks no staleness.
 */
export function nextActionAttention(roadmap: Roadmap, tasks: TrackerTask[] | null): Diagnostic[] {
  const next = nextAction(roadmap.focus);
  if (next === null) {
    const where = roadmap.focus === null ? 'The roadmap has no current focus' : "The current focus's last paragraph";
    return [
      {
        code: 'next_action.missing',
        message: `${where} does not end with a Next action: a paragraph that starts with "Next action:" and ends with the command in backticks.`,
      },
    ];
  }
  const words = next.command.split(/\s+/);
  const named = (tasks ?? []).filter((task) => (task.state === 'DONE' || task.state === 'CANCELLED') && words.some((word) => word === task.id || word === task.ticket));
  if (named.length === 0) return [];
  return [
    {
      code: 'next_action.stale',
      message: `The Next action's command, ${next.command}, names finished work: ${named.map((task) => `${task.id} (${task.ticket}) is ${task.state}`).join(', ')}.`,
    },
  ];
}

/** Binnacle's Suggested step (ADR-0032): its own reading of what comes next, beside the Next action and never replacing it. */
export type SuggestedStep = {
  /** Which of the eight rules gave it. */
  rule: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  description: string;
  /** Null when the step has none, and under any `workflow.provider` but `matt-pocock`. */
  command: string | null;
  /** The Task it names, if it names one. */
  task: string | null;
  provenance: 'calculated';
};

/**
 * The Suggested step, by the first of eight rules that applies; null when none does, as without
 * a roadmap and with no Task in progress. The current epic is the first not `done`. Only an
 * implementation run makes a Task worked on: a Product session's own run never does. Its
 * commands are the Matt Pocock chain's and the `binnacle` plugin's, so any other workflow gets
 * the description alone.
 */
export function suggestedStep(
  epics: Epic[],
  tasks: ResolvedTask[],
  runs: Pick<ObservedRun, 'taskId' | 'role' | 'lastActivityAt' | 'active'>[],
  workflow: string | null,
): SuggestedStep | null {
  const step = (rule: SuggestedStep['rule'], description: string, command: string | null = null, task: string | null = null): SuggestedStep => ({
    rule,
    description,
    command: workflow === 'matt-pocock' ? command : null,
    task,
    provenance: 'calculated',
  });
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const name = (id: string): string => {
    const title = byId.get(id)?.title;
    return title ? `${id} (${title})` : id;
  };

  const working = [...runs]
    .filter((run) => run.role === 'implementation' && run.active.value && run.taskId !== null)
    .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : a.lastActivityAt > b.lastActivityAt ? -1 : 0));
  const worked = [...new Set(working.map((run) => run.taskId!))];
  if (worked.length > 0) {
    const [is, it] = worked.length === 1 ? ['is', 'it'] : ['are', 'them'];
    const description = `${worked.map(name).join(', ')} ${is} being worked on: an implementation run is active. Wait for ${it} rather than start something on top.`;
    // The Task with the latest activity.
    return step(1, description, null, worked[0]!);
  }

  const attributed = new Set(runs.map((run) => run.taskId));
  const idle = tasks.find((task) => boardColumn(task.state, attributed.has(task.id))?.column === 'inProgress');
  if (idle) return step(2, `${name(idle.id)} is in progress, and no run of it is active. Resume it.`, startCommand(idle, workflow), idle.id);

  const epic = epics.find((row) => row.status !== 'done');
  if (epic === undefined) return epics.length > 0 ? step(8, 'Every epic on the roadmap is done.') : null;
  const epicName = `Epic ${epic.number} (${epic.title})`;
  const own = epic.spec === null ? [] : tasks.filter((task) => task.specSlug === epic.spec);
  const ready = own.filter((task) => task.state === 'READY');

  if ((epic.status === 'tickets' || epic.status === 'in progress') && ready.some((task) => task.unmetDependencies.length === 0)) {
    return step(3, `${epicName} has Tasks ready to start. Run its remaining tickets.`, '/binnacle:autopilot');
  }
  if (ready.length > 0 && ready.every((task) => task.unmetDependencies.length > 0)) {
    const waits = ready.map((task) => `${task.id} waits on ${task.unmetDependencies.join(', ')}`).join('; ');
    return step(4, `No Task of ${epicName} can start: every READY one waits on an Unmet dependency. ${waits}.`);
  }
  if (own.length > 0 && own.every((task) => task.state === 'DONE' || task.state === 'CANCELLED')) {
    return step(5, `Every Task of ${epicName} is DONE or CANCELLED, but the epic is not marked done. Close it in a Product session.`, '/binnacle:product');
  }
  if (epic.status === 'not started') return step(6, `${epicName} is not started. Grill it.`, '/mattpocock-skills:grill-with-docs');
  if (epic.status === 'spec' && epic.spec === null) return step(7, `${epicName} needs its spec.`, '/mattpocock-skills:to-spec');
  if (epic.status === 'spec' || (epic.status === 'tickets' && own.length === 0)) return step(7, `${epicName} needs its tickets.`, '/mattpocock-skills:to-tickets');
  return null;
}
