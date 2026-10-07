import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import { readGitFacts, readGitLocation, workingTree, type GitFacts } from '@binnacle/adapters';
import { trackerRemoteMismatch, type Diagnostic, type ProjectManifest, type TrackerTask } from '@binnacle/core';
import { OperationError, pathNotFound } from './errors.ts';
import { resolveGitTimeout, type Runtime } from './home.ts';
import { readManifest } from './manifest.ts';
import { projectRegistry, reproject, type Projected } from './projection.ts';
import { containingEntry, readRegistry, writeRegistry, type RegistryEntry } from './registry.ts';
import { promotedItems, promotionDiagnostics, promotionTargets } from './checkpoint.ts';
import { BASELINE_EVENTS, committedHead, daily, isRemoteTracker, taskStates, type Baseline, type BaselineEvent, type TaskStates } from './daily.ts';
import { graphSection } from './graph.ts';
import { readTasks, snapshot, type CallerCheckout } from './snapshot.ts';
import { EVENT_LIMIT_MAX, type EventFilter, type ProjectRow, type Store } from './store.ts';
import { findTask, taskBrief } from './task.ts';
import { taskList } from './board.ts';
import { writeServed } from './vault.ts';
import { forgetRead, latestRuns, taskByRole, usageAndActivity, usageGet, type Importer } from './usage.ts';

export type OperationContext = {
  home: string;
  runtime: Runtime;
  store: Store;
  /** Where `graphify` is looked for, as `PATH` is read. */
  searchPath: string;
  importer: Importer;
};

export type ProjectStatus = {
  project: ProjectRow;
  manifest: ProjectManifest | null;
  checkout: CallerCheckout['checkout'];
  git: GitFacts;
  diagnostics: Diagnostic[];
};

export type Operation = (body: unknown, context: OperationContext) => unknown | Promise<unknown>;

/**
 * Operations are addressed by name over `POST /ops/<name>`, in the naming shape planned
 * for the MCP surface (`docs/03-mcp-and-skills.md`), so that epic 2 adds a transport
 * rather than a mapping layer.
 *
 * `project.register` and `project.unregister` are local administrative mutations.
 * Whether MCP exposes them at all is epic 2's decision, not settled here.
 */
