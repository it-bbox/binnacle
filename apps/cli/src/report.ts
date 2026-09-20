import { DaemonUnreachableError, OperationFailedError } from './client.ts';
import { EXIT, type ExitCode } from './exit.ts';

/** Maps a failed call to the exit code that says why, so that scripts can branch on the cause. */
export function reportFailure(error: unknown): ExitCode {
  if (error instanceof DaemonUnreachableError) {
    console.error(`binn: ${error.message}`);
    return EXIT.unreachable;
  }
  if (error instanceof OperationFailedError) {
    console.error(`binn: ${error.code}: ${error.message}`);
    for (const detail of error.details ?? []) console.error(`  ${detail.path}: ${detail.message}`);
    return EXIT.failed;
  }
  throw error;
}
