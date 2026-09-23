import type { TrackerProvider } from './manifest.ts';

/**
 * The manifest's declared tracker is authoritative; a Git remote that disagrees with it
 * is reported, never resolved. Returns why they disagree, or null when they do not.
 *
 * Only a remote tracker can disagree with a remote. A `local` tracker claims nothing about
 * where the code is hosted, an undeclared one claims nothing at all, and a repository with
 * no remote has nothing to disagree with.
 *
 * ponytail: a host is recognised by a `github` or `gitlab` label in its name, so a
 * self-hosted instance on a neutral hostname reads as a mismatch. Add a declared host to
 * the manifest when that bites.
 */
export function trackerRemoteMismatch(provider: TrackerProvider | null, remoteUrls: string[]): string | null {
  if ((provider !== 'github' && provider !== 'gitlab') || remoteUrls.length === 0) return null;
  if (remoteUrls.some((url) => hostProvider(url) === provider)) return null;
  return `tracker.provider declares ${provider}, but no Git remote is hosted there: ${remoteUrls.join(', ')}.`;
}

function hostProvider(url: string): TrackerProvider | null {
  // `scheme://[user@]host[:port]/…`, or scp-like `[user@]host:path`.
  const host = (/^[a-z][a-z0-9+.-]*:\/\/(?:[^/@]*@)?([^/:]+)/i.exec(url) ?? /^(?:[^/@]*@)?([^/:]+):/.exec(url))?.[1];
  const labels = host?.toLowerCase().split('.') ?? [];
  if (labels.includes('github')) return 'github';
  if (labels.includes('gitlab')) return 'gitlab';
  return null;
}