export const operations: Record<string, Operation> = {
  'daemon.status': (_body, context) => context.runtime,

  'project.register': (body, context) => {
    const path = repositoryPath(body);
    // On every call, not only for a new entry, and letting the manifest's own error
    // through: a manifest that has become unsupported since registration is still a
    // hard error rather than a 200 with a reason attached. A directory that cannot be
    // registered also leaves no trace of having been tried.
    const { warnings } = readManifest(path);

    const entries = readRegistry(context.home);
    let registered = false;
    let entry = entries.find((candidate) => candidate.path === path);
    if (!entry) {
      entry = { path, registeredAt: new Date().toISOString() };
      writeRegistry(context.home, [...entries, entry]);
      forgetRead(context, path);
      registered = true;
    }

    const { row } = reproject(context.store, entry);
    // Registering an already-registered path changes nothing, so it records nothing.
    if (registered) {
      context.store.appendEvent({
        type: 'project.registered',
        projectPath: path,
        payload: { path, id: row.id },
      });
    }

    // A clone or a second checkout keeps its manifest id and is still a legitimate thing
    // to register, so a shared id is a warning, not a refusal. The registry is re-derived,
    // as `project.list` does, so the id compared is the one each manifest holds now — and a
    // manifest that changed meanwhile records its change here, as it would on a list.
    projectRegistry(context.home, context.store);
    const sharing = context.store.projects().filter((other) => other.path !== path && row.id !== null && other.id === row.id);
    for (const other of sharing) {
      warnings.push({ path: 'project.id', message: `"${row.id}" is also the id of the project registered at ${other.path}.` });
    }
    return { project: row, warnings };
  },

  // Re-derived like detect and status, so a repository that disappeared while the daemon
  // ran is listed with its reason now rather than on the next start.
  'project.list': (_body, context) => {
    projectRegistry(context.home, context.store);
    return { projects: context.store.projects() };
  },

  // Re-derived rather than looked up, so a project is never answered as null, and its
  // facts are the manifest's as of now — the same as `project.status` gives.
  'project.detect': async (body, context) => ({ project: reproject(context.store, await resolveEntry(repositoryPath(body, { mustExist: false }), context)).row }),

  /**
   * What Binnacle currently believes about a project: the manifest, re-read now, and Git
   * facts read live from the caller's checkout. Git facts are never stored — the
   * projection holds only what is derived from the registry and the manifest — so a
   * status is never stale about Git.
   */
  'project.status': async (body, context): Promise<ProjectStatus> => {
    const path = repositoryPath(body, { mustExist: false });
    const { row, manifest } = reproject(context.store, await resolveEntry(path, context));
    const { checkout, git } = await callerCheckout(path, row.path);
    return { project: row, manifest, checkout, git, diagnostics: remoteMismatch(manifest, git) };
  },

  // Read now, on every call, from the caller's checkout; nothing in a snapshot is stored.
  // Its usage is the one exception, read from the records the call first ingests.
  'project.snapshot': async (body, context) => {
    const path = repositoryPath(body, { mustExist: false });
    const projected = reproject(context.store, await resolveEntry(path, context));
    const caller = await callerCheckout(path, projected.row.path);
    const graph = await graphSection(context.store, context.searchPath, projected.row.path, projected.manifest);
    const served = await snapshot(context.home, projected, caller, remoteMismatch(projected.manifest, caller.git), graph, (tasks) =>
      usageAndActivity(context, projected.row.path, projected.manifest, tasks),
    );
    writeServed(context.home, projected.manifest, { snapshot: served });
    return served;
  },

  /**
   * What changed since the last daily or checkpoint on this machine, from Git's committed
   * state. The caller's HEAD is recorded as a `daily` event (tier 2, ADR-0015) and is where
   * the next one starts, so a second call in a row is empty. An explicit `since` looks back
   * from that commit instead, and records nothing.
   */
  'daily.get': async (body, context) => {
    const path = repositoryPath(body, { mustExist: false });
    const since = sinceCommit(body);
    const projected = reproject(context.store, await resolveEntry(path, context));
    const caller = await callerCheckout(path, projected.row.path);
    const baseline: Baseline | null = since ? { commit: since, source: 'since', states: null } : recordedBaseline(context.store, projected.row.path, BASELINE_EVENTS);
    const { delta, states } = await daily(context.home, projected, caller, remoteMismatch(projected.manifest, caller.git), baseline, readAttributed(context, projected));
    if (!since) context.store.appendEvent({ type: 'daily', projectPath: projected.row.path, payload: { head: delta.head, ...(states && { states }) } });
    writeServed(context.home, projected.manifest, { daily: delta });
    return delta;
  },

  /**
   * What changed since the last checkpoint — the daily's delta, from the last `checkpoint`
   * event only — and where each kind of durable decision belongs in this project. Facts
   * and candidates, never prose (ADR-0012), and nothing is recorded.
   */
  'checkpoint.prepare': async (body, context) => {
    const path = repositoryPath(body, { mustExist: false });
    const projected = reproject(context.store, await resolveEntry(path, context));
    const caller = await callerCheckout(path, projected.row.path);
    const recorded = ['checkpoint'] as const;
    const baseline = recordedBaseline(context.store, projected.row.path, recorded);
    const { delta } = await daily(context.home, projected, caller, remoteMismatch(projected.manifest, caller.git), baseline, readAttributed(context, projected), recorded);
    return { ...delta, targets: promotionTargets(projected.manifest) };
  },

  /**
   * Records that a checkpoint happened: the caller's HEAD, which the next checkpoint and
   * the next daily start from, and what the session reports it promoted. The session has
   * already written and committed those itself; Binnacle writes nothing (ADR-0020). A
   * promoted path that is uncommitted, or names nothing, is recorded all the same, with a diagnostic.
   * On a remote tracker it also records every Task's state, as a daily does.
   */
  'checkpoint.record': async (body, context) => {
    const path = repositoryPath(body, { mustExist: false });
    const promoted = promotedItems(body);
    const projected = reproject(context.store, await resolveEntry(path, context));
    const caller = await callerCheckout(path, projected.row.path);
    const { head } = committedHead(caller);
    const diagnostics = await promotionDiagnostics(caller.project, promoted, head);
    // An unreadable tracker records no states, and the next checkpoint's delta says so.
    const tasks = isRemoteTracker(projected.manifest) ? await readTasks(context.home, workingTree(caller.project), projected.manifest, []) : null;
    context.store.appendEvent({ type: 'checkpoint', projectPath: projected.row.path, payload: { head, promoted, ...(tasks && { states: taskStates(tasks) }) } });
    return { project: projected.row, checkout: caller.checkout, head, promoted, diagnostics };
  },

  // Read now, from the caller's checkout on the local tracker, as the snapshot reads its tickets.
  'task.get': async (body, context) => {
    const path = repositoryPath(body, { mustExist: false });
    const id = taskId(body);
    const projected = reproject(context.store, await resolveEntry(path, context));
    const caller = await callerCheckout(path, projected.row.path);
    const found = await findTask(context.home, workingTree(caller.project), projected.manifest, id);
    return taskBrief(found, projected.manifest, await taskByRole(context, projected.row.path, projected.manifest, found.tasks, found.task));
  },

  // The board: one epic's Tasks in their columns, In progress read from runs where the ticket still says READY (ADR-0032).
  'task.list': async (body, context) => {
    const path = repositoryPath(body, { mustExist: false });
    const spec = specSlug(body);
    const projected = reproject(context.store, await resolveEntry(path, context));
    const caller = await callerCheckout(path, projected.row.path);
    return taskList(context, projected, workingTree(caller.project), spec);
  },

  // The project's usage, or one Task's with its runs, after the ingest the snapshot also runs.
  'usage.get': async (body, context) => {
    const path = repositoryPath(body, { mustExist: false });
    const task = optionalString((body as { task?: unknown } | null)?.task, 'task');
    const projected = reproject(context.store, await resolveEntry(path, context));
    const caller = await callerCheckout(path, projected.row.path);
    return usageGet(context, projected.row.path, projected.manifest, workingTree(caller.project), task);
  },

  'project.unregister': (body, context) => {
    const path = repositoryPath(body, { mustExist: false });
    const entries = readRegistry(context.home);
    const remaining = entries.filter((entry) => entry.path !== path);
    if (remaining.length === entries.length) {
      throw new OperationError('project.not_registered', `${path} is not a registered Binnacle project.`, 404);
    }

    writeRegistry(context.home, remaining);
    context.store.dropProjectsExcept(remaining.map((entry) => entry.path));
    context.store.appendEvent({ type: 'project.unregistered', projectPath: path, payload: { path } });
    return { unregistered: path };
  },

  'event.list': (body, context) => ({ events: context.store.events(eventFilter(body)) }),
};

