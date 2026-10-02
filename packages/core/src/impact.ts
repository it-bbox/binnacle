/**
 * The impact and conflict analysis beside the parallel limit: which modules each ready or
 * in-flight Task touches, and the conflict risk of running two of them together. Binnacle's
 * calculation from the Graphify graph (ADR-0036), never a fact a tool reported (ADR-0007).
 */

/**
 * The graph as the analysis reads it. A module is a file of the graph: the `source_file` its
 * nodes name. Two modules are neighbours when an edge joins a node of one to a node of the other.
 */
export type ModuleGraph = { modules: string[]; edges: [string, string][] };

/**
 * The graph `graph.json` holds, in NetworkX's node-link form as Graphify writes it (`nodes`, and
 * `links` or `edges`), as modules and the edges between them; null when it is not that form.
 */
export function moduleGraph(json: unknown): ModuleGraph | null {
  if (typeof json !== 'object' || json === null) return null;
  const { nodes, links, edges } = json as { nodes?: unknown; links?: unknown; edges?: unknown };
  const lines = links ?? edges;
  if (!Array.isArray(nodes) || !Array.isArray(lines)) return null;
  const fileOf = new Map<string, string>();
  for (const node of nodes) {
    const { id, source_file: file } = (node ?? {}) as { id?: unknown; source_file?: unknown };
    if ((typeof id === 'string' || typeof id === 'number') && typeof file === 'string' && file !== '') fileOf.set(String(id), file);
  }
  const between: [string, string][] = [];
  for (const line of lines) {
    const { source, target } = (line ?? {}) as { source?: unknown; target?: unknown };
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
      const pair = (risk: ConflictRisk, reason: string, named: string[] = []): void =>
        void pairs.push({ tasks: [a.id, b.id], risk, modules: named, reason, provenance: 'calculated' });
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
