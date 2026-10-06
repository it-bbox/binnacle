import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type Finding } from '@binnacle/core';
import { MANIFEST_RELATIVE, resolveArtifactRoots } from '@binnacle/daemon';
import { sessionHistory } from './history.ts';
import { binnacleSkills, declaredCapabilities, INSTALLED_SKILLS, mcpSources, registeredIn, tilde, TOOLS } from './tools.ts';

/**
 * The capabilities and telemetry-readiness areas of `binn audit`. They read configuration
 * files and count session files, and nothing else: no process, no network, no write, no
 * message content.
 */

/** The tools the audit checks, from the Standard setup's table; the others have no audit check yet. */
const AUDITED = ['serena', 'graphify', 'context7'];

/**
 * Serena, Graphify and Context7: the repository's declaration first, then its configuration files, then the user-scope ones. Nothing found is `unknown`: the tool may be configured elsewhere.
 * Then Binnacle's skills in `~/.agents/skills`, reported only when stale: a current set, or none, is not a finding.
 */
export function capabilities(root: string): Finding[] {
  const area = 'capabilities';
  const declared = declaredCapabilities(root);
  const { repository, user } = mcpSources();

  const tools = TOOLS.filter(({ name }) => AUDITED.includes(name)).map(({ name, title, files }): Finding => {
    const code = `capabilities.${name}`;
    const declaration = declared[name];
    if (declaration !== undefined) {
      const what = declaration === true ? 'is installed' : declaration === 'optional' ? 'is optional' : 'is not used';
      return { code, area, status: 'ok', reason: `${MANIFEST_RELATIVE} declares that ${title} ${what}. The declaration is taken as it stands.` };
    }
    const found = files.find((file) => existsSync(join(root, file))) ?? registeredIn(repository, root, root, name) ?? registeredIn(user, null, root, name);
    if (found) return { code, area, status: 'ok', reason: `${title} looks configured: found in ${found}.` };
    const looked = [MANIFEST_RELATIVE, ...files, ...repository.map(({ file }) => file)].join(', ');
    return {
      code,
      area,
      status: 'unknown',
      reason: `No ${title} configuration found in ${looked} (repository), or ${user.map(({ file }) => tilde(file)).join(', ')} (user scope). It may be configured somewhere else.`,
      recommendation: `If an agent here should reach ${title}, declare it under capabilities in ${MANIFEST_RELATIVE}.`,
    };
  });

  const skills = binnacleSkills();
  if (skills.state !== 'stale') return tools;
  return [
    ...tools,
    {
      code: 'capabilities.binnacle_skills',
      area,
      status: 'gap',
      reason: `Binnacle's skills in ${tilde(INSTALLED_SKILLS)} are stale: ${skills.reason}. Every harness the skills CLI installed them into runs the old ones.`,
      recommendation: "Run binn init, and confirm its plan: it reinstalls Binnacle's skills.",
    },
  ];
}

/** Whether the session artifacts Binnacle reads exist for this repository, by counting the sessions; no message is read for anything but where and when a session started. */
export async function telemetry(root: string): Promise<Finding[]> {
  const area = 'telemetry';
  const roots = resolveArtifactRoots();
  const where: Record<string, { code: string; root: string; env: string }> = {
    'Claude Code': { code: 'telemetry.claude_code', root: roots.claudeCode, env: 'CLAUDE_CONFIG_DIR' },
    Codex: { code: 'telemetry.codex', root: roots.codex, env: 'CODEX_HOME' },
  };
  return (await sessionHistory(root)).map(({ name, sessions }): Finding => {
    const { code, root: looked, env } = where[name]!;
    if (sessions > 0) return { code, area, status: 'ok', reason: `${sessions} ${name} session${sessions === 1 ? '' : 's'} for this repository under ${tilde(looked)}, so usage could be attributed.` };
    return {
      code,
      area,
      status: 'unknown',
      reason: `No sessions for this repository under ${tilde(looked)}. No work has been recorded yet, or ${name} keeps its sessions elsewhere.`,
      recommendation: `Nothing to do for a new project. If ${name} keeps its sessions elsewhere, point ${env} at them.`,
    };
  });
}