/**
 * The registered project for `path`: by containment first, with no Git involved, and
 * only when that finds nothing, by Git's common directory, which a linked worktree
 * outside the repository shares with the registered checkout.
 *
 * The registry is read before the disk is consulted: a registration outlives its
 * directory, so a repository that has disappeared is still answered, with its reason,
 * the same as `project.list` gives. Only a missing path no registration contains is
 * refused as not found.
 */
async function resolveEntry(path: string, context: OperationContext): Promise<RegistryEntry> {
  const entries = readRegistry(context.home);
  const contained = containingEntry(path, entries);
  if (contained) return contained;

  const here = await readGitLocation(path, resolveGitTimeout());
  if (here) {
    const there = await Promise.all(entries.map((entry) => readGitLocation(entry.path, resolveGitTimeout())));
    // ponytail: two projects registered in one repository make a sibling worktree
    // ambiguous, and it is refused rather than guessed; map its relative path if that
    // case ever matters.
    const matches = entries.filter((_entry, index) => there[index]?.commonDir === here.commonDir);
    if (matches.length === 1) return matches[0]!;
  }

  if (!existsSync(path)) throw pathNotFound(path);
  throw new OperationError('project.not_registered', `No registered Binnacle project contains ${path}.`, 404);
}

async function callerCheckout(path: string, projectPath: string): Promise<CallerCheckout> {
  const worktree = path === projectPath ? null : await linkedWorktree(path, projectPath);
  const project = worktree ?? projectPath;
  const git = await readGitFacts(project, resolveGitTimeout());
  return { checkout: { root: git.available ? git.root : project, registered: worktree === null }, git, project };
}

/**
 * The project's directory in the linked worktree `path` is in, when that is one of the
 * project's; null for the registered checkout itself, for a separate repository nested
 * inside the project, and whenever Git cannot say.
 */
async function linkedWorktree(path: string, projectPath: string): Promise<string | null> {
  const [here, registered] = await Promise.all([
    readGitLocation(path, resolveGitTimeout()),
    readGitLocation(projectPath, resolveGitTimeout()),
  ]);
  return here && registered && here.commonDir === registered.commonDir && here.root !== registered.root
    ? join(here.root, relative(registered.root, projectPath))
    : null;
}

function remoteMismatch(manifest: ProjectManifest | null, git: GitFacts): Diagnostic[] {
  const mismatch =
    manifest && git.available
      ? trackerRemoteMismatch(
          manifest.tracker,
          git.remotes.map((remote) => remote.url),
        )
      : null;
  return mismatch ? [mismatch] : [];
}

/** The ids of the project's Tasks with AgentRuns attributed to them, as the board reads them. */
const readAttributed =
  (context: OperationContext, { row, manifest }: Projected) =>
  async (tasks: TrackerTask[]): Promise<ReadonlySet<string>> =>
    new Set((await latestRuns(context, row.path, manifest, tasks)).keys());

