import { posix } from 'node:path';
import { blockedByNumbers, isTaskState, parseTicketHeader, ticketBody, unquote, type Diagnostic, type TaskReading, type TrackerTask } from '@binnacle/core';
import type { Tree } from './tree.ts';

/**
 * The local Markdown tracker (ADR-0017): every `<issues>/<spec-slug>/issues/NN-<slug>.md`
 * is a Task. It is read on every call and never cached, so an edit to a ticket shows in
 * the next answer, and it only ever reads.
 *
 * The ticket header is read through the parser every tracker shares — `Status:`, `Triage:`,
 * `Blocked by:`, `Spec:` — and the body after it up to `## Comments`, which is for the
 * session to read, as are the comments themselves.
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

const ticketNumber = (file: string): number => Number(TICKET_FILE.exec(file)![1]);

/** `02`, `2` and `002` are one ticket: numbers are compared, and written as `NN`. */
const identity = (spec: string, number: string): string => `${spec}/${String(Number(number)).padStart(2, '0')}`;

function parseTicket(spec: string, file: string, ticket: string, text: string, diagnostics: Diagnostic[]): TrackerTask {
  const { heading, status, blockedBy, spec: specLine, triage } = parseTicketHeader(text);
  const id = identity(spec, TICKET_FILE.exec(file)![1]!);
  if (status === null || !isTaskState(status)) {
    diagnostics.push({
      code: 'task.unknown_state',
      message:
        status === null
          ? `${id} (${ticket}) has no Status: line.`
          : `${id} (${ticket}) has Status: ${JSON.stringify(status)}, which is not a Task state.`,
    });
  }
  return {
    id,
    title: heading?.replace(/^\d+:\s*/, '') ?? null,
    state: status !== null && isTaskState(status) ? status : null,
    // Numbers name tickets of the same spec.
    blockedBy: blockedByNumbers(blockedBy).map((number) => identity(spec, String(number))),
    spec: unquote(specLine),
    specSlug: spec,
    triage: triage || null,
    ticket,
    body: ticketBody(text.split(COMMENTS)[0]!),
  };
}

const COMMENTS = /^## +Comments[ \t\r]*$/m;
