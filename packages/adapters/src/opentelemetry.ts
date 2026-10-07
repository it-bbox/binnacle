import type { UsageRecord } from '@binnacle/telemetry';
import { count, isObject } from './artifact.ts';

/**
 * A call as an OpenTelemetry event reports it: a usage record without the working directory
 * and branch, which no event of these harnesses carries, and which the daemon takes from the
 * session's artifact records.
 */
export type TelemetryRecord = Omit<UsageRecord, 'cwd' | 'branch'>;

/**
 * The calls in an OTLP JSON logs export (`ExportLogsServiceRequest`), one record per event of
 * a call with its token counts: Claude Code's `claude_code.api_request`, Codex's
 * `codex.sse_event` of kind `response.completed` and Gemini CLI's `gemini_cli.api_response`.
 * Only the session id, request id, model, timestamp and token counts are taken; every other
 * attribute — prompts, responses, tool input, the user's identity — is never read into a
 * record, whatever the harness was told to export. Any other event, or an event without a
 * session id or a timestamp, gives no record.
 */
export function readOtlpLogs(body: unknown): TelemetryRecord[] {
  const records: TelemetryRecord[] = [];
  for (const resource of list(isObject(body) ? body.resourceLogs : undefined)) {
    for (const scope of list(resource.scopeLogs)) {
      const name = isObject(scope.scope) ? scope.scope.name : undefined;
      for (const log of list(scope.logRecords)) {
        const record = call(log, typeof name === 'string' ? name : '');
        if (record) records.push(record);
      }
    }
  }
  return records;
}

/** An event's attributes, read as a string or as a token count. */
type Event = { text: (key: string) => string | null; tokens: (key: string) => number | null };
/** What tells one harness's event from another's: its session, its request id and its counts. */
type Mapped = Pick<TelemetryRecord, 'harness' | 'requestId' | 'tokens' | 'provenance'> & { sessionId: string | null };

function call(log: Record<string, unknown>, scope: string): TelemetryRecord | null {
  const attributes = new Map(list(log.attributes).map((attribute) => [attribute.key, isObject(attribute.value) ? value(attribute.value) : null]));
  const event: Event = {
    text: (key) => {
      const found = attributes.get(key);
      return typeof found === 'string' && found !== '' ? found : null;
    },
    tokens: (key) => {
      const found = attributes.get(key);
      return count(typeof found === 'string' && /^\d+$/.test(found) ? Number(found) : found);
    },
  };
  const body = isObject(log.body) ? value(log.body) : null;
  const name = event.text('event.name');
  // Claude Code names its event in its body, and in `event.name` without the prefix under its own scope.
  const mapped =
    body === 'claude_code.api_request' || name === 'claude_code.api_request' || (name === 'api_request' && scope.startsWith('com.anthropic.claude_code'))
      ? claudeCode(event)
      : name === 'codex.sse_event' && event.text('event.kind') === 'response.completed'
        ? codex(event)
        : name === 'gemini_cli.api_response'
          ? geminiCli(event)
          : null;
  if (mapped === null) return null;

  const stamped = event.text('event.timestamp');
  const nanos = String(log.timeUnixNano ?? '');
  const time = stamped !== null ? Date.parse(stamped) : /^\d+$/.test(nanos) ? Number(BigInt(nanos) / 1_000_000n) : NaN;
  const { harness, sessionId, requestId, tokens, provenance } = mapped;
  if (sessionId === null || !(time > 0)) return null;
  const timestamp = new Date(time).toISOString();
  return {
    harness,
    // Unique per call, so that a batch the exporter sends again is the same records again.
    naturalKey: `otel:${requestId ?? event.text('client_request_id') ?? `${sessionId}:${timestamp}:${String(attributes.get('event.sequence') ?? '')}`}`,
    requestId,
    sessionId,
    // ponytail: no event names a subagent, so a subagent's call its artifact does not have yet
    // counts in its parent session's run; take Claude Code's `query_source` if those runs must be told apart.
    subagentId: null,
    parentSession: null,
    timestamp,
    provider: null,
    model: event.text('model'),
    tokens,
    provenance,
  };
}

/** Claude Code's counts, each as its provider reported it; the event has no thinking tokens. */
const claudeCode = (event: Event): Mapped => ({
  harness: 'claude-code',
  sessionId: event.text('session.id'),
  requestId: event.text('request_id'),
  tokens: {
    input: event.tokens('input_tokens'),
    cachedInput: event.tokens('cache_read_tokens'),
    cacheCreation: event.tokens('cache_creation_tokens'),
    output: event.tokens('output_tokens'),
    reasoning: null,
  },
  provenance: 'provider_reported',
});

/**
 * Codex's counts as `readCodex` computes them from its rollout, so that the two are the same
 * call: input less the input read from cache, calculated, and no cache creation, which Codex
 * may count inside its input. Its session is the conversation, the rollout's session id.
 */
function codex(event: Event): Mapped {
  const input = event.tokens('input_token_count');
  const cached = event.tokens('cached_token_count');
  return {
    harness: 'codex',
    sessionId: event.text('conversation.id'),
    requestId: null,
    tokens: {
      input: input === null || cached === null || cached > input ? null : input - cached,
      cachedInput: cached,
      cacheCreation: null,
      output: event.tokens('output_token_count'),
      reasoning: event.tokens('reasoning_token_count'),
    },
    provenance: 'calculated',
  };
}

/**
 * Gemini CLI's counts, which are Gemini's usage metadata: its prompt includes the input read
 * from cache, and its tool-use prompt and thoughts are counted beside the prompt and the
 * candidates. So input is the prompt less the cached input plus the tool-use prompt, and
 * output the candidates plus the thoughts, which are its reasoning: calculated, each null when
 * a count it needs is absent. Gemini reports no cache creation.
 */
function geminiCli(event: Event): Mapped {
  const prompt = event.tokens('input_token_count');
  const cached = event.tokens('cached_content_token_count');
  const tool = event.tokens('tool_token_count');
  const candidates = event.tokens('output_token_count');
  const thoughts = event.tokens('thoughts_token_count');
  return {
    harness: 'gemini-cli',
    sessionId: event.text('session.id'),
    requestId: null,
    tokens: {
      input: prompt === null || cached === null || tool === null || cached > prompt ? null : prompt - cached + tool,
      cachedInput: cached,
      cacheCreation: null,
      output: candidates === null || thoughts === null ? null : candidates + thoughts,
      reasoning: thoughts,
    },
    provenance: 'calculated',
  };
}

/** An OTLP `AnyValue`'s string or number; an int64 is a decimal string in OTLP JSON. */
function value(any: Record<string, unknown>): string | number | null {
  const found = any.stringValue ?? any.intValue ?? any.doubleValue;
  return typeof found === 'string' || typeof found === 'number' ? found : null;
}

const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter(isObject) : []);
