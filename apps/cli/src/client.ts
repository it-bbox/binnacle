import type { Params } from '@binnacle/core';
import { HEALTH_PATH, OPS_PREFIX, isErrorEnvelope, type ErrorDetail, type Runtime } from '@binnacle/daemon';

/** The daemon is not answering on the address its runtime file claims. */
export class DaemonUnreachableError extends Error {
  address: string;

  constructor(address: string, cause: unknown) {
    super(`No Binnacle daemon answered on ${address}.`, { cause });
    this.name = 'DaemonUnreachableError';
    this.address = address;
  }
}

/** The daemon answered with the shared error envelope. */
export class OperationFailedError extends Error {
  code: string;
  details: ErrorDetail[] | undefined;
  params: Params | undefined;

  constructor(code: string, message: string, details?: ErrorDetail[], params?: Params) {
    super(message);
    this.name = 'OperationFailedError';
    this.code = code;
    this.details = details;
    this.params = params;
  }
}

const address = (runtime: Runtime): string => `http://${runtime.host}:${runtime.port}`;

export async function callOperation<T>(
  runtime: Runtime,
  token: string,
  operation: string,
  body: unknown = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${address(runtime)}${OPS_PREFIX}${operation}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new DaemonUnreachableError(address(runtime), error);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (response.ok) return payload as T;
  if (isErrorEnvelope(payload)) {
    throw new OperationFailedError(payload.error.code, payload.error.message, payload.error.details, payload.error.params);
  }
  throw new OperationFailedError('internal.error', `The daemon answered ${response.status} with no error envelope.`);
}

/** Unauthenticated liveness: is a Binnacle daemon listening here? */
export async function isListening(runtime: Runtime): Promise<boolean> {
  try {
    const response = await fetch(`${address(runtime)}${HEALTH_PATH}`, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) return false;
    return ((await response.json()) as { service?: unknown }).service === 'binnacle';
  } catch {
    return false;
  }
}