/** The head of the latest event of `types` for the project, which a delta starts from, and the Task states it recorded. */
function recordedBaseline(store: Store, projectPath: string, types: readonly BaselineEvent[]): Baseline | null {
  const event = store.latestEvent(projectPath, types);
  const head = event?.payload.head;
  if (!event || typeof head !== 'string') return null;
  // Absent from an event recorded on the local tracker, before Task states were recorded, or while the tracker could not be read.
  const states = event.payload.states;
  const recorded = typeof states === 'object' && states !== null && !Array.isArray(states) ? (states as TaskStates) : null;
  return { commit: head, source: event.type as BaselineEvent, states: recorded };
}

/** `since`, when given, is a commit hash: never a ref or an expression, which Git could read as an option. */
function sinceCommit(body: unknown): string | undefined {
  const since = optionalString((body as { since?: unknown } | null)?.since, 'since');
  if (since !== undefined && !/^[0-9a-f]{4,64}$/i.test(since)) {
    throw new OperationError('request.invalid', `"since" must be a commit hash; got ${JSON.stringify(since)}.`, 400, [
      { path: 'since', message: 'expected 4 to 64 hexadecimal digits' },
    ]);
  }
  return since;
}

function taskId(body: unknown): string {
  const id = (body as { id?: unknown } | null)?.id;
  if (typeof id !== 'string' || id.trim() === '') {
    throw new OperationError('request.invalid', 'This operation needs an "id".', 400, [{ path: 'id', message: 'expected a non-empty string' }]);
  }
  return id.trim();
}

/** A spec slug, `null` for the Tasks that carry none, or absent for the current epic. */
function specSlug(body: unknown): string | null | undefined {
  const spec = (body as { spec?: unknown } | null)?.spec;
  if (spec === undefined || spec === null) return spec;
  if (typeof spec === 'string' && spec.trim() !== '') return spec.trim();
  throw new OperationError('request.invalid', '"spec" must be a spec slug, or null for the Tasks without one.', 400, [
    { path: 'spec', message: 'expected a non-empty string or null' },
  ]);
}

function eventFilter(body: unknown): EventFilter {
  const raw = (body ?? {}) as Record<string, unknown>;
  const limit = raw.limit;
  if (limit !== undefined && (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > EVENT_LIMIT_MAX)) {
    throw new OperationError('request.invalid', `"limit" must be a positive integer up to ${EVENT_LIMIT_MAX}.`, 400, [
      { path: 'limit', message: `expected 1 to ${EVENT_LIMIT_MAX}` },
    ]);
  }
  return {
    path: optionalString(raw.path, 'path'),
    since: optionalString(raw.since, 'since'),
    until: optionalString(raw.until, 'until'),
    limit: limit as number | undefined,
  };
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new OperationError('request.invalid', `"${field}" must be a string.`, 400, [
      { path: field, message: 'expected a string' },
    ]);
  }
  return value;
}

/**
 * A repository is addressed by an absolute path, resolved through any symlinks so that
 * one repository reached two ways is one project rather than two. Unregistering
 * tolerates a path that has since disappeared, because that is exactly when it is needed.
 *
 * Relative paths are refused rather than resolved: the daemon is a detached background
 * process, so resolving one here would silently mean "wherever `binnd` was started",
 * which is never what the caller meant. Clients resolve against their own directory.
 */
function repositoryPath(body: unknown, options: { mustExist?: boolean } = {}): string {
  const raw = (body as { path?: unknown })?.path;
  if (typeof raw !== 'string' || raw.trim() === '') {
    throw new OperationError('request.invalid', 'This operation needs a "path".', 400, [
      { path: 'path', message: 'expected a non-empty string' },
    ]);
  }
  if (!isAbsolute(raw)) {
    throw new OperationError('request.invalid', `"path" must be absolute; got ${JSON.stringify(raw)}.`, 400, [
      { path: 'path', message: 'expected an absolute path, resolved by the caller' },
    ]);
  }
  const candidate = raw;
  try {
    return realpathSync(candidate);
  } catch (error) {
    if (options.mustExist === false && (error as NodeJS.ErrnoException).code === 'ENOENT') return resolveMissing(candidate);
    throw pathNotFound(candidate);
  }
}

/**
 * A path that no longer exists, resolved through its nearest existing ancestor: a
 * registration holds the real path, so a repository that disappeared from under a
 * symlinked prefix — `/tmp` on macOS — is still the registration it was.
 */
function resolveMissing(path: string): string {
  const parent = dirname(path);
  if (parent === path) return path;
  try {
    return join(realpathSync(parent), basename(path));
  } catch {
    return join(resolveMissing(parent), basename(path));
  }
}
