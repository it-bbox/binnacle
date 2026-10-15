import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { type Finding } from '@binnacle/core';
import { MANIFEST_RELATIVE, resolveArtifactRoots } from '@binnacle/daemon';
import { daemonAddress, detected, exporters, NO_EXPORT, settingsText } from './export.ts';
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
      // binn init installs the tool or registers its server, and declares it in the manifest.
      init: true,
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
      init: true,
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

/**
 * Per detected harness, whether its user-scope settings export OpenTelemetry to Binnacle, read as
 * `binn init` reads them; a detected harness without an export says so. Nothing is written or sent.
 */
export function telemetryExport(home: string): Finding[] {
  const area = 'telemetry';
  const address = daemonAddress(home);
  const found: Finding[] = [];
  for (const exporter of exporters()) {
    if (detected(exporter) === null) continue;
    const { name, code: suffix, file } = exporter;
    const code = `telemetry.export_${suffix}`;
    const where = tilde(file);
    if (address === null) {
      found.push({ code, area, status: 'unknown', reason: `The Binnacle daemon is not running and BINNACLE_PORT is 0, so whether ${name} exports to it cannot be told.`, recommendation: 'Start the daemon, then run binn audit again.' });
      continue;
    }
    const state = exporter.read(settingsText(file), address);
    if (state.state === 'binnacle') found.push({ code, area, status: 'ok', reason: `${name} exports OpenTelemetry to Binnacle at ${address}, in ${where}.` });
    else if (state.state === 'none')
      found.push({ code, area, status: 'gap', init: true, reason: `${name} does not export OpenTelemetry (${where}), so Binnacle sees its calls only once its session files are written.`, recommendation: `Run binn init, which shows the export it would add to ${where} and writes it only after you confirm.` });
    else if (state.state === 'elsewhere')
      found.push({ code, area, status: 'gap', reason: `${name} has OpenTelemetry settings of its own (${where}: ${state.what}), which do not export to Binnacle at ${address}.`, recommendation: `binn init leaves OpenTelemetry settings of a harness's own alone. If Binnacle should receive ${name}'s calls, point its export at ${address} yourself.` });
    else found.push({ code, area, status: 'unknown', reason: `${where} cannot be read as ${name}'s settings: ${state.why}.`, recommendation: `Fix ${where}; binn init prints the export to add to it.` });
  }
  for (const harness of NO_EXPORT) {
    if (detected(harness) !== null) found.push({ code: `telemetry.export_${harness.code}`, area, status: 'ok', reason: `${harness.name} does not export to Binnacle: ${harness.reason}.` });
  }
  return found;
}
