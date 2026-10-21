import { posix } from 'node:path';
import { blockedByNumbers, headerRoles, isTaskState, parseTicketHeader, ticketBody, unquote, type Diagnostic, type Question, type TaskReading, type TrackerTask } from '@binnacle/core';
import type { Tree } from './tree.ts';

/**
 * The local Markdown tracker (ADR-0017): every `<issues>/<spec-slug>/issues/NN-<slug>.md`
 * is a Task. It is read on every call and never cached, so an edit to a ticket shows in
 * the next answer, and it only ever reads.
 *
 * The ticket header is read through the parser every tracker shares — `Status:`, `Triage:`,
 * `Blocked by:`, `Spec:`, `Roles:` — and the body after it up to `## Comments`. Of the comments, which
 * are for the session to read, only the Review and the questions are read (`ticketComments`).
 *
 * `issues` is relative to the tree, as the manifest declares it. The tree is the working
 * tree for the snapshot, and a commit for the daily delta.
 */
export async function readLocalTasks(tree: Tree, issues: string): Promise<TaskReading> {
  const specs = (await tree.list(issues))?.filter((entry) => entry.directory).map((entry) => entry.name) ?? null;
  if (specs === null) {
    return {
      tasks: [],
      diagnostics: [{ code: 'tracker.issues_missing', message: `tracker.local.issues names ${issues}, which is not a directory.`, params: { path: issues } }],
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
  const { heading, status, blockedBy, spec: specLine, triage, roles } = parseTicketHeader(text);
  const id = identity(spec, TICKET_FILE.exec(file)![1]!);
  if (status === null || !isTaskState(status)) {
    diagnostics.push({
      code: 'task.unknown_state',
      message:
        status === null
          ? `${id} (${ticket}) has no Status: line.`
          : `${id} (${ticket}) has Status: ${JSON.stringify(status)}, which is not a Task state.`,
      params: status === null ? { task: id, ticket } : { task: id, ticket, status },
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
    ...ticketComments(text),
    roles: headerRoles(roles, { id, ticket }, diagnostics),
  };
}

const COMMENTS = /^## +Comments[ \t\r]*$/m;
const SECTION = /^### +(Review|Question|Answer)[ \t]*$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]|$)/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;

/**
 * What the ticket's `## Comments` record. The Review: the text under the first `### Review`;
 * null when there is none, or it is empty. The questions (ADR-0040): each `### Question`, with
 * the text of the first non-empty `### Answer` after it and before the next Question, or null, as
 * `addQuestionOrAnswer` reads them; an Answer with no Question before it is left out. Each section runs to the next heading of level three or
 * above, and its text is without the blank lines around it. A line inside a code fence is never a
 * heading: a fence closes only with a run of its own character at least as long as the one that
 * opened it.
 */
export function ticketComments(text: string): { review: string | null; questions: Question[] } {
  let comments = false;
  let fence: string | null = null;
  // Undefined until the first Review, which alone is read.
  let review: string | null | undefined;
  const questions: Question[] = [];
  let section: { kind: string; lines: string[] } | null = null;
  const close = (): void => {
    if (section === null) return;
    const body = sectionText(section.lines.join('\n'));
    if (section.kind !== 'Review') addQuestionOrAnswer(questions, section.kind as 'Question' | 'Answer', body);
    else if (review === undefined) review = body || null;
    section = null;
  };
  for (const line of text.split(/\r?\n/)) {
    // A fence line is never a heading either, so the fence can open or close before the test below.
    const run = FENCE.exec(line)?.[1];
    if (run !== undefined && fence === null) fence = run;
    else if (run !== undefined && run[0] === fence![0] && run.length >= fence!.length) fence = null;
    const level = fence !== null ? 0 : (HEADING.exec(line)?.[1]!.length ?? 0);
    if (level >= 1 && level <= 3) close();
    if (level === 1 || level === 2) comments = COMMENTS.test(line);
    else if (level === 3) {
      const kind = comments ? SECTION.exec(line)?.[1] : undefined;
      if (kind !== undefined) section = { kind, lines: [] };
    } else section?.lines.push(line);
  }
  close();
  return { review: review ?? null, questions };
}

/** A section's text without the blank lines around it. */
export const sectionText = (text: string): string => text.replace(/^(?:[ \t]*\n)+/, '').trimEnd();

/** An Answer's first line when it is a date alone, as `/binnacle:answer` writes above the owner's words; read off every Answer, on every tracker. */
const DATE_LINE = /^\d{4}-\d{2}-\d{2}[ \t]*(?:\n|$)/;

/**
 * Adds a section to `questions`, in order: a Question, its options part of its text, or an Answer
 * to the last Question while it has none, without a first line that is a date alone. An empty
 * Answer, or one that is a date alone, answers nothing, and an Answer with no Question before it is left out.
 */
export function addQuestionOrAnswer(questions: Question[], kind: 'Question' | 'Answer', text: string): void {
  const last = questions.at(-1);
  if (kind === 'Question') questions.push({ text, answer: null });
  else if (last !== undefined && last.answer === null) last.answer = sectionText(text.replace(DATE_LINE, '')) || null;
}
