import { resolve } from 'node:path';
import { isAlive, readRuntime, type ErrorDetail, type ProjectRow, type ProjectStatus } from '@binnacle/daemon';
import { callOperation } from './client.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { reportFailure, requireToken } from './report.ts';
import { marked, row, say, T } from './text.ts';

export async function register(home: string, path?: string): Promise<ExitCode> {
  type Registered = { project: ProjectRow; warnings: ErrorDetail[] };
  return await callAndReport<Registered>(home, 'project.register', { path: target(path) }, ({ project, warnings }) => {
    console.log(T.registered(project.id ?? project.path));
    console.log(row('path', project.path));
    if (project.name) console.log(row('name', project.name));
    console.log(row('registered', project.registeredAt));
    // Warnings go to stderr: registration succeeded, and stdout is the result.
    for (const warning of warnings) console.error(`binn: ${warning.path}: ${say(warning)}`);
  });
}

export async function list(home: string): Promise<ExitCode> {
  return await callAndReport<{ projects: ProjectRow[] }>(home, 'project.list', {}, ({ projects }) => {
    if (projects.length === 0) {
      console.log(T.noProjects);
      return;
    }
    console.log(T.projects(projects.length));
    for (const project of projects) {
      console.log(`  ${project.id ?? T.unknownId}  ${project.name ?? T.unnamed}`);
      console.log(`    ${project.path}`);
      // The registry keeps the reason as text, without its code.
      if (project.unavailable) console.log(`    ${T.unavailable(marked(project.unavailable))}`);
    }
  });
}

export async function status(home: string, path?: string): Promise<ExitCode> {
  return await callAndReport<ProjectStatus>(home, 'project.status', { path: target(path) }, ({ project, manifest, checkout, git, diagnostics }) => {
    console.log(`${project.id ?? T.unknownId}  ${project.name ?? T.unnamed}`);
    console.log(row('path', project.path));
    if (project.unavailable) console.log(`  ${T.manifestUnavailable(marked(project.unavailable))}`);
    if (manifest) console.log(row('tracker', manifest.tracker.provider ?? T.notDeclared));
    if (!checkout.registered) console.log(row('checkout', T.linkedWorktree(checkout.root)));
    if (git.available) {
      const head = git.detached ? T.detached : git.branch;
      console.log(row('git', T.head(head ?? T.detached, git.commit?.slice(0, 12) ?? T.noCommits, git.dirty)));
      if (git.remotes.length === 0) console.log(row('remote', T.noRemote));
      for (const remote of git.remotes) console.log(row('remote', `${remote.name}  ${remote.url}`));
    } else {
      console.log(row('git', T.unavailable(say({ code: git.code, message: git.reason, params: git.params }))));
    }
    for (const diagnostic of diagnostics) console.log(`  ${say(diagnostic)}`);
  });
}

export async function unregister(home: string, path?: string): Promise<ExitCode> {
  return await callAndReport<{ unregistered: string }>(home, 'project.unregister', { path: target(path) }, (result) => {
    console.log(T.unregistered(result.unregistered));
  });
}

/**
 * No path means "the repository I am standing in", which is how these commands are
 * normally used. The daemon refuses a relative path on purpose, so resolving it against
 * the caller's own directory is the client's job and happens here.
 */
const target = (path?: string): string => resolve(path ?? process.cwd());

async function callAndReport<Result>(
  home: string,
  operation: string,
  body: unknown,
  present: (result: Result) => void,
): Promise<ExitCode> {
  const runtime = readRuntime(home);
  if (!runtime || !isAlive(runtime.pid)) {
    console.error(`binn: ${T.notRunningStart}`);
    return EXIT.unreachable;
  }

  try {
    present(await callOperation<Result>(runtime, requireToken(home), operation, body));
    return EXIT.ok;
  } catch (error) {
    return reportFailure(error);
  }
}
