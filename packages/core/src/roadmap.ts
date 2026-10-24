import type { ObservedRun } from './domain.ts';
import { pairRisk, type Impact } from './impact.ts';
import { boardColumn, startCommand, type Diagnostic, type ResolvedTask, type TrackerTask } from './tracker.ts';
import type { Coded, Params } from './wording.ts';

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
    diagnostics.push({ code: 'roadmap.focus_missing', message: `The roadmap has no "## ${FOCUS}" section.`, params: {} });
  }

  const header = lines.findIndex((line) => sameCells(cells(line), HEADER));
  const epics: Epic[] = [];
  if (header === -1 || !SEPARATOR.test(lines[header + 1]?.trim() ?? '')) {
    diagnostics.push({ code: 'roadmap.table_missing', message: `The roadmap has no table headed "| ${HEADER.join(' | ')} |".`, params: {} });
  } else {
    for (let index = header + 2; index < lines.length && lines[index]!.trim().startsWith('|'); index++) {
      const parsed = parseRow(cells(lines[index]!)!);
      if ('why' in parsed) {
        diagnostics.push({ code: 'roadmap.row_invalid', message: `Roadmap line ${index + 1} is left out: ${parsed.why}.`, params: { line: index + 1, ...parsed.params } });
      } else {
        epics.push(parsed);
      }
    }
  }

  return { roadmap: { epics, focus: focus === null ? null : focus.join('\n').trim(), sections }, diagnostics };
}

