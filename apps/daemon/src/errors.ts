/**
 * The shared error envelope. `code` is part of the API contract and is not reworded
 * per release so that tooling can branch on it; `message` is for a human and may change.
 */
export type ErrorDetail = {
  path: string;
  message: string;
};

export type ErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: ErrorDetail[];
  };
};

export class OperationError extends Error {
  code: string;
  status: number;
  details: ErrorDetail[] | undefined;

  constructor(code: string, message: string, status = 400, details?: ErrorDetail[]) {
    super(message);
    this.name = 'OperationError';
    this.code = code;
    this.status = status;
    this.details = details;
  }

  toEnvelope(): ErrorEnvelope {
    return {
      error: this.details
        ? { code: this.code, message: this.message, details: this.details }
        : { code: this.code, message: this.message },
    };
  }
}

/** One wording for a missing path, whether it was asked about or is a registration's. */
export const pathNotFound = (path: string): OperationError =>
  new OperationError('project.path_not_found', `No directory at ${path}.`, 400);

export function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const error = (value as { error?: unknown }).error;
  if (typeof error !== 'object' || error === null) return false;
  const body = error as Record<string, unknown>;
  return typeof body.code === 'string' && typeof body.message === 'string';
}
