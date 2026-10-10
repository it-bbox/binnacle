import { readGitHubCi, type CiReading, type CiRequest, type GitFacts } from '@binnacle/adapters';
import { branchTask, forgeRemote, type Diagnostic, type ProjectManifest, type TrackerTask } from '@binnacle/core';
import { trackerToken } from './home.ts';
import type { Unavailable } from './snapshot.ts';

/**
 * Where a project's CI is read from: its tracker when that is GitHub or GitLab with a repository,
 * otherwise its first GitHub or GitLab Git remote (`forgeRemote`), `origin` first. `host` is the
 * one its token is kept under, the tracker's `tracker.host` or the remote's, null for the provider's default.
 */
type Forge = { provider: 'github' | 'gitlab'; host: string | null; repository: string; from: 'tracker' | 'remote' };

/** The snapshot's `ci` section: the forge, the default branch's latest commit and the open requests, each with the Task its branch maps to. */
export type Ci = {
  forge: Omit<Forge, 'host'> & { host: string };
  defaultBranch: Extract<CiReading, { defaultBranch: unknown }>['defaultBranch'];
  requests: { items: (CiRequest & { taskId: string | null })[]; remainder: number };
};

/** Why there is no CI to read, which the dashboard knows by its text. */
export const NO_FORGE = 'There is no forge to read CI from: the tracker is not GitHub or GitLab, and there is no Git remote on GitHub or GitLab.';

function forgeOf(manifest: ProjectManifest | null, git: GitFacts): Forge | null {
  const tracker = manifest?.tracker;
  if ((tracker?.provider === 'github' || tracker?.provider === 'gitlab') && tracker.repository !== null) {
    return { provider: tracker.provider, host: tracker.host, repository: tracker.repository, from: 'tracker' };
  }
  const remote = git.available ? forgeRemote(git.remotes) : null;
  if (remote === null) return null;
  return { ...remote, host: remote.host === `${remote.provider}.com` ? null : remote.host, from: 'remote' };
}

/**
 * The forge's CI as it is now, read on request and uncached (`ponytail:` until a forge's rate
 * limit is reached in practice), with the token Binnacle holds for the forge's host or none;
 * `limit` requests listed. Unavailable with the reason when there is no forge or it cannot be read.
 * `tasks` maps a request to the Task its branch names (`branchTask`); read later, so that the
 * forge and the tracker are read at once.
 */
export async function readCi(home: string, manifest: ProjectManifest | null, git: GitFacts, limit: number): Promise<(tasks: TrackerTask[] | null) => Ci | Unavailable> {
  const forge = forgeOf(manifest, git);
  const unavailable = (reason: string) => (): Unavailable => ({ available: false, reason });
  if (forge === null) return unavailable(NO_FORGE);
  // ponytail: GitLab's pipelines and merge requests are ticket 09 of the state of work.
  if (forge.provider === 'gitlab') return unavailable(`The forge is GitLab (${forge.repository}), and this version of Binnacle reads CI from GitHub only.`);
  // A remote names its own host, which no one declared: on any but the provider's own, only the
  // credentials file's entry for that host is sent there, never the environment's token.
  const credential = trackerToken(home, forge.provider, forge.host, forge.from === 'remote' && forge.host !== null ? {} : process.env);
  if ('failure' in credential) return unavailable(credential.failure.message);
  const reading = await readGitHubCi(forge.repository, forge.host, credential.token, limit);
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

/** `ci.failing` when the default branch's latest commit is failing. */
export function ciAttention(ci: Ci | Unavailable): Diagnostic[] {
  if ('available' in ci || ci.defaultBranch.state.value !== 'failing') return [];
  const { branch, commit, url } = ci.defaultBranch;
  const forge = ci.forge.provider === 'github' ? 'GitHub' : 'GitLab';
  return [{ code: 'ci.failing', message: `CI is failing on ${branch} at ${commit.slice(0, 12)}, as ${forge} reports it: ${url}` }];
}
