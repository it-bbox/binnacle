import { resolve } from 'node:path';
import { isAlive, readRuntime, type ErrorDetail, type ProjectRow, type ProjectStatus } from '@binnacle/daemon';
import { callOperation } from './client.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { reportFailure, requireToken } from './report.ts';

export async function register(home: string, path?: string): Promise<ExitCode> {
  type Registered = { project: ProjectRow; warnings: ErrorDetail[] };
  return await callAndReport<Registered>(home, 'project.register', { path: target(path) }, ({ project, warnings }) => {
    console.log(`Registered ${project.id ?? project.path}.`);
    console.log(`  path     ${project.path}`);
    if (project.name) console.log(`  name     ${project.name}`);
    console.log(`  since    ${project.registeredAt}`);
    // Warnings go to stderr: registration succeeded, and stdout is the result.
    for (const warning of warnings) console.error(`binn: ${warning.path}: ${warning.message}`);
  });
}

export async function list(home: string): Promise<ExitCode> {
  return await callAndReport<{ projects: ProjectRow[] }>(home, 'project.list', {}, ({ projects }) => {
    if (projects.length === 0) {
      console.log('No projects are registered. Register one with `binn project register [path]`.');
      return;
    }
    console.log(`Binnacle projects (${projects.length}):`);
    for (const project of projects) {
      console.log(`  ${project.id ?? '(unknown id)'}  ${project.name ?? '(unnamed)'}`);
      console.log(`    ${project.path}`);
      if (project.unavailable) console.log(`    unavailable: ${project.unavailable}`);
    }
  });
}

export async function status(home: string, path?: string): Promise<ExitCode> {
  return await callAndReport<ProjectStatus>(home, 'project.status', { path: target(path) }, ({ project, manifest, checkout, git, diagnostics }) => {
    console.log(`${project.id ?? '(unknown id)'}  ${project.name ?? '(unnamed)'}`);
    console.log(`  path     ${project.path}`);
    if (project.unavailable) console.log(`  manifest unavailable: ${project.unavailable}`);
    if (manifest) console.log(`  tracker  ${manifest.tracker.provider ?? '(not declared)'}`);
    if (!checkout.registered) console.log(`  checkout ${checkout.root} (linked worktree)`);
    if (git.available) {
      const head = git.detached ? '(detached HEAD)' : git.branch;
      console.log(`  git      ${head} at ${git.commit?.slice(0, 12) ?? '(no commits)'}${git.dirty ? ', dirty' : ''}`);
      if (git.remotes.length === 0) console.log('  remote   (none)');
      for (const remote of git.remotes) console.log(`  remote   ${remote.name}  ${remote.url}`);
    } else {
      console.log(`  git      unavailable: ${git.reason}`);
    }
    for (const diagnostic of diagnostics) console.log(`  ${diagnostic.code}: ${diagnostic.message}`);
  });
}

export async function unregister(home: string, path?: string): Promise<ExitCode> {
  return await callAndReport<{ unregistered: string }>(home, 'project.unregister', { path: target(path) }, (result) => {
    console.log(`Unregistered ${result.unregistered}. Nothing in the repository was changed.`);
  });
}

/**
 * No path means "the repository I am standing in", which is how these commands are
 * normally used. The daemon refuses a relative path on purpose, so resolving it against
 * the caller's own directory is the client's job and happens here.
 */
const target = (path?: string): string => resolve(path ?? process.cwd());

async function callAndReport<T>(
  home: string,
  operation: string,
  body: unknown,
  present: (result: T) => void,
): Promise<ExitCode> {
  const runtime = readRuntime(home);
  if (!runtime || !isAlive(runtime.pid)) {
    console.error('binn: the Binnacle daemon is not running. Start it with `binn daemon start`.');
    return EXIT.unreachable;
  }

  try {
    present(await callOperation<T>(runtime, requireToken(home), operation, body));
    return EXIT.ok;
  } catch (error) {
    return reportFailure(error);
  }
}
