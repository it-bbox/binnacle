import { terminalText } from '@binnacle/core';
import { resolve } from 'node:path';
import { isAlive, readRuntime, type ErrorDetail, type ProjectRow, type ProjectStatus } from '@binnacle/daemon';
import { callOperation } from './client.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { reportFailure, requireToken } from './report.ts';
import { marked, row, say, T } from './text.ts';

/** A line for the terminal: a project's name and id, its paths and its diagnostics come from the user's files. */
const print = (line: string): void => console.log(terminalText(line));

export async function register(home: string, path?: string): Promise<ExitCode> {
  type Registered = { project: ProjectRow; warnings: ErrorDetail[] };
  return await callAndReport<Registered>(home, 'project.register', { path: target(path) }, ({ project, warnings }) => {
    print(T.registered(project.id ?? project.path));
    print(row('path', project.path));
    if (project.name) print(row('name', project.name));
    print(row('registered', project.registeredAt));
    // Warnings go to stderr: registration succeeded, and stdout is the result.
    for (const warning of warnings) console.error(terminalText(`binn: ${warning.path}: ${say(warning)}`));
  });
}

export async function list(home: string): Promise<ExitCode> {
  return await callAndReport<{ projects: ProjectRow[] }>(home, 'project.list', {}, ({ projects }) => {
    if (projects.length === 0) {
      print(T.noProjects);
      return;
    }
    print(T.projects(projects.length));
    for (const project of projects) {
      print(`  ${project.id ?? T.unknownId}  ${project.name ?? T.unnamed}`);
      print(`    ${project.path}`);
      // The registry keeps the reason as text, without its code.
      if (project.unavailable) print(`    ${T.unavailable(marked(project.unavailable))}`);
    }
  });
}

export async function status(home: string, path?: string): Promise<ExitCode> {
  return await callAndReport<ProjectStatus>(home, 'project.status', { path: target(path) }, ({ project, manifest, checkout, git, diagnostics }) => {
    print(`${project.id ?? T.unknownId}  ${project.name ?? T.unnamed}`);
    print(row('path', project.path));
    if (project.unavailable) print(`  ${T.manifestUnavailable(marked(project.unavailable))}`);
    if (manifest) print(row('tracker', manifest.tracker.provider ?? T.notDeclared));
    if (!checkout.registered) print(row('checkout', T.linkedWorktree(checkout.root)));
    if (git.available) {
      const head = git.detached ? T.detached : git.branch;
      print(row('git', T.head(head ?? T.detached, git.commit?.slice(0, 12) ?? T.noCommits, git.dirty)));
      if (git.remotes.length === 0) print(row('remote', T.noRemote));
      for (const remote of git.remotes) print(row('remote', `${remote.name}  ${remote.url}`));
    } else {
      print(row('git', T.unavailable(say({ code: git.code, message: git.reason, params: git.params }))));
    }
    for (const diagnostic of diagnostics) print(`  ${say(diagnostic)}`);
  });
}

export async function unregister(home: string, path?: string): Promise<ExitCode> {
  return await callAndReport<{ unregistered: string }>(home, 'project.unregister', { path: target(path) }, (result) => {
    print(T.unregistered(result.unregistered));
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
