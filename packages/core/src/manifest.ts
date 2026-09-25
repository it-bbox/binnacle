/**
 * Validation of `.binnacle/project.yaml`, as a pure function over an already-parsed
 * document. Reading the file and parsing YAML happen outside this package, which is
 * why `packages/core` has no runtime dependencies.
 *
 * Three rules shape the whole file:
 *
 * - Every problem is collected rather than thrown, so a broken manifest is one edit to
 *   fix and not one edit per run.
 * - An unknown key is a warning, never a failure, so a manifest written by a newer
 *   Binnacle degrades instead of stopping an older one.
 * - **A field the user did not write comes back null.** No default is substituted here.
 *   ADR-0007's rule against inventing values is not only about telemetry: a consumer
 *   that cannot tell a declared `tracker.provider` from an assumed one would raise
 *   diagnostics against a choice nobody made. Defaults belong at the point of use.
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
  tracker: {
    provider: TrackerProvider | null;
    /** `owner/name` on GitHub, the full project path on GitLab. Never inferred from a Git remote. */
    repository: string | null;
    /** A hostname, or a base URL with a scheme, used as the API root as given. */
    host: string | null;
    local: { issues: string | null };
  };
  knowledge: { context: string | null; docs: string | null; adr: string | null; specs: string | null };
  workflow: { provider: string | null; scratch: string | null };
  capabilities: Record<string, Capability>;
  automation: { mode: AutomationMode | null; maxParallelDevelopmentTasks: number | null };
  telemetry: { privacy: TelemetryPrivacy | null; import: { windowDays: number | 'all' | null } };
};

export type ManifestValidation = {
  /** Null when there are problems: a manifest is either wholly usable or not offered at all. */
  manifest: ProjectManifest | null;
  problems: ManifestProblem[];
  warnings: ManifestProblem[];
  /**
   * True, false, or **null when the question does not arise** — a document that is not a
   * mapping has no version to support, and reporting one would name a field the user
   * never wrote instead of the thing that is actually wrong.
   */
  versionSupported: boolean | null;
};

const TRACKER_PROVIDERS: TrackerProvider[] = ['github', 'gitlab', 'local'];
const AUTOMATION_MODES: AutomationMode[] = ['manual'];
const TELEMETRY_PRIVACY: TelemetryPrivacy[] = ['metadata', 'content'];

const SECTIONS = ['version', 'project', 'tracker', 'knowledge', 'workflow', 'capabilities', 'automation', 'telemetry'];

type Notes = { problems: ManifestProblem[]; warnings: ManifestProblem[] };

export function validateManifest(document: unknown): ManifestValidation {
  const notes: Notes = { problems: [], warnings: [] };

  const root = requireMapping(document, '', notes);
  if (!root) {
    return { manifest: null, problems: notes.problems, warnings: notes.warnings, versionSupported: null };
  }

  const versionSupported = root.version === MANIFEST_VERSION;
  if (!versionSupported) {
    notes.problems.push({
      path: 'version',
      message: `expected ${MANIFEST_VERSION}, got ${describe(root.version)}`,
    });
  }

  warnUnknownKeys(root, '', SECTIONS, notes);

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
  const section = sectionOf(value, 'project', notes);
  warnUnknownKeys(section, 'project', ['id', 'name'], notes);
  return {
    id: requiredString(section.id, 'project.id', notes) ?? '',
    name: optionalString(section.name, 'project.name', notes),
  };
}

function readTracker(value: unknown, notes: Notes): ProjectManifest['tracker'] {
  const section = sectionOf(value, 'tracker', notes);
  warnUnknownKeys(section, 'tracker', ['provider', 'repository', 'host', 'local'], notes);
  const local = sectionOf(section.local, 'tracker.local', notes);
  warnUnknownKeys(local, 'tracker.local', ['issues'], notes);
  return {
    provider: oneOf(section.provider, 'tracker.provider', TRACKER_PROVIDERS, notes),
    repository: optionalString(section.repository, 'tracker.repository', notes),
    host: optionalString(section.host, 'tracker.host', notes),
    local: { issues: optionalString(local.issues, 'tracker.local.issues', notes) },
  };
}

