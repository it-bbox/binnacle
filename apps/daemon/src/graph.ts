import { spawn, type ChildProcess } from 'node:child_process';
import { accessSync, constants, existsSync, readFileSync, statSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { isIgnored, readBranchCommit, readChangedFiles, readDefaultBranch, readGitFacts } from '@binnacle/adapters';
import {
  conflictRisk,
  moduleGraph,
  taskBranch,
  type Diagnostic,
  type Impact,
  type ModuleGraph,
  type ProjectManifest,
  type TaskTouch,
  type TrackerTask,
} from '@binnacle/core';
import { resolveGitTimeout } from './home.ts';
import { readManifest } from './manifest.ts';
import { readRegistry } from './registry.ts';
import type { Unavailable } from './snapshot.ts';
import type { EventRow, Store } from './store.ts';

/**
 * The daemon keeps each registered project's Graphify graph current (ADR-0036). Once a
 * minute it reads the commit of the project's default branch, and when that has moved past
 * the last recorded run, it runs Graphify's code-only extraction (ADR-0012) in the
 * registered checkout, then its report: one run per project at a time, with at most one queued. Each
 * outcome is an event, which the snapshot's `graph` section reads.
 *
 * The output directory is the only thing the daemon lets write into a repository, and only
 * when Git ignores it; Graphify writes it, never the daemon.
 */
export const GRAPH_DIRECTORY = 'graphify-out';
export const GRAPH_POLL_MS = 60_000;
/** ponytail: a fixed ceiling for one Graphify step, the extract or the report; make it a setting if a real project needs longer. */
export const GRAPH_RUN_TIMEOUT_MS = 10 * 60_000;
/**
 * Graphify's code-only extraction (ADR-0012), run in the repository root: local syntax trees, no API key, no model.
 * `--allow-dedup-shrink` lets it write a graph that deduplication made smaller, which graphify otherwise refuses:
 * the graph is a rebuildable projection (ADR-0036), so a smaller one after a merge is expected, not a loss.
 */
export const GRAPH_EXTRACT = ['extract', '.', '--code-only', '--allow-dedup-shrink'];
/**
 * After a successful extract, the step Graphify names for its `GRAPH_REPORT.md`: clustering of
 * the existing `graph.json`, with `--no-label` so no model names the communities (ADR-0012).
 */
export const GRAPH_CLUSTER = ['cluster-only', '.', '--no-label'];
const BUILT = 'graph.built';
const FAILED = 'graph.failed';
export const GRAPH_FILE = `${GRAPH_DIRECTORY}/graph.json`;

export type GraphSection = {
  /** Whether there is a graph an agent can use; `reason` says why not. */
  available: boolean;
  reason: string | null;
  /** The commit and time of the last successful run. */
  builtFrom: { commit: string; at: string } | null;
  /** Whether the default branch has moved past `builtFrom`; null when its commit cannot be read. */
  behind: boolean | null;
  lastRun: { commit: string; at: string; outcome: 'built' | 'failed'; reason: string | null } | null;
};

/** `searchPath` is where `graphify` is looked for, as `PATH` is read. */
export function startGraphRunner(home: string, store: Store, searchPath: string, pollMs: number): { stop(): Promise<void> } {
  const running = new Map<string, { commit: string; queued: boolean }>();
  const children = new Set<ChildProcess>();
  const settling = new Set<Promise<void>>();
  let stopped = false;
  let ticking: Promise<void> | null = null;

  const lastCommit = (path: string): unknown => store.latestEvent(path, [BUILT, FAILED])?.payload.commit;

  /**
   * The default branch's commit when a run is due for it, or null. A manifest that cannot be
   * read runs nothing, since whether Graphify is declared `false` is then unknown.
   *
   * ponytail: the run reads the working tree, so uncommitted changes in the registered
   * checkout are in a graph recorded as built from the branch's commit; build from the
   * committed tree, as the vault does, if that ever misleads.
   */
  async function due(path: string): Promise<{ commit: string; executable: string } | null> {
    const manifest = manifestOf(path);
    const executable = findExecutable('graphify', searchPath);
    if (manifest === null || manifest.capabilities.graphify === false || executable === null) return null;
    const branch = await defaultBranch(path);
    const commit = await readBranchCommit(path, branch, resolveGitTimeout());
    if (commit === null || commit === lastCommit(path)) return null;
    const [facts, ignored] = await Promise.all([readGitFacts(path, resolveGitTimeout()), isIgnored(path, GRAPH_FILE, resolveGitTimeout())]);
    if (!facts.available || facts.branch !== branch || ignored !== true) return null;
    return { commit, executable };
  }

  async function consider(path: string): Promise<void> {
    const next = await due(path);
    // Decided synchronously from here, so two checks racing never start two runs.
    if (next === null || stopped || next.commit === lastCommit(path)) return;
    const current = running.get(path);
    if (current) {
      if (current.commit !== next.commit) current.queued = true;
      return;
    }
    const run = { commit: next.commit, queued: false };
    running.set(path, run);
    const settled = build(path, next.executable, next.commit)
      .then(() => {
        running.delete(path);
        if (run.queued && !stopped) return consider(path);
      })
      // As a poll's: tried again on the next one, never a stopped daemon.
      .catch((error: unknown) => console.error(error));
    settling.add(settled);
    void settled.finally(() => settling.delete(settled));
  }

  /** One run: the extract, then, if it succeeded, the report; one outcome for both. A failed report keeps the graph the extract wrote. */
  async function build(path: string, executable: string, commit: string): Promise<void> {
    let reason = await step(path, executable, GRAPH_EXTRACT);
    if (reason === null && !stopped) {
      reason = await step(path, executable, GRAPH_CLUSTER);
      if (reason !== null) reason = `graphify ${GRAPH_CLUSTER.join(' ')} failed: ${reason}`;
    }
    // A run the daemon's stop ended is not an outcome of Graphify's.
    if (!stopped) store.appendEvent({ type: reason === null ? BUILT : FAILED, projectPath: path, payload: { commit, reason } });
  }

  /** Runs `graphify` with `args` in `path`; null when it succeeded, or why not. */
  function step(path: string, executable: string, args: string[]): Promise<string | null> {
    return new Promise((resolve) => {
      // In its own process group, so that ending it ends whatever it started too.
      const child = spawn(executable, args, { cwd: path, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true, detached: true });
      children.add(child);
      let stderr = '';
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr = (stderr + chunk).slice(-4096)));
      const timer = setTimeout(() => end(child), GRAPH_RUN_TIMEOUT_MS);
      let finished = false;
      // A spawn that fails emits `error` and then `close`; the first is the outcome.
      const finish = (reason: string | null): void => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        children.delete(child);
        resolve(reason);
      };
      child.on('error', (error) => finish(`graphify could not be run: ${error.message}`));
      child.on('close', (code, signal) => {
        if (code === 0) return finish(null);
        const line = stderr.trim().split('\n').at(-1)?.trim();
        finish(line || (signal ? `graphify was ended by ${signal}.` : `graphify exited with code ${code}.`));
      });
    });
  }

  function tick(): void {
    if (ticking || stopped) return;
    ticking = Promise.all(readRegistry(home).map((entry) => consider(entry.path)))
      .then(() => undefined)
      // A poll that fails is tried again on the next one; it never stops the daemon.
      .catch((error: unknown) => console.error(error))
      .finally(() => (ticking = null));
  }

  tick();
  const timer = setInterval(tick, pollMs);
  timer.unref();

  return {
    async stop() {
      stopped = true;
      clearInterval(timer);
      await ticking;
      for (const child of children) end(child);
      await Promise.all(settling);
    },
  };
}

