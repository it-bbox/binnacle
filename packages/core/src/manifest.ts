/**
 * Validation of `.binnacle/project.yaml`, as a pure function over an already-parsed
 * document. Reading the file and parsing YAML happen outside this package, which is
 * why `packages/core` has no runtime dependencies.
 *
 * Two rules shape the whole file. Every problem is collected rather than thrown, so
 * that a broken manifest is one edit to fix and not one edit per run. And an unknown
 * key is a warning, never a failure, so that a manifest written by a newer Binnacle
 * degrades instead of stopping an older one.
 */
export const MANIFEST_VERSION = 1;

export type ManifestProblem = {
  /** The field's dotted path in the file the user wrote, not in any internal shape. */
  path: string;
  message: string;
};

export type TrackerProvider = 'github' | 'gitlab' | 'local';
export type AutomationMode = 'manual';
export type TelemetryPrivacy = 'metadata' | 'content';
export type Capability = boolean | 'optional';

export type ProjectManifest = {
  version: number;
  project: { id: string; name: string | null };
  tracker: { provider: TrackerProvider; local: { issues: string } };
  knowledge: { context: string; docs: string; adr: string; specs: string };
  workflow: { provider: string | null; scratch: string };
  capabilities: Record<string, Capability>;
  automation: { mode: AutomationMode; maxParallelDevelopmentTasks: number };
  telemetry: { privacy: TelemetryPrivacy; import: { windowDays: number | null } };
};

export type ManifestValidation = {
  /** Null when there are problems: a manifest is either wholly usable or not offered at all. */
  manifest: ProjectManifest | null;
  problems: ManifestProblem[];
  warnings: ManifestProblem[];
  /** Separate from `problems` because an unsupported version is its own answer, not one of many. */
  versionSupported: boolean;
};

const TRACKER_PROVIDERS: TrackerProvider[] = ['github', 'gitlab', 'local'];
const AUTOMATION_MODES: AutomationMode[] = ['manual'];
const TELEMETRY_PRIVACY: TelemetryPrivacy[] = ['metadata', 'content'];

type Notes = { problems: ManifestProblem[]; warnings: ManifestProblem[] };

export function validateManifest(document: unknown): ManifestValidation {
  const notes: Notes = { problems: [], warnings: [] };

  const root = asMapping(document, '', notes);
  if (!root) {
    return { manifest: null, problems: notes.problems, warnings: notes.warnings, versionSupported: false };
  }

  const version = root.version;
  const versionSupported = version === MANIFEST_VERSION;
  if (!versionSupported) {
    notes.problems.push({ path: 'version', message: `expected ${MANIFEST_VERSION}` });
  }

  known(root, '', ['version', 'project', 'tracker', 'knowledge', 'workflow', 'capabilities', 'automation', 'telemetry'], notes);

  const manifest: ProjectManifest = {
    version: MANIFEST_VERSION,
    project: readProject(root.project, notes),
    tracker: readTracker(root.tracker, notes),
    knowledge: readKnowledge(root.knowledge, notes),
    workflow: readWorkflow(root.workflow, notes),
    capabilities: readCapabilities(root.capabilities, notes),
    automation: readAutomation(root.automation, notes),
    telemetry: readTelemetry(root.telemetry, notes),
  };

  return {
    manifest: notes.problems.length === 0 ? manifest : null,
    problems: notes.problems,
    warnings: notes.warnings,
    versionSupported,
  };
}

function readProject(value: unknown, notes: Notes): ProjectManifest['project'] {
  const section = mapping(value, 'project', notes);
  known(section, 'project', ['id', 'name'], notes);
  return {
    id: requiredString(section.id, 'project.id', notes) ?? '',
    name: optionalString(section.name, 'project.name', notes),
  };
}

function readTracker(value: unknown, notes: Notes): ProjectManifest['tracker'] {
  const section = mapping(value, 'tracker', notes);
  known(section, 'tracker', ['provider', 'local'], notes);
  const local = mapping(section.local, 'tracker.local', notes);
  known(local, 'tracker.local', ['issues'], notes);
  return {
    // Absent means local: assuming a remote tracker nobody declared would be a worse guess.
    provider: oneOf(section.provider, 'tracker.provider', TRACKER_PROVIDERS, 'local', notes),
    local: { issues: optionalString(local.issues, 'tracker.local.issues', notes) ?? 'docs/specs' },
  };
}