/** An epic, or why the row is not one, with the values that say it. */
function parseRow(row: string[]): Epic | { why: string; params: Params } {
  if (row.length !== HEADER.length) return { why: `it has ${row.length} cells, not ${HEADER.length}`, params: { kind: 'cells', cells: row.length, expected: HEADER.length } };
  const [number, title, status, spec] = row as [string, string, string, string];
  if (!/^\d+$/.test(number)) return { why: `# ${JSON.stringify(number)} is not a number`, params: { kind: 'number', value: number } };
  if (title === '') return { why: 'its Epic cell is empty', params: { kind: 'title' } };
  if (!(ROADMAP_STATUSES as readonly string[]).includes(status)) {
    const allowed = ROADMAP_STATUSES.map((value) => `"${value}"`).join(', ');
    return { why: `Status ${JSON.stringify(status)} is not one of ${allowed}`, params: { kind: 'status', value: status, allowed } };
  }
  const link = SPEC_LINK.exec(spec);
  if (spec !== '—' && !link) return { why: `Spec ${JSON.stringify(spec)} is neither "—" nor a link to specs/<slug>/spec.md`, params: { kind: 'spec', value: spec } };
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

/** How far along a status is: its place in the vocabulary. */
const rank = (status: RoadmapStatus): number => ROADMAP_STATUSES.indexOf(status);

/** A Task no further work moves. */
const finished = (task: TrackerTask): boolean => task.state === 'DONE' || task.state === 'CANCELLED';

/**
 * Where the roadmap and the tickets disagree, where an epic that has been specified
 * cannot be followed to its spec, and which of `specs`, each a `spec.md` by its slug and path,
 * no row links. An epic reaches its Tasks through the spec slug each Task
 * carries, never through the shape of its identity, so every tracker is checked alike.
 *
 * Deterministic only. Nothing here judges how long something has taken or whether a
 * branch was merged; those checks produce false positives, and a noisy list gets ignored.
 */
export function roadmapAttention(epics: Epic[], tasks: TrackerTask[], specs: { slug: string; path: string }[]): Diagnostic[] {
  const attention: Diagnostic[] = [];

  for (const epic of epics) {
    const name = `Epic ${epic.number} (${epic.title})`;
    if (epic.spec === null) {
      // A `done` epic without a spec is history, often older than Binnacle, not missing work.
      if (rank(epic.status) >= rank('spec') && epic.status !== 'done') {
        attention.push({ code: 'roadmap.spec_missing', message: `${name} is at "${epic.status}" on the roadmap, but its Spec cell is "—".`, params: { epic: epic.number, title: epic.title, status: epic.status } });
      }
      continue;
    }

    const own = tasks.filter((task) => task.specSlug === epic.spec);
    const mismatch = (message: string, params: Params): void =>
      void attention.push({ code: 'roadmap.status_mismatch', message: `${name} ${message}`, params: { epic: epic.number, title: epic.title, ...params } });
    if (epic.status === 'done') {
      const open = own.filter((task) => !finished(task)).map((task) => task.id);
      if (open.length > 0) mismatch(`is "done" on the roadmap, but these tickets are not DONE or CANCELLED: ${open.join(', ')}.`, { kind: 'done', tasks: open.join(', ') });
    } else if (epic.status === 'not started') {
      if (own.length > 0) {
        mismatch(`is "not started" on the roadmap, but its spec ${epic.spec} already has ${own.length} ticket${own.length === 1 ? '' : 's'}.`, { kind: 'not_started', spec: epic.spec, count: own.length });
      }
    } else if ((epic.status === 'tickets' || epic.status === 'in progress') && own.length > 0 && own.every(finished)) {
      mismatch(`is "${epic.status}" on the roadmap, but every ticket of ${epic.spec} is DONE or CANCELLED.`, { kind: 'finished', status: epic.status, spec: epic.spec });
    }
  }
  for (const { slug, path } of specs) {
    if (!epics.some((epic) => epic.spec === slug)) attention.push({ code: 'roadmap.spec_unlisted', message: `${path} is a spec no roadmap row links.`, params: { path } });
  }
  return attention;
}

/** The roadmap's Next action (ADR-0032): what the focus says to do, and the command the owner types to do it. */
export type NextAction = { description: string; command: string };

const NEXT_ACTION = /^Next action:([\s\S]*?)(?<!`)`([^`]+)`$/;

/** Autopilot's command: the plugin's skill, or the package's copy as another harness names it, with or without its prefix. */
const AUTOPILOT = /^(\/binnacle:autopilot|[$/]?binnacle-autopilot)$/;

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
 * remote tracker. It is stale too when the command runs autopilot (`/binnacle:autopilot` or
 * `binnacle-autopilot`) on an epic, by number or spec slug, whose spec has tickets and none left
 * for an agent: every one `DONE`, `CANCELLED` or `ready-for-human`. Only a roadmap that was read
 * is checked; `tasks` null checks no staleness.
 */
export function nextActionAttention(roadmap: Roadmap, tasks: TrackerTask[] | null): Diagnostic[] {
  const next = nextAction(roadmap.focus);
  if (next === null) {
    const where = roadmap.focus === null ? 'The roadmap has no current focus' : "The current focus's last paragraph";
    return [
      {
        code: 'next_action.missing',
        message: `${where} does not end with a Next action: a paragraph that starts with "Next action:" and ends with the command in backticks.`,
        params: { kind: roadmap.focus === null ? 'focus' : 'paragraph' },
      },
    ];
  }
  // ponytail: whole words only, so a path written in quotes, from `./` or with trailing punctuation
  // is not matched; the start command writes the ticket as the tracker gives it. Normalise words if
  // hand-written commands miss a stale focus in practice.
  const words = next.command.split(/\s+/);
  const why: string[] = [];
  const params: Params = { command: next.command };
  const named = (tasks ?? []).filter((task) => finished(task) && words.some((word) => word === task.id || word === task.ticket));
  if (named.length > 0) {
    why.push(`names finished work: ${named.map((task) => `${task.id} (${task.ticket}) is ${task.state}`).join(', ')}`);
    params.tasks = named.map((task) => `${task.id} (${task.ticket})`).join(', ');
  }
  // ponytail: the epic is the second word, exactly its number or spec slug as autopilot's argument
  // takes it; read `02`, `#2` or `epic 2` too if a hand-written Next action ever spells it so.
  const epic = AUTOPILOT.test(words[0]!) ? roadmap.epics.find((row) => row.spec !== null && (String(row.number) === words[1] || row.spec === words[1])) : undefined;
  const own = epic === undefined ? [] : (tasks ?? []).filter((task) => task.specSlug === epic.spec);
  if (epic !== undefined && own.length > 0 && own.every((task) => finished(task) || task.triage === 'ready-for-human')) {
    const human = own.filter((task) => !finished(task)).map((task) => `${task.id} is ready-for-human`);
    why.push(`runs Epic ${epic.number} (${epic.title}), but no ticket of ${epic.spec} is left for an agent: every one is DONE, CANCELLED or ready-for-human${human.length > 0 ? `, and ${human.join(', ')}` : ''}`);
    Object.assign(params, { epic: epic.number, title: epic.title, spec: epic.spec! });
    const ready = own.filter((task) => !finished(task)).map((task) => task.id);
    if (ready.length > 0) params.human = ready.join(', ');
  }
  if (why.length === 0) return [];
  return [{ code: 'next_action.stale', message: `The Next action's command, ${next.command}, ${why.join('; it also ')}.`, params }];
}

/**
 * The current epic: the one furthest along, the first at the furthest status present in the
 * order `in progress`, `tickets`, `spec`, `not started`, the roadmap's order deciding between
 * equals; never a `done` one, so null when there is no epic or every one is done.
 */
export const currentEpic = <E extends Epic>(epics: E[]): E | null =>
  epics.filter((epic) => epic.status !== 'done').reduce<E | null>((best, epic) => (best === null || rank(epic.status) > rank(best.status) ? epic : best), null);

/** The Suggested step's alternatives, at most this many. */
const ALTERNATIVE_LIMIT = 3;

/**
 * One of the Suggested step's alternatives (ADR-0032): Binnacle's own reading of a way to go on,
 * beside the Next action and never replacing it. `description` is the English one, for the skills
 * and MCP; `params` holds the values it names, which core words in Russian (`alternativeMessage`).
 */
export type Alternative = {
  kind: 'wait' | 'parallel' | 'resume' | 'autopilot' | 'byHand' | 'owner' | 'blocked' | 'close' | 'plan' | 'finished';
  /** The Task ids it names, if it names any. */
  tasks: string[];
  /**
   * What the description names: one Task as `task` or several as `tasks`, each `<id> (<title>)`;
   * the epic's `epic` and `title`; a `blocked` one's `waits`, each READY Task with its Unmet
   * dependencies in brackets, joined by `; `; and a `plan` one's `need`: `epics`, `grilling`, `spec` or `tickets`.
   */
  params: Params;
  /** Null when it has none; a Matt Pocock Skills command is null under any `workflow.provider` but `matt-pocock`. */
  command: string | null;
  description: string;
  provenance: 'calculated';
};

/** An alternative as a message to word: its kind and params under one code, its description the English. */
export const alternativeMessage = ({ kind, params, description }: Alternative): Coded => ({ code: 'next.alternative', message: description, params: { ...params, kind } });

/** What the Suggested step reads of a run: its Task, its role, and whether and when it was last active. */
type RunReading = Pick<ObservedRun, 'taskId' | 'role' | 'lastActivityAt' | 'active'>;

/**
 * The Suggested step as alternatives, by the first of eight rules that applies; none when no rule
 * does, as without a roadmap and with no Task in progress. The current epic is `currentEpic`'s.
 * Only an implementation run makes a Task worked on, and only a Task the board places In progress:
 * a Product session's own run never does, nor a run of a Task `DONE`, `MERGED` or `CANCELLED`. The
 * `binnacle` plugin's commands are offered under any workflow; the Matt Pocock chain's, a `plan`
 * alternative's grilling, spec or tickets, only under `matt-pocock` (ADR-0042). A roadmap whose
 * table lists no epic is planned with `/binnacle:roadmap`; `epics` is null without a roadmap.
 * An alternative whose command is the Next action's is left
 * out, since the Next action already offers it. `free` is how many more Tasks the parallel limit
 * allows (the snapshot's `tasks.parallel.free`). A Task triaged `ready-for-human` is the owner's to
 * do, so no alternative hands it to an agent: `parallel`, `autopilot` and `byHand` leave it out, and
 * when it is all the current epic has ready, `owner` names it with no command. With an `impact`,
 * `parallel` names only a Task whose conflict risk with every Task in flight is low; without one,
 * the parallel limit alone decides, as before there was a graph.
 */
export function suggestedStep(
  epics: Epic[] | null,
  tasks: ResolvedTask[],
  runs: RunReading[],
  { workflow, free, next, impact = null }: { workflow: string | null; free: number; next: NextAction | null; impact?: Impact | null },
): Alternative[] {
  return byRule(epics, tasks, runs, workflow, free, impact)
    .filter((item) => next === null || item.command !== next.command)
    .slice(0, ALTERNATIVE_LIMIT);
}

/** The alternatives of the first rule that applies, before any is left out. */
function byRule(epics: Epic[] | null, tasks: ResolvedTask[], runs: RunReading[], workflow: string | null, free: number, impact: Impact | null): Alternative[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const name = (id: string): string => {
    const title = byId.get(id)?.title;
    return title ? `${id} (${title})` : id;
  };
  const alternative = (kind: Alternative['kind'], description: string, params: Params, command: string | null = null, ids: string[] = []): Alternative => ({
    kind,
    tasks: ids,
    params,
    command,
    description,
    provenance: 'calculated',
  });
  /** Ready Tasks as one alternative: one Task with its start command, several named with none, so that no order is implied. */
  /** A Matt Pocock Skills command, offered only under that workflow (ADR-0042). */
  const mattPocock = (command: string): string | null => (workflow === 'matt-pocock' ? command : null);
  /** Tasks named by id and title, as `task` for one and `tasks` for several, so that the wording agrees with the count. */
  const named = (ids: string[]): Params => (ids.length === 1 ? { task: name(ids[0]!) } : { tasks: ids.map(name).join(', ') });
  const take = (kind: 'parallel' | 'byHand', ready: ResolvedTask[], one: string, several: string): Alternative =>
    ready.length === 1
      ? alternative(kind, `${name(ready[0]!.id)} ${one}`, named([ready[0]!.id]), startCommand(ready[0]!), [ready[0]!.id])
      : alternative(kind, `${ready.map((task) => name(task.id)).join(', ')} ${several}`, named(ready.map((task) => task.id)), null, ready.map((task) => task.id));

  const forAgent = (task: ResolvedTask): boolean => task.triage !== 'ready-for-human';
  const attributed = new Set(runs.map((run) => run.taskId));
  const working = runs
    .filter((run) => run.role !== 'product' && run.active.value && run.taskId !== null)
    .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : a.lastActivityAt > b.lastActivityAt ? -1 : 0));
  // Only a Task the board places In progress is waited on: a DONE one's run may outlive its merge,
  // and a run naming no known Task is placed nowhere. Each has a run, so a READY one stands In progress.
  const hasRuns = true;
  // The Task with the latest activity first.
  const worked = [...new Set(working.map((run) => run.taskId!))].filter((id) => boardColumn(byId.get(id)?.state ?? null, hasRuns)?.column === 'inProgress');
  if (worked.length > 0) {
    const [is, it] = worked.length === 1 ? ['is', 'it'] : ['are', 'them'];
    const wait = alternative('wait', `${worked.map(name).join(', ')} ${is} being worked on: an implementation run is active. Wait for ${it} rather than start something on top.`, named(worked), null, worked);
    // Ready to start, as the snapshot lists it: none waits on an Unmet dependency or has a run, so none blocks another.
    // With a graph, only a Task whose risk with every Task in flight is low.
    const inFlight = tasks.filter((task) => boardColumn(task.state, attributed.has(task.id))?.column === 'inProgress');
    const lowRisk = (task: ResolvedTask): boolean => impact === null || inFlight.every((other) => pairRisk(impact, task.id, other.id) === 'low');
    const ready = tasks.filter((task) => boardColumn(task.state, attributed.has(task.id))?.column === 'ready' && task.unmetDependencies.length === 0 && forAgent(task) && lowRisk(task));
    if (free < 1 || ready.length === 0) return [wait];
    return [
      wait,
      take('parallel', ready, `is ready to start and the parallel limit has room: start it beside ${it}.`, `are ready to start, in any order, and the parallel limit has room: start one from Ready to start beside ${it}.`),
    ];
  }

  const idle = tasks.find((task) => boardColumn(task.state, attributed.has(task.id))?.column === 'inProgress');
  if (idle) return [alternative('resume', `${name(idle.id)} is in progress, and no run of it is active. Resume it.`, named([idle.id]), startCommand(idle), [idle.id])];

  if (epics === null) return [];
  if (epics.length === 0) return [alternative('plan', 'The roadmap lists no epic. Propose its epics from the vision.', { need: 'epics' }, '/binnacle:roadmap')];
  const epic = currentEpic(epics);
  if (epic === null) return [alternative('finished', 'Every epic on the roadmap is done.', {})];
  const epicName = `Epic ${epic.number} (${epic.title})`;
  const ofEpic: Params = { epic: epic.number, title: epic.title };
  const own = epic.spec === null ? [] : tasks.filter((task) => task.specSlug === epic.spec);
  const ready = own.filter((task) => task.state === 'READY');
  const startable = ready.filter((task) => task.unmetDependencies.length === 0);

  if ((epic.status === 'tickets' || epic.status === 'in progress') && startable.length > 0) {
    const agentReady = startable.filter(forAgent);
    if (agentReady.length === 0) {
      const [is, it] = startable.length === 1 ? ['is', 'it'] : ['are', 'them'];
      return [alternative('owner', `${startable.map((task) => name(task.id)).join(', ')} ${is} ready to start and triaged ready-for-human: the owner does ${it}, not an agent.`, named(startable.map((task) => task.id)), null, startable.map((task) => task.id))];
    }
    return [
      alternative('autopilot', `${epicName} has Tasks ready to start. Run its remaining tickets.`, ofEpic, '/binnacle:autopilot'),
      take('byHand', agentReady, 'is ready to start. Take it by hand, one ticket at a time.', 'are ready to start, in any order. Take one by hand from Ready to start.'),
    ];
  }
  if (ready.length > 0 && startable.length === 0) {
    const waits = ready.map((task) => `${task.id} waits on ${task.unmetDependencies.join(', ')}`).join('; ');
    const params = { ...ofEpic, waits: ready.map((task) => `${task.id} (${task.unmetDependencies.join(', ')})`).join('; ') };
    return [alternative('blocked', `No Task of ${epicName} can start: every READY one waits on an Unmet dependency. ${waits}.`, params, null, ready.map((task) => task.id))];
  }
  if (own.length > 0 && own.every((task) => task.state === 'DONE' || task.state === 'CANCELLED')) {
    return [alternative('close', `Every Task of ${epicName} is DONE or CANCELLED, but the epic is not marked done. Close it in a Product session.`, ofEpic, '/binnacle:product')];
  }
  if (epic.status === 'not started') return [alternative('plan', `${epicName} is not started. Grill it.`, { need: 'grilling', ...ofEpic }, mattPocock('/mattpocock-skills:grill-with-docs'))];
  if (epic.status === 'spec' && epic.spec === null) return [alternative('plan', `${epicName} needs its spec.`, { need: 'spec', ...ofEpic }, mattPocock('/mattpocock-skills:to-spec'))];
  if (epic.status === 'spec' || (epic.status === 'tickets' && own.length === 0))
    return [alternative('plan', `${epicName} needs its tickets.`, { need: 'tickets', ...ofEpic }, mattPocock('/mattpocock-skills:to-tickets'))];
  return [];
}
