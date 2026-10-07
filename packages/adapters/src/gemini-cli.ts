import type { UsageRecord } from '@binnacle/telemetry';
import { count, isObject, readMessages, type ArtifactReading } from './artifact.ts';

/** What a Gemini CLI session file does not say itself: the directory it ran in, and the session that started it, for a subagent's. */
export type GeminiCliSession = { cwd: string; parentSession: string | null };

/**
 * A Gemini CLI session file (`<project temp dir>/chats/session-*.jsonl`, a subagent's in
 * `chats/<parent session>/`), from its start, to normalised records: one per `gemini`
 * message, the model's turn. A file is always read from its start, because the session's id
 * is on its first line, its metadata (`readLines` says how the bytes are read).
 *
 * Gemini CLI appends a message again, whole and with the same id, when it gains its tokens or
 * its tool calls' results, so a message is its last line and the last one read waits until
 * `settled` (`readMessages`). Its other lines — prompts, notices, `$patch`, `$set` and
 * `$rewindTo` — give no record: a rewound call was still made. Only the id, timestamp, model
 * and tokens are read, never content, thoughts or tool calls.
 *
 * Every count is `calculated`. Gemini's prompt count includes what was read from cache and
 * leaves out the tool-use prompt, so input not read from cache is `input − cached + tool`;
 * its output leaves out thoughts, which are reasoning, so output is `output + thoughts`, as
 * reasoning is a part of output on every harness; a sum missing one of its parts is null,
 * never the parts there are. Cache creation is not reported. A message
 * written without tokens has every count null; Gemini CLI writes a count its API did not give
 * as 0, which cannot be told from a reported 0. The model's provider is not written (ADR-0004),
 * and neither is a branch.
 */
export function readGeminiCli(bytes: Buffer, { cwd, parentSession }: GeminiCliSession, settled: boolean): ArtifactReading {
  let sessionId: string | null = null;
  return readMessages(bytes, { offset: 0, line: 0 }, settled, (value): UsageRecord | null | string => {
    if (sessionId === null && value.type === undefined && typeof value.sessionId === 'string') {
      sessionId = value.sessionId;
      return null;
    }
    if (value.type !== 'gemini') return null;
    const time = typeof value.timestamp === 'string' ? Date.parse(value.timestamp) : NaN;
    if (typeof value.id !== 'string') return 'a gemini message without an id';
    if (Number.isNaN(time)) return 'a gemini message without a timestamp';
    if (sessionId === null) return 'a gemini message before the session metadata';

    const tokens = isObject(value.tokens) ? value.tokens : {};
    const [input, cached, output, thoughts, tool] = [count(tokens.input), count(tokens.cached), count(tokens.output), count(tokens.thoughts), count(tokens.tool)];
    if (input !== null && cached !== null && cached > input) return 'more input read from cache than input';
    return {
      harness: 'gemini-cli',
      naturalKey: value.id,
      requestId: null,
      sessionId: parentSession ?? sessionId,
      subagentId: parentSession === null ? null : sessionId,
      parentSession,
      timestamp: new Date(time).toISOString(),
      cwd,
      branch: null,
      provider: null,
      model: typeof value.model === 'string' ? value.model : null,
      tokens: {
        input: input === null || cached === null || tool === null ? null : input - cached + tool,
        cachedInput: cached,
        cacheCreation: null,
        output: output === null || thoughts === null ? null : output + thoughts,
        reasoning: thoughts,
      },
      provenance: 'calculated',
    };
  });
}
