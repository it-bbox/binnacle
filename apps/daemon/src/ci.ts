import { readGitHubCi, readGitLabCi, type CiReading, type CiRequest, type GitFacts } from '@binnacle/adapters';
import { branchTask, forgeRemote, type Diagnostic, type ProjectManifest, type TrackerTask } from '@binnacle/core';
import { trackerToken } from './home.ts';
import type { Unavailable } from './snapshot.ts';

/**
 * Where a project's CI is read from: its tracker when that is GitHub or GitLab with a repository,
 * otherwise its first GitHub or GitLab Git remote (`forgeRemote`), `origin` first. `host` is the
 * one its token is kept under, the tracker's `tracker.host` or the remote's, null for the provider's default.
 */
type CiForge = { provider: 'github' | 'gitlab'; host: string | null; repository: string; from: 'tracker' | 'remote' };

/** The snapshot's `ci` section: the forge, the default branch's latest commit and the open requests, each with the Task its branch maps to. */
export type Ci = {
  forge: Omit<CiForge, 'host'> & { host: string };
  defaultBranch: Extract<CiReading, { defaultBranch: unknown }>['defaultBranch'];
  requests: { items: (CiRequest & { taskId: string | null })[]; remainder: number };
};

/** Why there is no CI to read, which the dashboard knows by its text. */
export const NO_FORGE = 'There is no forge to read CI from: the tracker is not GitHub or GitLab, and there is no Git remote on GitHub or GitLab.';

function forgeOf(manifest: ProjectManifest | null, git: GitFacts): CiForge | null {
  const tracker = manifest?.tracker;
  if ((tracker?.provider === 'github' || tracker?.provider === 'gitlab') && tracker.repository !== null) {
    return { provider: tracker.provider, host: tracker.host, repository: tracker.repository, from: 'tracker' };
  }
  const remote = git.available ? forgeRemote(git.remotes) : null;
  if (remote === null) return null;
  return { ...remote, host: remote.host === `${remote.provider}.com` ? null : remote.host, from: 'remote' };
}

/** How long a forge's answer is reused by default: four of the dashboard's polls. */
export const FORGE_CACHE_MS = 60_000;
/** `startDaemon`'s `forgeCacheMs`. */
let forgeCacheMs = FORGE_CACHE_MS;
export const setForgeCacheMs = (ms: number): void => void (forgeCacheMs = ms);
const forgeAnswers = new Map<string, { until: number; answer: Promise<unknown> }>();

/**
 * A forge's answer for `key`, read at most once per `forgeCacheMs`, callers in the meantime
 * sharing it: every poll of every page would otherwise wait on the network. One that `kept`
 * refuses, such as a failure, is read again on the next call.
 * ponytail: an entry per key ever read, never evicted; a daemon reads a handful of repositories.
 */
export function fromForge<T>(key: (string | number | null)[], read: () => Promise<T>, kept: (answer: T) => boolean): Promise<T> {
  const id = JSON.stringify(key);
  const known = forgeAnswers.get(id);
  if (known !== undefined && known.until > Date.now()) return known.answer as Promise<T>;
  const answer = read();
  forgeAnswers.set(id, { until: Date.now() + forgeCacheMs, answer });
  const forget = (): void => void (forgeAnswers.get(id)?.answer === answer && forgeAnswers.delete(id));
  answer.then((value) => kept(value) || forget(), forget);
  return answer;
}

/**
 * The forge's CI, read on request and kept for `forgeCacheMs` when every request is listed
 * (`fromForge`), with the token Binnacle holds for the forge's host or none;
 * `limit` requests listed of those whose branch `keep` keeps. Unavailable with the reason when there
 * is no forge or it cannot be read. `tasks` maps a request to the Task its branch names
 * (`branchTask`); read later, so that the forge and the tracker are read at once.
 */
export async function readCi(
  home: string,
  manifest: ProjectManifest | null,
  git: GitFacts,
  limit: number,
  keep?: (branch: string) => boolean,
): Promise<(tasks: TrackerTask[] | null) => Ci | Unavailable> {
  const forge = forgeOf(manifest, git);
  const unavailable = (reason: string, coded?: Pick<Unavailable, 'code' | 'params'>) => (): Unavailable => ({ available: false, reason, ...coded });
  if (forge === null) return unavailable(NO_FORGE, { code: 'ci.no_forge' });
  // A remote names its own host, which no one declared: on any but the provider's own, only the
  // credentials file's entry for that host is sent there, never the environment's token.
  const credential = trackerToken(home, forge.provider, forge.host, forge.from === 'remote' && forge.host !== null ? {} : process.env);
  if ('failure' in credential) {
    const { message, ...coded } = credential.failure;
    return unavailable(message, coded);
  }
  const read = forge.provider === 'github' ? readGitHubCi : readGitLabCi;
  const reading = await (keep === undefined
    ? fromForge(['ci', forge.provider, forge.host, forge.repository, credential.token, limit], () => read(forge.repository, forge.host, credential.token, limit), (answer) => !('reason' in answer))
    : read(forge.repository, forge.host, credential.token, limit, keep));
  if ('reason' in reading) return unavailable(reading.reason);

  const remote = manifest?.tracker.provider !== 'local';
  return (tasks) => ({
    forge: { ...forge, host: forge.host ?? `${forge.provider}.com` },
    defaultBranch: reading.defaultBranch,
    requests: {
      items: reading.requests.items.map((request) => ({ ...request, taskId: tasks === null ? null : (branchTask(request.branch, tasks, remote)?.id ?? null) })),
      remainder: reading.requests.remainder,
    },
  });
}

/** A Task's pull or merge request, with its CI state and the forge that reports it. */
export type TaskRequest = Omit<Ci['requests']['items'][number], 'taskId'> & { forge: Ci['forge'] };

/**
 * The open request whose branch maps to `task`, one of `tasks` (`branchTask`), the first the forge
 * lists when several do; null when none does; unavailable, with the reason, as the `ci` section is.
 * Of the requests, only its state is read, wherever it falls in the forge's list; the default
 * branch, its commit and that commit's state are read as for the section, so that the request is
 * unavailable whenever the section would be.
 * ponytail: three forge requests more per brief, on every poll of the Task page; read the
 * requests alone if a forge's rate limit is reached in practice.
 */
export async function taskRequest(
  home: string,
  manifest: ProjectManifest | null,
  git: GitFacts,
  tasks: TrackerTask[],
  task: TrackerTask,
): Promise<TaskRequest | null | Unavailable> {
  const remote = manifest?.tracker.provider !== 'local';
  const ci = (await readCi(home, manifest, git, 1, (branch) => branchTask(branch, tasks, remote)?.id === task.id))(tasks);
  if ('available' in ci) return ci;
  const [request] = ci.requests.items;
  if (request === undefined) return null;
  const { taskId: _, ...listed } = request;
  return { forge: ci.forge, ...listed };
}

/** `ci.failing` when the default branch's latest commit is failing. */
export function ciAttention(ci: Ci | Unavailable): Diagnostic[] {
  if ('available' in ci || ci.defaultBranch.state.value !== 'failing') return [];
  const { branch, commit, url } = ci.defaultBranch;
  const forge = ci.forge.provider === 'github' ? 'GitHub' : 'GitLab';
  return [{ code: 'ci.failing', message: `CI is failing on ${branch} at ${commit.slice(0, 12)}, as ${forge} reports it: ${url}`, params: { branch, commit: commit.slice(0, 12), forge, url } }];
}
