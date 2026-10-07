import type { UsageRecord } from '@binnacle/telemetry';
import { count, isObject } from './artifact.ts';

/**
 * A call as an OpenTelemetry event reports it: a usage record without the working directory
 * and branch, which no event of these harnesses carries, and which the daemon takes from the
 * session's artifact records.
 */
export type TelemetryRecord = Omit<UsageRecord, 'cwd' | 'branch'>;

/**
 * The calls in an OTLP JSON logs export (`ExportLogsServiceRequest`), one record per
 * `claude_code.api_request` event. Only the session id, request id, model, timestamp and token
 * counts are taken; every other attribute — prompts, tool input, the user's identity — is never
 * read into a record, whatever the harness was told to export. Any other event, or an event
 * without a session id or a timestamp, gives no record.
 */
export function readOtlpLogs(body: unknown): TelemetryRecord[] {
  const records: TelemetryRecord[] = [];
  for (const resource of list(isObject(body) ? body.resourceLogs : undefined)) {
    for (const scope of list(resource.scopeLogs)) {
      const name = isObject(scope.scope) ? scope.scope.name : undefined;
      for (const log of list(scope.logRecords)) {
        const record = claudeCodeRequest(log, typeof name === 'string' ? name : '');
        if (record) records.push(record);
      }
    }
  }
  return records;
}

/**
 * Claude Code's `claude_code.api_request` event, which names itself in its body, and in
 * `event.name` without the prefix, under Claude Code's own scope.
 */
function claudeCodeRequest(log: Record<string, unknown>, scope: string): TelemetryRecord | null {
  const attributes = new Map(list(log.attributes).map((attribute) => [attribute.key, isObject(attribute.value) ? value(attribute.value) : null]));
  const body = isObject(log.body) ? value(log.body) : null;
  const event = attributes.get('event.name');
  const named = body === 'claude_code.api_request' || event === 'claude_code.api_request' || (event === 'api_request' && scope.startsWith('com.anthropic.claude_code'));
  if (!named) return null;

  const sessionId = attributes.get('session.id');
  const stamped = attributes.get('event.timestamp');
  const nanos = String(log.timeUnixNano ?? '');
  const time = typeof stamped === 'string' ? Date.parse(stamped) : /^\d+$/.test(nanos) ? Number(BigInt(nanos) / 1_000_000n) : NaN;
  if (typeof sessionId !== 'string' || !(time > 0)) return null;
  const text = (key: string): string | null => {
    const found = attributes.get(key);
    return typeof found === 'string' && found !== '' ? found : null;
  };
  const tokens = (key: string): number | null => {
    const found = attributes.get(key);
    return count(typeof found === 'string' && /^\d+$/.test(found) ? Number(found) : found);
  };
  const timestamp = new Date(time).toISOString();
  const requestId = text('request_id');
  return {
    harness: 'claude-code',
    // Unique per call, so that a batch the exporter sends again is the same records again.
    naturalKey: `otel:${requestId ?? text('client_request_id') ?? `${sessionId}:${timestamp}:${String(attributes.get('event.sequence') ?? '')}`}`,
    requestId,
    sessionId,
    // ponytail: the event names no subagent, so a subagent's call its artifact does not have yet
    // counts in its parent session's run; take `query_source` if those runs must be told apart.
    subagentId: null,
    parentSession: null,
    timestamp,
    provider: null,
    model: text('model'),
    tokens: {
      input: tokens('input_tokens'),
      cachedInput: tokens('cache_read_tokens'),
      cacheCreation: tokens('cache_creation_tokens'),
      output: tokens('output_tokens'),
      reasoning: null,
    },
    provenance: 'provider_reported',
  };
}

/** An OTLP `AnyValue`'s string or number; an int64 is a decimal string in OTLP JSON. */
function value(any: Record<string, unknown>): string | number | null {
  const found = any.stringValue ?? any.intValue ?? any.doubleValue;
  return typeof found === 'string' || typeof found === 'number' ? found : null;
}

const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value.filter(isObject) : []);