function readKnowledge(value: unknown, notes: Notes): ProjectManifest['knowledge'] {
  const section = mapping(value, 'knowledge', notes);
  known(section, 'knowledge', ['context', 'docs', 'adr', 'specs'], notes);
  return {
    context: optionalString(section.context, 'knowledge.context', notes) ?? 'CONTEXT.md',
    docs: optionalString(section.docs, 'knowledge.docs', notes) ?? 'docs',
    adr: optionalString(section.adr, 'knowledge.adr', notes) ?? 'docs/adr',
    specs: optionalString(section.specs, 'knowledge.specs', notes) ?? 'docs/specs',
  };
}

function readWorkflow(value: unknown, notes: Notes): ProjectManifest['workflow'] {
  const section = mapping(value, 'workflow', notes);
  known(section, 'workflow', ['provider', 'scratch'], notes);
  return {
    provider: optionalString(section.provider, 'workflow.provider', notes),
    scratch: optionalString(section.scratch, 'workflow.scratch', notes) ?? '.scratch',
  };
}

/**
 * Capability names are open on purpose: a tool Binnacle has never heard of is a fact
 * about the user's machine, not a mistake in their file. Only the value is checked.
 */
function readCapabilities(value: unknown, notes: Notes): Record<string, Capability> {
  const section = mapping(value, 'capabilities', notes);
  const capabilities: Record<string, Capability> = {};
  for (const [name, raw] of Object.entries(section)) {
    if (typeof raw === 'boolean' || raw === 'optional') {
      capabilities[name] = raw;
      continue;
    }
    notes.problems.push({ path: `capabilities.${name}`, message: 'expected true, false or "optional"' });
  }
  return capabilities;
}

function readAutomation(value: unknown, notes: Notes): ProjectManifest['automation'] {
  const section = mapping(value, 'automation', notes);
  known(section, 'automation', ['mode', 'max_parallel_development_tasks'], notes);
  return {
    // v1 is manual-first (ADR-0001), so there is exactly one mode and naming another is a problem.
    mode: oneOf(section.mode, 'automation.mode', AUTOMATION_MODES, 'manual', notes),
    maxParallelDevelopmentTasks:
      positiveInteger(section.max_parallel_development_tasks, 'automation.max_parallel_development_tasks', notes) ?? 2,
  };
}

function readTelemetry(value: unknown, notes: Notes): ProjectManifest['telemetry'] {
  const section = mapping(value, 'telemetry', notes);
  known(section, 'telemetry', ['privacy', 'import'], notes);
  const importing = mapping(section.import, 'telemetry.import', notes);
  known(importing, 'telemetry.import', ['window_days'], notes);
  return {
    privacy: oneOf(section.privacy, 'telemetry.privacy', TELEMETRY_PRIVACY, 'metadata', notes),
    import: {
      // Null is meaningful here: it means the whole archive, not "unset".
      windowDays:
        importing.window_days === null || importing.window_days === undefined
          ? null
          : (positiveInteger(importing.window_days, 'telemetry.import.window_days', notes) ?? null),
    },
  };
}

function asMapping(value: unknown, path: string, notes: Notes): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    notes.problems.push({ path: path || '(document)', message: 'expected a YAML mapping' });
    return null;
  }
  return value as Record<string, unknown>;
}

/** An absent section is not a problem — every field in it has a default. A malformed one is. */
function mapping(value: unknown, path: string, notes: Notes): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  return asMapping(value, path, notes) ?? {};
}

function known(section: Record<string, unknown>, prefix: string, names: string[], notes: Notes): void {
  for (const name of Object.keys(section)) {
    if (names.includes(name)) continue;
    notes.warnings.push({
      path: prefix ? `${prefix}.${name}` : name,
      message: 'unknown key, ignored — written by a newer Binnacle, or a typo',
    });
  }
}

function requiredString(value: unknown, path: string, notes: Notes): string | null {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  notes.problems.push({ path, message: 'expected a non-empty string' });
  return null;
}

function optionalString(value: unknown, path: string, notes: Notes): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  notes.problems.push({ path, message: 'expected a non-empty string' });
  return null;
}

function oneOf<T extends string>(value: unknown, path: string, allowed: T[], fallback: T, notes: Notes): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string' && (allowed as string[]).includes(value)) return value as T;
  notes.problems.push({ path, message: `expected one of ${allowed.join(', ')}` });
  return fallback;
}

function positiveInteger(value: unknown, path: string, notes: Notes): number | null {
  if (value === undefined || value === null) return null;
  if (Number.isInteger(value) && (value as number) > 0) return value as number;
  notes.problems.push({ path, message: 'expected a positive integer' });
  return null;
}
