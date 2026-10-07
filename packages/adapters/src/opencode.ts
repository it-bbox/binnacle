import { DatabaseSync } from 'node:sqlite';
import type { UsageRecord } from '@binnacle/telemetry';
import { count, isObject } from './artifact.ts';

/**
 * One model call as opencode's database holds it: a `step-finish` part, the time its row was
 * written, its session and the session that started it, and the assistant message it belongs
 * to, the part and the message as the JSON opencode stores.
 */
export type OpencodeStep = { id: string; sessionId: string; parentSession: string | null; time: number; part: string; message: string };

export type OpencodeReading = {
  records: UsageRecord[];
  /** The step the reading stopped at because it could not be read, and why. */
  failure: { step: string; reason: string } | null;
};

/**
 * Every step of opencode's database at `path` (`opencode.db`), oldest first, read without
 * writing to it. opencode writes a `step-finish` part once a call has finished, with its
 * tokens, so every step read is whole. Throws when the database cannot be opened or read.
 */
export function readOpencodeSteps(path: string): OpencodeStep[] {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    // The `like` narrows the parts before they are parsed; `readOpencode` checks each one's type.
    return db
      .prepare(
        `select part.id, part.session_id as sessionId, session.parent_id as parentSession, part.time_created as time, part.data as part, message.data as message
         from part join message on message.id = part.message_id join session on session.id = part.session_id
         where part.data like '%"type":"step-finish"%'
         order by part.time_created, part.id`,
      )
      .all() as OpencodeStep[];
  } finally {
    db.close();
  }
}

/**
 * opencode's steps, oldest first, to normalised records: one per `step-finish` part, a model
 * call. The reading stops at a step it cannot read, with the reason, and keeps those before
 * it. Only the ids, time, directory, provider, model and tokens are read, never content.
 *
 * Every count is `calculated`. opencode writes input without what was read from cache or
 * written to it, as Binnacle counts it, and the two apart; its output leaves out reasoning,
 * so output is `output + reasoning`, as reasoning is a part of output on every harness, and
 * null when either is missing. A count opencode does not have is null; opencode writes a
 * count its provider did not give as 0, which cannot be told from a reported 0. A subagent is
 * a session opencode started from another, under which its records go. Its provider is the one
 * opencode names; a branch is not written.
 */
export function readOpencode(steps: OpencodeStep[]): OpencodeReading {
  const records: UsageRecord[] = [];
  for (const step of steps) {
    const result = readStep(step);
    if (typeof result === 'string') return { records, failure: { step: step.id, reason: result } };
    if (result) records.push(result);
  }
  return { records, failure: null };
}

function readStep(step: OpencodeStep): UsageRecord | null | string {
  const part = parsed(step.part, 'part');
  if (typeof part === 'string') return part;
  if (part.type !== 'step-finish') return null;
  const message = parsed(step.message, 'message');
  if (typeof message === 'string') return message;
  if (message.role !== 'assistant') return 'a step of no assistant message';
  const cwd = isObject(message.path) ? message.path.cwd : undefined;
  if (typeof cwd !== 'string' || cwd === '') return 'an assistant message without its directory';
  if (!Number.isFinite(step.time)) return 'a step without the time it was written';

  const tokens = isObject(part.tokens) ? part.tokens : {};
  const cache = isObject(tokens.cache) ? tokens.cache : {};
  const [output, reasoning] = [count(tokens.output), count(tokens.reasoning)];
  return {
    harness: 'opencode',
    naturalKey: step.id,
    requestId: null,
    sessionId: step.parentSession ?? step.sessionId,
    subagentId: step.parentSession === null ? null : step.sessionId,
    parentSession: step.parentSession,
    timestamp: new Date(step.time).toISOString(),
    cwd,
    branch: null,
    provider: typeof message.providerID === 'string' ? message.providerID : null,
    model: typeof message.modelID === 'string' ? message.modelID : null,
    tokens: {
      input: count(tokens.input),
      cachedInput: count(cache.read),
      cacheCreation: count(cache.write),
      output: output === null || reasoning === null ? null : output + reasoning,
      reasoning,
    },
    provenance: 'calculated',
  };
}

function parsed(text: string, what: 'part' | 'message'): Record<string, unknown> | string {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return `a ${what} that is not JSON`;
  }
  return isObject(value) ? value : `a ${what} that is not a JSON object`;
}
