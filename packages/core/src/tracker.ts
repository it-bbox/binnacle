import type { TrackerProvider } from './manifest.ts';
import type { TaskState } from './domain.ts';

/** A disagreement Binnacle reports and does not resolve. `code` is part of the API contract. */
export type Diagnostic = { code: string; message: string };

/**
 * The manifest's declared tracker is authoritative; a Git remote that disagrees with it
 * is reported, never resolved. Returns the disagreement, or null when there is none.
 *
 * Only a remote tracker can disagree with a remote. A `local` tracker claims nothing about
 * where the code is hosted, an undeclared one claims nothing at all, and a repository with
 * no remote has nothing to disagree with.
 *
 * ponytail: a host is recognised by a `github` or `gitlab` label in its name, so a
 * self-hosted instance on a neutral hostname reads as a mismatch. Add a declared host to
 * the manifest when that bites.
 */
export function trackerRemoteMismatch(provider: TrackerProvider | null, remoteUrls: string[]): Diagnostic | null {
  if ((provider !== 'github' && provider !== 'gitlab') || remoteUrls.length === 0) return null;
  if (remoteUrls.some((url) => hostProvider(url) === provider)) return null;
  return {
    code: 'tracker.remote_mismatch',
    message: `tracker.provider declares ${provider}, but no Git remote is hosted there: ${remoteUrls.join(', ')}.`,
  };
}

function hostProvider(url: string): TrackerProvider | null {
  // `scheme://[user@]host[:port]/…`, or scp-like `[user@]host:path`.
  const host = (/^[a-z][a-z0-9+.-]*:\/\/(?:[^/@]*@)?([^/:]+)/i.exec(url) ?? /^(?:[^/@]*@)?([^/:]+):/.exec(url))?.[1];
  const labels = host?.toLowerCase().split('.') ?? [];
  if (labels.includes('github')) return 'github';
  if (labels.includes('gitlab')) return 'gitlab';
  return null;
}

/**
 * The Task-reading half of the tracker contract: what every tracker adapter returns,
 * whatever the tracker. The local Markdown adapter is the first; the GitHub and GitLab
 * adapters of epic 3 implement this rather than copy it. A field the tracker cannot
 * express is null, never a guess.
 */
export type TrackerTask = {
  /** Unique within the project. On the local Markdown tracker, `<spec-slug>/<NN>`. */
  id: string;
  /** Null when the ticket has none. */
  title: string | null;
  /** Null when the tracker's value is not a Task state; the adapter says so in a diagnostic. */
  state: TaskState | null;
  /** The identities this Task is declared blocked by, as declared: they may name no Task. */
  blockedBy: string[];
  spec: string | null;
  triage: string | null;
  /** The ticket's path relative to the repository root, or its URL. */
  ticket: string;
};

export type TaskReading = { tasks: TrackerTask[]; diagnostics: Diagnostic[] };

export type ResolvedTask = TrackerTask & {
  /** Declared dependencies whose Task is not `DONE`. A dependency naming no Task is not one. */
  unmetDependencies: string[];
};

/**
 * Unmet dependencies are the contract's, not the adapter's, so that every tracker agrees
 * on them. A dependency naming no known Task is a dangling reference, reported, and never
 * counted as unmet: a typo must not block work forever.
 */
export function resolveDependencies(tasks: TrackerTask[]): { tasks: ResolvedTask[]; diagnostics: Diagnostic[] } {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const diagnostics: Diagnostic[] = [];
  const resolved = tasks.map((task) => {
    const unmetDependencies: string[] = [];
    for (const id of task.blockedBy) {
      const dependency = byId.get(id);
      if (!dependency) {
        diagnostics.push({
          code: 'task.dangling_dependency',
          message: `${task.id} (${task.ticket}) is declared blocked by ${id}, which is not a known Task.`,
        });
      } else if (dependency.state !== 'DONE') {
        unmetDependencies.push(id);
      }
    }
    return { ...task, unmetDependencies };
  });
  return { tasks: resolved, diagnostics };
}
