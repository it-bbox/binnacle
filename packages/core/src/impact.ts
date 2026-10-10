/**
 * The impact and conflict analysis beside the parallel limit: which modules each ready or
 * in-flight Task touches, and the conflict risk of running two of them together. Binnacle's
 * calculation from the Graphify graph (ADR-0036), never a fact a tool reported (ADR-0007).
 * Beside it, the roles Binnacle suggests for a Task, from the same touched modules.
 */
import type { Role, TrackerTask } from './tracker.ts';

/**
 * The graph as the analysis reads it. A module is a file of the graph: the `source_file` its
 * nodes name. Two modules are neighbours when an edge joins a node of one to a node of the other.
 */
export type ModuleGraph = { modules: string[]; edges: [string, string][] };

/**
 * The graph `graph.json` holds, in NetworkX's node-link form as Graphify writes it (`nodes`, and
 * `links` or `edges`, as NetworkX has named them), with paths relative to the repository, as modules and the edges between them; null when it is not that form.
 */
export function moduleGraph(json: unknown): ModuleGraph | null {
  if (typeof json !== 'object' || json === null) return null;
  const { nodes, links, edges } = json as { nodes?: unknown; links?: unknown; edges?: unknown };
  const joins = links ?? edges;
  if (!Array.isArray(nodes) || !Array.isArray(joins)) return null;
  const fileOf = new Map<string, string>();
  for (const node of nodes) {
    const { id, source_file: file } = (node ?? {}) as { id?: unknown; source_file?: unknown };
    if ((typeof id === 'string' || typeof id === 'number') && typeof file === 'string' && file !== '') fileOf.set(String(id), file.replace(/^\.\//, ''));
  }
  const between: [string, string][] = [];
  for (const join of joins) {
    const { source, target } = (join ?? {}) as { source?: unknown; target?: unknown };
    const from = fileOf.get(String(source));
    const to = fileOf.get(String(target));
    if (from !== undefined && to !== undefined && from !== to) between.push([from, to]);
  }
  return { modules: [...new Set(fileOf.values())].sort(), edges: between };
}

export type ConflictRisk = 'high' | 'medium' | 'low' | 'unknown';

/** A Task as the analysis takes it: the files its branch changed, or, with no branch, its ticket's text. */
export type TaskTouch = { id: string; files: string[] } | { id: string; text: string };

export type Impact = {
  available: true;
  /** Each Task's modules, sorted, and whether they were read from its branch or its ticket. */
  tasks: { id: string; modules: string[]; from: 'branch' | 'ticket'; provenance: 'calculated' }[];
  /**
   * Each pair's conflict risk: `modules` are the shared ones when high, the neighbouring ones
   * when medium, and none otherwise.
   */
  pairs: { tasks: [string, string]; risk: ConflictRisk; modules: string[]; reason: string; provenance: 'calculated' }[];
  provenance: 'calculated';
};

/**
 * Each Task's modules and each pair's conflict risk. A Task on a branch touches the modules its
 * branch changed; one without, the modules its ticket names by path or by file name, as a whole
 * word. A pair is high when they share a module, medium when a module of one is a neighbour of a
 * module of the other, low otherwise, and unknown when either touches no module of the graph.
 *
 * ponytail: a ticket's name match is the file name alone, so `index.ts` names every `index.ts`;
 * that errs towards a higher risk, never a lower one. Match on more of the path if it is noisy.
 */
export function conflictRisk(graph: ModuleGraph, touches: TaskTouch[]): Impact {
  const modules = new Set(graph.modules);
  const neighbours = new Map<string, Set<string>>();
  const link = (a: string, b: string): void => void neighbours.set(a, (neighbours.get(a) ?? new Set()).add(b));
  for (const [a, b] of graph.edges) {
    link(a, b);
    link(b, a);
  }

  const tasks = touches.map((touch) => {
    const touched = 'files' in touch ? touch.files.filter((file) => modules.has(file)) : named(graph.modules, touch.text);
    return { id: touch.id, modules: [...new Set(touched)].sort(), from: 'files' in touch ? ('branch' as const) : ('ticket' as const), provenance: 'calculated' as const };
  });

  const pairs: Impact['pairs'] = [];
  for (const [index, a] of tasks.entries()) {
    for (const b of tasks.slice(index + 1)) {
      const pair = (risk: ConflictRisk, reason: string, involved: string[] = []): void =>
        void pairs.push({ tasks: [a.id, b.id], risk, modules: involved, reason, provenance: 'calculated' });
      const empty = [a, b].filter((task) => task.modules.length === 0);
      if (empty.length > 0) {
        pair('unknown', `${empty.map((task) => (task.from === 'branch' ? `The branch of ${task.id} changes` : `The ticket of ${task.id} names`) + ' no module of the graph').join('; ')}.`);
        continue;
      }
      const shared = a.modules.filter((module) => b.modules.includes(module));
      if (shared.length > 0) {
        pair('high', `Both touch ${shared.join(', ')}.`, shared);
        continue;
      }
      const near = a.modules.flatMap((x) => b.modules.filter((y) => neighbours.get(x)?.has(y)).map((y) => [x, y] as const));
      if (near.length > 0) {
        pair('medium', `Their modules are neighbours in the graph: ${near.map(([x, y]) => `${x} and ${y}`).join('; ')}.`, [...new Set(near.flat())].sort());
        continue;
      }
      pair('low', 'They share no module, and none of theirs are neighbours in the graph.');
    }
  }
  return { available: true, tasks, pairs, provenance: 'calculated' };
}

/** The risk `impact` gives the pair `a` and `b`, in either order; unknown when it holds no such pair. */
export function pairRisk(impact: Impact, a: string, b: string): ConflictRisk {
  return impact.pairs.find(({ tasks: [x, y] }) => (x === a && y === b) || (x === b && y === a))?.risk ?? 'unknown';
}

/** The modules `text` names by path or by file name, each a whole word, as written in prose, code spans or links. */
function named(modules: string[], text: string): string[] {
  const words = new Set(text.split(/[^\w./-]+/).map((word) => word.replace(/^\.\//, '').replace(/\.+$/, '')));
  return modules.filter((module) => words.has(module) || words.has(module.slice(module.lastIndexOf('/') + 1)));
}

/**
 * The roles a Task needs: those its `Roles:` line names, or Developer and Reviewer without one,
 * and beside them the roles Binnacle suggests, each with its reason, as its calculation. A
 * suggestion never changes the line (ADR-0032).
 */
export type TaskRoles = {
  required: Role[];
  source: 'ticket' | 'default';
  suggested: { role: Role; reason: string; provenance: 'calculated' }[];
};

export const DEFAULT_ROLES: Role[] = ['Developer', 'Reviewer'];
/** ponytail: a fixed threshold; make it a manifest setting if it proves noisy. */
export const ARCHITECT_MODULES = 8;
const SECURITY_WORDS = ['auth', 'token', 'secret', 'credential', 'password', 'permission', 'oauth'];

/**
 * `task`'s roles, with the suggestions read from `touched`, its modules as the conflict risk
 * reads them (`Impact['tasks']`), or null without a graph: an Architect when it touches at least
 * `ARCHITECT_MODULES` modules; Security when a touched module's path or the ticket's title and
 * body hold one of `SECURITY_WORDS`, or its plural, or `.env`, as a word or path segment. A role
 * the line names is not suggested.
 */
export function taskRoles(
  task: Pick<TrackerTask, 'roles' | 'title' | 'body'>,
  touched: Pick<Impact['tasks'][number], 'modules' | 'from'> | null,
): TaskRoles {
  const required = task.roles ?? DEFAULT_ROLES;
  const suggested: TaskRoles['suggested'] = [];
  const suggest = (role: Role, reason: string): void => {
    if (!required.includes(role)) suggested.push({ role, reason, provenance: 'calculated' });
  };

  if (touched !== null && touched.modules.length >= ARCHITECT_MODULES) {
    const by = touched.from === 'branch' ? 'Its branch changes' : 'Its ticket names';
    suggest('Architect', `${by} ${touched.modules.length} modules of the graph; ${ARCHITECT_MODULES} or more call for an Architect.`);
  }
  const matched = [
    ...(touched?.modules ?? []).flatMap((module) => securityWords(module).map((word) => `${word} in ${module}`)),
    ...securityWords(`${task.title ?? ''}\n${task.body}`).map((word) => `${word} in the ticket's text`),
  ];
  if (matched.length > 0) suggest('Security', `It touches secrets or authentication: ${matched.join('; ')}.`);
  return { required, source: task.roles === null ? 'default' : 'ticket', suggested };
}

/** The security words `text` holds as words, each once, in `SECURITY_WORDS`' order, then `.env`. */
function securityWords(text: string): string[] {
  const words = new Set(text.toLowerCase().split(/[^a-z0-9]+/));
  const found = SECURITY_WORDS.filter((word) => words.has(word) || words.has(`${word}s`));
  return /(?:^|[^\w.])\.env(?!\w)/i.test(text) ? [...found, '.env'] : found;
}
