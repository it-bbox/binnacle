import { posix } from 'node:path';
import { isTaskState, type Diagnostic, type TaskReading, type TrackerTask } from '@binnacle/core';
import type { Tree } from './tree.ts';

/**
 * The local Markdown tracker (ADR-0017): every `<issues>/<spec-slug>/issues/NN-<slug>.md`
 * is a Task. It is read on every call and never cached, so an edit to a ticket shows in
 * the next answer, and it only ever reads.
 *
 * Only the header lines under the first heading are read — `Status:`, `Triage:`,
 * `Blocked by:`, `Spec:`. The body and `## Comments` are for the session to read.
 *
 * `issues` is relative to the tree, as the manifest declares it. The tree is the working
 * tree for the snapshot, and a commit for the daily delta.
 */
export async function readLocalTasks(tree: Tree, issues: string): Promise<TaskReading> {
  const specs = (await tree.list(issues))?.filter((entry) => entry.directory).map((entry) => entry.name) ?? null;
  if (specs === null) {
    return {
      tasks: [],
      diagnostics: [{ code: 'tracker.issues_missing', message: `tracker.local.issues names ${issues}, which is not a directory.` }],
    };
  }

  const tasks: TrackerTask[] = [];
  const diagnostics: Diagnostic[] = [];
  // Plain code-unit order rather than locale order, so the same files give the same answer anywhere.
  for (const spec of specs.sort()) {
    const dir = posix.join(issues, spec, 'issues');
    const files = ((await tree.list(dir)) ?? [])
      .filter((entry) => !entry.directory && TICKET_FILE.test(entry.name))
      .map((entry) => entry.name)
      // By ticket number, so `9-…` comes before `10-…`; the name breaks a tie.
      .sort((a, b) => ticketNumber(a) - ticketNumber(b) || (a < b ? -1 : a > b ? 1 : 0));
    const texts = await Promise.all(files.map((file) => tree.read(posix.join(dir, file))));
    files.forEach((file, index) => {
      tasks.push(parseTicket(spec, file, posix.join(dir, file), texts[index] ?? '', diagnostics));
    });
  }
  return { tasks, diagnostics };
}

const TICKET_FILE = /^(\d+)-.*\.md$/;
const HEADER = /^(Status|Triage|Blocked by|Spec):\s*(.*)$/;

const ticketNumber = (file: string): number => Number(TICKET_FILE.exec(file)![1]);

/** `02`, `2` and `002` are one ticket: numbers are compared, and written as `NN`. */
const identity = (spec: string, number: string): string => `${spec}/${String(Number(number)).padStart(2, '0')}`;

function parseTicket(spec: string, file: string, ticket: string, text: string, diagnostics: Diagnostic[]): TrackerTask {
  const lines = text.split(/\r?\n/);
  const heading = lines.findIndex((line) => /^#\s/.test(line));

  // The header block: the first run of non-blank lines after the heading.
  const header = new Map<string, string>();
  let line = heading + 1;
  while (lines[line]?.trim() === '') line++;
  for (; line < lines.length && lines[line]!.trim() !== ''; line++) {
    const match = HEADER.exec(lines[line]!.trim());
    if (match && !header.has(match[1]!)) header.set(match[1]!, match[2]!.trim());
  }

  const id = identity(spec, TICKET_FILE.exec(file)![1]!);
  const status = header.get('Status');
  if (status === undefined || !isTaskState(status)) {
    diagnostics.push({
      code: 'task.unknown_state',
      message:
        status === undefined
          ? `${id} (${ticket}) has no Status: line.`
          : `${id} (${ticket}) has Status: ${JSON.stringify(status)}, which is not a Task state.`,
    });
  }
  return {
    id,
    title: heading === -1 ? null : lines[heading]!.replace(/^#\s+/, '').replace(/^\d+:\s*/, '').trim(),
    state: status !== undefined && isTaskState(status) ? status : null,
    blockedBy: dependencies(spec, header.get('Blocked by') ?? 'None'),
    spec: unquote(header.get('Spec')),
    triage: header.get('Triage') || null,
    ticket,
  };
}

/** `None`, with or without a parenthetical, is no dependencies; numbers name tickets of the same spec. */
function dependencies(spec: string, value: string): string[] {
  if (/^none\b/i.test(value)) return [];
  const numbers = value.replace(/\([^)]*\)/g, '').match(/\d+/g) ?? [];
  return [...new Set(numbers.map((number) => identity(spec, number)))];
}

const unquote = (value: string | undefined): string | null => value?.replace(/^`(.*)`$/, '$1') || null;
