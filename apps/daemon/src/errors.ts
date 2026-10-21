import type { Params } from '@binnacle/core';

/**
 * The shared error envelope. `code` is part of the API contract and is not reworded
 * per release so that tooling can branch on it; `message` is for a human and may change.
 * `params`, on the error and on each detail, are the values its English message is written
 * from, so that a person's surface words it in their language from its code (`@binnacle/core`'s
 * `wordMessage`).
 */
export type ErrorDetail = {
  path: string;
  message: string;
  code: string;
  params?: Params;
};

export type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
    params?: Params;
  };
};

export class OperationError extends Error {
  code: string;
  status: number;
  details: ErrorDetail[] | undefined;
  params: Params | undefined;

  constructor(code: string, message: string, status = 400, details?: ErrorDetail[], params?: Params) {
    super(message);
    this.name = 'OperationError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.params = params;
  }

  toEnvelope(): ErrorEnvelope {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
        ...(this.params && { params: this.params }),
      },
    };
  }
}

/** One wording for a missing path, whether it was asked about or is a registration's. */
export const pathNotFound = (path: string): OperationError =>
  new OperationError('project.path_not_found', `No directory at ${path}.`, 400, undefined, { path });

/** A request whose `field` is not what the operation takes: `detail` says what was expected, worded by `code` from `params`. */
export const invalidRequest = (field: string, message: string, detail: string, code: string, params: Params = {}): OperationError =>
  new OperationError('request.invalid', message, 400, [{ path: field, message: detail, code, params }], { field });

export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return false;
  const body = error as Record<string, unknown>;
  return typeof body.code === 'string' && typeof body.message === 'string';
}
