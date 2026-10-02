/** The areas of `binn audit`, in the order the report lists them (docs/05-mvp-plan.md, phase 6). */
export const AUDIT_AREAS = [
  'git-and-tracker',
  'docs',
  'matt-pocock-layout',
  'scratch',
  'capabilities',
  'instructions',
  'structure',
  'telemetry',
] as const;

export type AuditArea = (typeof AUDIT_AREAS)[number];

/**
 * What one check found. `gap` is a file or setting looked for and found absent or wrong;
 * `unknown` is an answer the files cannot give. The recommendation is advice, set for a `gap`
 * or an `unknown` and absent for an `ok`. There is no score.
 */
export type Finding = {
  /** `<topic>.<check>`, stable: scripts filter on it. */
  code: string;
  area: AuditArea;
  status: 'ok' | 'gap' | 'unknown';
  reason: string;
  recommendation?: string;
};
