import { realpathSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { OperationError } from './errors.ts';
import type { Runtime } from './home.ts';
import { readManifest } from './manifest.ts';
import { reproject } from './projection.ts';
import { readRegistry, writeRegistry } from './registry.ts';
import { EVENT_LIMIT_MAX, type EventFilter, type Store } from './store.ts';

export type OperationContext = {
  home: string;
  runtime: Runtime;
  store: Store;
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
      registered = true;
    }

    const row = reproject(context.store, entry);
    // Registering an already-registered path changes nothing, so it records nothing.
    if (registered) {
      context.store.appendEvent({
        type: 'project.registered',
        projectPath: path,
        payload: { path, id: row.id },
      });
    }
    return { project: row, warnings };
  },

  'project.list': (_body, context) => ({ projects: context.store.projects() }),

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
    if (options.mustExist === false && (error as NodeJS.ErrnoException).code === 'ENOENT') return candidate;
    throw new OperationError('project.path_not_found', `No directory at ${candidate}.`, 400);
  }
}
