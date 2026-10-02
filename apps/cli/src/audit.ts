import { readGitFacts, type GitFacts } from '@binnacle/adapters';
import { AUDIT_AREAS, forgeRemote, type Finding } from '@binnacle/core';
import { resolveGitTimeout, trackerToken } from '@binnacle/daemon';
import { resolve } from 'node:path';
import { EXIT, type ExitCode } from './exit.ts';

type Repository = Extract<GitFacts, { available: true }>;

/**
 * `binn audit [path]`: findings about the Git repository containing `path`, as text or JSON.
 * It reads and never writes (ADR-0020), makes no network call and runs nothing but Git. Gaps
 * leave the exit code at 0; it fails only when the audit could not run.
 */
export async function audit(home: string, path: string | undefined, json: boolean): Promise<ExitCode> {
  const git = await readGitFacts(resolve(path ?? process.cwd()), resolveGitTimeout());
  if (!git.available) {
    console.error(`binn: ${git.reason} binn audit works on a Git repository.`);
    return EXIT.failed;
  }

  // One list per area, so that each later area is one more entry here; the sort is stable, so checks keep their order within an area.
  const all: Finding[] = [...gitAndTracker(git, home)].sort((a, b) => AUDIT_AREAS.indexOf(a.area) - AUDIT_AREAS.indexOf(b.area));

  if (json) {
    console.log(JSON.stringify({ root: git.root, findings: all }, null, 2));
  } else {
    console.log(`Audit of ${git.root}\n`);
    for (const { code, area, status, reason, recommendation } of all) {
      console.log(`[${status}] ${code} (${area})\n    ${reason}`);
      if (recommendation) console.log(`    Recommendation: ${recommendation}`);
    }
  }
  return EXIT.ok;
}

/** Whether this is a repository, on what branch, which tracker its remote names and whether a token for it exists. */
function gitAndTracker(git: Repository, home: string): Finding[] {
  const area = 'git-and-tracker';
  const branch = git.detached ? 'a detached HEAD' : `branch ${git.branch}${git.commit === null ? ' (no commit yet)' : ''}`;
  const found: Finding[] = [{ code: 'git.repository', area, status: 'ok', reason: `A Git repository, on ${branch}.` }];

  const forge = forgeRemote(git.remotes);
  if (!forge) {
    if (git.remotes.length === 0) {
      found.push({
        code: 'tracker.provider',
        area,
        status: 'ok',
        reason: 'No remote, so no remote tracker. Local tickets under docs/specs/ are a tracker Binnacle reads.',
      });
    } else {
      found.push({
        code: 'tracker.provider',
        area,
        status: 'unknown',
        reason: `The remote ${git.remotes[0]!.name} is not recognised as GitHub or GitLab from its URL, so Binnacle would read local tickets under docs/specs/.`,
        recommendation: 'If the remote is a self-hosted GitHub or GitLab, declare it in the tracker section of .binnacle/project.yaml.',
      });
    }
    return found;
  }

  found.push({ code: 'tracker.provider', area, status: 'ok', reason: `The remote names a ${forge.provider} tracker, ${forge.repository} on ${forge.host}.` });
  // The daemon's own lookup, so that the two never disagree. Only its presence is used; the value goes no further.
  const token = trackerToken(home, forge.provider, forge.host === `${forge.provider}.com` ? null : forge.host);
  if ('failure' in token) {
    found.push({ code: 'tracker.token', area, status: 'gap', reason: token.failure.message, recommendation: 'Fix the token as that message says.' });
  } else if (token.token === null) {
    found.push({
      code: 'tracker.token',
      area,
      status: 'gap',
      reason: `No tracker token: BINNACLE_${forge.provider.toUpperCase()}_TOKEN is not set and the credentials file has no entry for ${forge.host}.`,
      recommendation: 'A public repository needs none. For a private one, give Binnacle a read-only token (docs/operations/05-installation-checklist.md, Tracker credentials).',
    });
  } else {
    found.push({ code: 'tracker.token', area, status: 'ok', reason: 'A tracker token is present, in the environment or the credentials file. Its value is not shown.' });
  }
  found.push({
    code: 'tracker.token_works',
    area,
    status: 'unknown',
    reason: 'Whether a token works is known only from the network, which the audit does not use.',
    recommendation: 'Run binn init, which reads the tracker once and says whether it was readable.',
  });
  return found;
}
