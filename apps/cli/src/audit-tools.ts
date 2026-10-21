import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { MANIFEST_RELATIVE, resolveArtifactRoots } from '@binnacle/daemon';
import { words, type Check } from './audit-text.ts';
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
export function capabilities(root: string): Check[] {
  const area = 'capabilities';
  const declared = declaredCapabilities(root);
  const { repository, user } = mcpSources();

  const tools = TOOLS.filter(({ name }) => AUDITED.includes(name)).map(({ name, title, files }): Check => {
    const code = `capabilities.${name}`;
    const declaration = declared[name];
    if (declaration !== undefined) {
      const use = declaration === true ? 'installed' : declaration === 'optional' ? 'optional' : 'unused';
      return { code, area, status: 'ok', ...words('tool.declared', { manifest: MANIFEST_RELATIVE, title, use }) };
    }
    const found = files.find((file) => existsSync(join(root, file))) ?? registeredIn(repository, root, root, name) ?? registeredIn(user, null, root, name);
    if (found) return { code, area, status: 'ok', ...words('tool.found', { title, where: found }) };
    return {
      code,
      area,
      status: 'unknown',
      // binn init installs the tool or registers its server, and declares it in the manifest.
      init: true,
      ...words('tool.missing', {
        title,
        looked: [MANIFEST_RELATIVE, ...files, ...repository.map(({ file }) => file)].join(', '),
        user: user.map(({ file }) => tilde(file)).join(', '),
        manifest: MANIFEST_RELATIVE,
      }),
    };
  });

  const skills = binnacleSkills();
  if (skills.state !== 'stale') return tools;
  const { reason, differ, missing, version } = skills;
  return [...tools, { code: 'capabilities.binnacle_skills', area, status: 'gap', init: true, ...words('skills.stale', { where: tilde(INSTALLED_SKILLS), reason, differ, missing, version }) }];
}

/** Whether the session artifacts Binnacle reads exist for this repository, by counting the sessions; no message is read for anything but where and when a session started. */
export async function telemetry(root: string): Promise<Check[]> {
  const area = 'telemetry';
  const roots = resolveArtifactRoots();
  const where: Record<string, { code: string; root: string; env: string }> = {
    'Claude Code': { code: 'telemetry.claude_code', root: roots.claudeCode, env: 'CLAUDE_CONFIG_DIR' },
    Codex: { code: 'telemetry.codex', root: roots.codex, env: 'CODEX_HOME' },
  };
  return (await sessionHistory(root)).map(({ name, sessions }): Check => {
    const { code, root: looked, env } = where[name]!;
    if (sessions > 0) return { code, area, status: 'ok', ...words('sessions.found', { count: sessions, name, where: tilde(looked) }) };
    return { code, area, status: 'unknown', ...words('sessions.none', { name, where: tilde(looked), env }) };
  });
}

/**
 * Per detected harness, whether its user-scope settings export OpenTelemetry to Binnacle, read as
 * `binn init` reads them; a detected harness without an export says so. Nothing is written or sent.
 */
export function telemetryExport(home: string): Check[] {
  const area = 'telemetry';
  const address = daemonAddress(home);
  const found: Check[] = [];
  for (const exporter of exporters()) {
    if (detected(exporter) === null) continue;
    const { name, code: suffix, file } = exporter;
    const code = `telemetry.export_${suffix}`;
    const where = tilde(file);
    if (address === null) {
      found.push({ code, area, status: 'unknown', ...words('export.no-daemon', { name }) });
      continue;
    }
    const state = exporter.read(settingsText(file), address);
    if (state.state === 'binnacle') found.push({ code, area, status: 'ok', ...words('export.binnacle', { name, address, where }) });
    else if (state.state === 'none') found.push({ code, area, status: 'gap', init: true, ...words('export.none', { name, where }) });
    else if (state.state === 'elsewhere') found.push({ code, area, status: 'gap', ...words('export.elsewhere', { name, where, what: state.what, address }) });
    else found.push({ code, area, status: 'unknown', ...words('export.unreadable', { name, where, why: state.why }) });
  }
  for (const harness of NO_EXPORT) {
    if (detected(harness) !== null) found.push({ code: `telemetry.export_${harness.code}`, area, status: 'ok', ...words('export.cannot', { name: harness.name, harness: harness.code, reason: harness.reason }) });
  }
  return found;
}