/**
 * The snapshot's `graph` section for the registered project at `path`, read from the runs
 * recorded and the checkout now, and the attention it calls for. A missing tool or a
 * capability declared `false` is the section's reason, never an attention item.
 */
export async function graphSection(
  store: Store,
  searchPath: string,
  path: string,
  manifest: ProjectManifest | null,
): Promise<{ graph: GraphSection; attention: Diagnostic[] }> {
  const attention: Diagnostic[] = [];
  const built = store.latestEvent(path, [BUILT]);
  const last = store.latestEvent(path, [BUILT, FAILED]);
  const commit = await defaultCommit(path);
  const builtFrom = built && { commit: String(built.payload.commit), at: built.occurredAt };
  const lastRun = last && runOf(last);
  if (lastRun?.outcome === 'failed') {
    attention.push({
      code: 'graph.update_failed',
      message: `The graph update for ${short(lastRun.commit)} failed: ${lastRun.reason}${builtFrom ? ` The graph built from ${short(builtFrom.commit)} is kept.` : ''}`,
      params: { commit: short(lastRun.commit), reason: String(lastRun.reason), ...(builtFrom && { kept: short(builtFrom.commit) }) },
    });
  }

  let reason: string | null = null;
  if (manifest?.capabilities.graphify === false) reason = 'This project does not use Graphify: capabilities.graphify is false in its manifest.';
  else if (findExecutable('graphify', searchPath) === null) reason = "graphify is not on the daemon's PATH, so no graph is built or read.";
  else {
    if ((await isIgnored(path, GRAPH_FILE, resolveGitTimeout())) === false) {
      attention.push({
        code: 'graph.not_ignored',
        message: `Git does not ignore ${GRAPH_DIRECTORY}/ in ${path}, so the daemon does not run Graphify there. Add ${GRAPH_DIRECTORY}/ to .gitignore.`,
        params: { directory: GRAPH_DIRECTORY, path },
      });
    }
    if (!existsSync(join(path, GRAPH_FILE))) reason = `No graph has been built yet: there is no ${GRAPH_FILE}.`;
  }

  return {
    graph: { available: reason === null, reason, builtFrom, behind: commit === null ? null : builtFrom?.commit !== commit, lastRun },
    attention,
  };
}

