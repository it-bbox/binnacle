/**
 * The normalised usage record every harness reader produces, and the pure arithmetic over
 * it. Nothing here does I/O: finding and reading artifacts is the daemon's, parsing them
 * the adapters'.
 */

/** ADR-0007: a value says where it came from, and nothing is ever invented to fill a gap. */
export type Provenance = 'measured' | 'provider_reported' | 'calculated' | 'estimated';

export type Harness = 'claude-code';

export const TOKEN_FIELDS = ['input', 'cachedInput', 'cacheCreation', 'output', 'reasoning'] as const;
/**
 * `input` is input not read from cache, `cachedInput` input read from cache, and
 * `cacheCreation` input written to it. `reasoning` is a subset of `output` on every
 * harness: it is counted inside it and never added to it (`SUBSET_OF`).
 */
export type TokenField = (typeof TOKEN_FIELDS)[number];
export const SUBSET_OF: Partial<Record<TokenField, TokenField>> = { reasoning: 'output' };

/** One call to a model, as a harness recorded it: metadata and token counts, never content. */
export type UsageRecord = {
  harness: Harness;
  /** Unique within the harness: Claude Code's message id. */
  naturalKey: string;
  sessionId: string;
  timestamp: string;
  cwd: string;
  branch: { name: string; source: 'harness' | 'reflog' } | null;
  /** Null unless the artifact states it: a model name is no proof of who served it (ADR-0004). */
  provider: string | null;
  model: string | null;
  /** Each null when the record does not report it, which is not the same as zero (ADR-0007). */
  tokens: Record<TokenField, number | null>;
  provenance: Provenance;
};

/**
 * A field summed over records: null when none of them reports it, `partial` when only some
 * do. Its provenance is the least direct of the values summed, so a sum of reported values
 * stays reported and one that includes a calculated value is calculated.
 */
export type FieldTotal = { tokens: number | null; partial: boolean; provenance: Provenance | null };
export type Totals = { records: number } & Record<TokenField, FieldTotal>;

const DIRECTNESS: Provenance[] = ['measured', 'provider_reported', 'calculated', 'estimated'];

export function sum(records: Pick<UsageRecord, 'tokens' | 'provenance'>[]): Totals {
  const field = (name: TokenField): FieldTotal => {
    const reporting = records.filter((record) => record.tokens[name] !== null);
    if (reporting.length === 0) return { tokens: null, partial: false, provenance: null };
    return {
      tokens: reporting.reduce((total, record) => total + record.tokens[name]!, 0),
      partial: reporting.length < records.length,
      provenance: DIRECTNESS[Math.max(...reporting.map((record) => DIRECTNESS.indexOf(record.provenance)))]!,
    };
  };
  return { records: records.length, ...(Object.fromEntries(TOKEN_FIELDS.map((name) => [name, field(name)])) as Record<TokenField, FieldTotal>) };
}

/** Every token a total counts once, which orders totals by size: a subset is never added to its superset. */
export const magnitude = (totals: Totals): number =>
  TOKEN_FIELDS.filter((name) => SUBSET_OF[name] === undefined).reduce((total, name) => total + (totals[name].tokens ?? 0), 0);