function readKnowledge(value: unknown, notes: Notes): ProjectManifest['knowledge'] {
  const section = sectionOf(value, 'knowledge', notes);
  warnUnknownKeys(section, 'knowledge', ['context', 'docs', 'adr', 'specs'], notes);
  return {
    context: optionalString(section.context, 'knowledge.context', notes),
    docs: optionalString(section.docs, 'knowledge.docs', notes),
    adr: optionalString(section.adr, 'knowledge.adr', notes),
    specs: optionalString(section.specs, 'knowledge.specs', notes),
  };
}

function readWorkflow(value: unknown, notes: Notes): ProjectManifest['workflow'] {
  const section = sectionOf(value, 'workflow', notes);
  warnUnknownKeys(section, 'workflow', ['provider', 'scratch'], notes);
  return {
    provider: optionalString(section.provider, 'workflow.provider', notes),
    scratch: optionalString(section.scratch, 'workflow.scratch', notes),
  };
}

/**
 * Capability names are open on purpose, so no unknown-key warning is raised here: a tool
 * Binnacle has never heard of is a fact about the user's machine, not a mistake in their
 * file. Only the value is checked.
 */
function readCapabilities(value: unknown, notes: Notes): Record<string, Capability> {
  const section = sectionOf(value, 'capabilities', notes);
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
  const section = sectionOf(value, 'automation', notes);
  warnUnknownKeys(section, 'automation', ['mode', 'max_parallel_development_tasks'], notes);
  return {
    // v1 is manual-first (ADR-0001), so there is exactly one mode and naming another is a problem.
    mode: oneOf(section.mode, 'automation.mode', AUTOMATION_MODES, notes),
    maxParallelDevelopmentTasks: positiveInteger(
      section.max_parallel_development_tasks,
      'automation.max_parallel_development_tasks',
      notes,
    ),
  };
}

function readTelemetry(value: unknown, notes: Notes): ProjectManifest['telemetry'] {
  const section = sectionOf(value, 'telemetry', notes);
  warnUnknownKeys(section, 'telemetry', ['privacy', 'import'], notes);
  const importing = sectionOf(section.import, 'telemetry.import', notes);
  warnUnknownKeys(importing, 'telemetry.import', ['window_days'], notes);
  return {
    privacy: oneOf(section.privacy, 'telemetry.privacy', TELEMETRY_PRIVACY, notes),
    // A number of days, or `all` for everything on disk. Null is "not stated"; the default
    // it falls back to belongs to whoever imports, not to validation.
    import: {
      windowDays:
        importing.window_days === 'all' ? 'all' : positiveInteger(importing.window_days, 'telemetry.import.window_days', notes, 'or all'),
    },
  };
}

/** Records a problem and returns null when the value is not a mapping at all. */
function requireMapping(value: unknown, path: string, notes: Notes): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    notes.problems.push({ path: path || '(document)', message: `expected a YAML mapping, got ${describe(value)}` });
    return null;
  }
  return value as Record<string, unknown>;
}

/** An absent section is not a problem — every field in it may be absent too. A malformed one is. */
function sectionOf(value: unknown, path: string, notes: Notes): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  return requireMapping(value, path, notes) ?? {};
}

function warnUnknownKeys(section: Record<string, unknown>, prefix: string, names: string[], notes: Notes): void {
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
  return requiredString(value, path, notes);
}

function oneOf<T extends string>(value: unknown, path: string, allowed: T[], notes: Notes): T | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && (allowed as string[]).includes(value)) return value as T;
  notes.problems.push({ path, message: `expected one of ${allowed.join(', ')}` });
  return null;
}

function positiveInteger(value: unknown, path: string, notes: Notes, alternative = ''): number | null {
  if (value === undefined || value === null) return null;
  if (Number.isInteger(value) && (value as number) > 0) return value as number;
  notes.problems.push({ path, message: `expected a positive integer${alternative ? ` ${alternative}` : ''}` });
  return null;
}

/** Names a value's shape without quoting its contents: manifests are not a place for secrets, but nothing here echoes one. */
function describe(value: unknown): string {
  if (value === undefined) return 'nothing';
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'a list';
  if (value instanceof Date) return 'a date';
  return typeof value === 'object' ? 'a mapping' : typeof value;
}
