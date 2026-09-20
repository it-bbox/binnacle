import { resolve } from 'node:path';
import { isAlive, readRuntime, readToken } from '@binnacle/daemon';
import { callOperation } from './client.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { reportFailure } from './report.ts';

/** Mirrors the daemon's projected row. The CLI reaches project state only over the API. */
type Project = {
  id: string | null;
  name: string | null;
  path: string;
  registeredAt: string;
  unavailable: string | null;
};

export async function register(home: string, path?: string): Promise<ExitCode> {
  return await run<{ project: Project }>(home, 'project.register', { path: target(path) }, ({ project }) => {
    console.log(`Registered ${project.id ?? project.path}.`);
    console.log(`  path     ${project.path}`);
    if (project.name) console.log(`  name     ${project.name}`);
    console.log(`  since    ${project.registeredAt}`);
  });
}

export async function list(home: string): Promise<ExitCode> {
  return await run<{ projects: Project[] }>(home, 'project.list', {}, ({ projects }) => {
    if (projects.length === 0) {
      console.log('No projects are registered. Register one with `binn project register [path]`.');
      return;
    }
    console.log(`Binnacle projects (${projects.length}):`);
    for (const project of projects) {
      console.log(`  ${project.id ?? '(unknown id)'}  ${project.path}`);
      if (project.unavailable) console.log(`    unavailable: ${project.unavailable}`);
    }
  });
}

export async function unregister(home: string, path?: string): Promise<ExitCode> {
  return await run<{ unregistered: string }>(home, 'project.unregister', { path: target(path) }, (result) => {
    console.log(`Unregistered ${result.unregistered}. Nothing in the repository was changed.`);
  });
}

/** No path means "the repository I am standing in", which is how these commands are normally used. */
const target = (path?: string): string => resolve(path ?? process.cwd());

async function run<T>(home: string, operation: string, body: unknown, present: (result: T) => void): Promise<ExitCode> {
  const runtime = readRuntime(home);
  if (!runtime || !isAlive(runtime.pid)) {
    console.error('binn: the Binnacle daemon is not running. Start it with `binn daemon start`.');
    return EXIT.unreachable;
  }
  const token = readToken(home);
  if (!token) {
    console.error(`binn: no Binnacle API token in ${home}.`);
    return EXIT.failed;
  }

  try {
    present(await callOperation<T>(runtime, token, operation, body));
    return EXIT.ok;
  } catch (error) {
    return reportFailure(error);
  }
}
