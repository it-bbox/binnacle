import { DatabaseSync } from 'node:sqlite';
import type { UsageRecord } from '@binnacle/telemetry';
import { count, readSessionRows, type DatabaseReading } from './artifact.ts';

/**
 * One model call as ZCode's database holds it: a `model_usage` row, the time it completed,
 * its session, the directory that session was launched in and the session that started it,
 * the provider and model it names, and its counts as ZCode wrote them.
 */
export type ZcodeCall = {
  id: string;
  sessionId: string;
  directory: string;
  parentSession: string | null;
  time: number;
  provider: string | null;
  model: string | null;
  input: number | null;
  output: number | null;
  reasoning: number | null;
  cacheCreation: number | null;
  cacheRead: number | null;
};

/**
 * Every completed call in ZCode's database at `path` (`~/.zcode/cli/db/db.sqlite`), oldest
 * first, read without writing to it. Only `model_usage`'s metadata and counts and `session`'s
 * directory and parent are read; ZCode's rollout files carry every prompt and are never read.
 * Throws when the database cannot be opened or read.
 */
export function readZcodeCalls(path: string): ZcodeCall[] {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return db
      .prepare(
        `select usage.id, usage.session_id as sessionId, session.directory, session.parent_id as parentSession, usage.completed_at as time,
           usage.provider_id as provider, usage.model_id as model, usage.input_tokens as input, usage.output_tokens as output,
           usage.reasoning_tokens as reasoning, usage.cache_creation_input_tokens as cacheCreation, usage.cache_read_input_tokens as cacheRead
         from model_usage as usage join session on session.id = usage.session_id
         where usage.completed_at is not null
         order by usage.completed_at, usage.id`,
      )
      .all() as ZcodeCall[];
  } finally {
    db.close();
  }
}

/**
 * ZCode's calls, oldest first, to normalised records, one per call, the agent's and the one
 * that titles a session alike. A session's reading stops at a call it cannot read, with the
 * reason, keeping the calls before it; the other sessions', every project's in one database,
 * go on.
 *
 * Every count is `calculated`. ZCode's input includes the input read from cache, as ticket 06
 * found, so input is less the cached input and the input written to cache, and null when
 * either is unknown or they exceed it. ponytail: that cache writes are within input too is
 * read from ZCode's usage naming them beside its input, as the AI SDK it builds on does; the
 * sample wrote none, so the exit demonstration confirms it. Its output includes reasoning,
 * as Binnacle counts it. A count ZCode does not have is null. A subagent is a session ZCode
 * started from another, under which its records go. Its provider is the one ZCode names, an
 * account of a plan as it writes it; a branch is not written.
 */
export function readZcode(calls: ZcodeCall[]): DatabaseReading {
  return readSessionRows(calls, readCall);
}

/** A call's record, or why it cannot be read. */
function readCall(call: ZcodeCall): UsageRecord | string {
  if (typeof call.directory !== 'string' || call.directory === '') return 'a call of a session without its directory';
  if (!Number.isFinite(call.time)) return 'a call without the time it completed';
  const [input, cachedInput, cacheCreation] = [count(call.input), count(call.cacheRead), count(call.cacheCreation)];
  const uncached = input === null || cachedInput === null || cacheCreation === null ? null : input - cachedInput - cacheCreation;
  return {
    harness: 'zcode',
    naturalKey: call.id,
    requestId: null,
    sessionId: call.parentSession ?? call.sessionId,
    subagentId: call.parentSession === null ? null : call.sessionId,
    parentSession: call.parentSession,
    timestamp: new Date(call.time).toISOString(),
    cwd: call.directory,
    branch: null,
    provider: typeof call.provider === 'string' ? call.provider : null,
    model: typeof call.model === 'string' ? call.model : null,
    tokens: {
      input: uncached !== null && uncached >= 0 ? uncached : null,
      cachedInput,
      cacheCreation,
      output: count(call.output),
      reasoning: count(call.reasoning),
    },
    provenance: 'calculated',
  };
}