/**
 * The conflict risk between `tasks`, the ready and in-flight ones, read against the graph in the
 * registered checkout at `path`; unavailable, with the graph's reason, when there is none. A Task
 * whose branch (`taskBranch`) has changed files since it left the default branch is read from
 * that diff, and any other from its ticket's title and body.
 *
 * ponytail: read on every snapshot, the graph and two git calls per Task; cache by the graph's
 * and the branches' commits if a large graph or backlog makes the snapshot slow.
 */
export async function impactSection(
  path: string,
  graph: GraphSection,
  tasks: Pick<TrackerTask, 'id' | 'title' | 'ticket' | 'body'>[],
  remote: boolean,
): Promise<Impact | Unavailable> {
  if (!graph.available) return { available: false, reason: graph.reason ?? 'There is no graph.' };
  let modules: ModuleGraph | null = null;
  try {
    modules = moduleGraph(JSON.parse(readFileSync(join(path, GRAPH_FILE), 'utf8')));
  } catch {
    // Unreadable or not JSON: said below, as a graph of the wrong shape is.
  }
  if (modules === null) return { available: false, reason: `${GRAPH_FILE} cannot be read as a graph.` };

  const base = await defaultCommit(path);
  const touches = await Promise.all(
    tasks.map(async (task): Promise<TaskTouch> => {
      const head = base === null ? null : await readBranchCommit(path, taskBranch(task, remote), resolveGitTimeout());
      const files = base === null || head === null || head === base ? null : await readChangedFiles(path, base, head, resolveGitTimeout());
      return files && files.length > 0 ? { id: task.id, files } : { id: task.id, text: `${task.title ?? ''}\n${task.body}` };
    }),
  );
  return conflictRisk(modules, touches);
}

/** The modules `impact` read for the Task `id`, and where from; null without a graph. */
export const touchedBy = (impact: Impact | Unavailable, id: string): Impact['tasks'][number] | null =>
  impact.available ? (impact.tasks.find((task) => task.id === id) ?? null) : null;

/** The last successful run of the project at `path`, and whether a failed one came after it; null when none succeeded. */
export function lastBuild(store: Store, path: string): { id: number; commit: string; failedSince: boolean } | null {
  const built = store.latestEvent(path, [BUILT]);
  if (built === null) return null;
  return { id: built.id, commit: String(built.payload.commit), failedSince: store.latestEvent(path, [BUILT, FAILED])?.type === FAILED };
}

const runOf = (event: EventRow): NonNullable<GraphSection['lastRun']> => ({
  commit: String(event.payload.commit),
  at: event.occurredAt,
  outcome: event.type === BUILT ? 'built' : 'failed',
  reason: typeof event.payload.reason === 'string' ? event.payload.reason : null,
});

/** Kills a run and everything it started, its process group on POSIX. */
function end(child: ChildProcess): void {
  try {
    if (process.platform !== 'win32' && child.pid !== undefined) {
      process.kill(-child.pid, 'SIGKILL');
      return;
    }
  } catch {
    // The group is already gone, or was never made: the child itself, below.
  }
  child.kill('SIGKILL');
}

const short = (commit: string): string => commit.slice(0, 7);

/** As usage attribution reads it: `origin/HEAD`, or `main` when there is none. */
const defaultBranch = async (path: string): Promise<string> => (await readDefaultBranch(path, resolveGitTimeout())) ?? 'main';
export const defaultCommit = async (path: string): Promise<string | null> => readBranchCommit(path, await defaultBranch(path), resolveGitTimeout());

/** The manifest at `path`, or null when it cannot be read. */
export function manifestOf(path: string): ProjectManifest | null {
  try {
    return readManifest(path).manifest;
  } catch {
    return null;
  }
}

/**
 * The first executable `name` in `searchPath`, read as `PATH` is; null when there is none.
 *
 * ponytail: POSIX only — no `PATHEXT`, so a Windows `graphify.exe` is not found; read it if
 * the daemon is ever run there.
 */
export function findExecutable(name: string, searchPath: string): string | null {
  for (const dir of searchPath.split(delimiter)) {
    if (dir === '') continue;
    const candidate = join(dir, name);
    try {
      if (!statSync(candidate).isFile()) continue;
      accessSync(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Not there, or not executable: the next directory.
    }
  }
  return null;
}
