import { terminalText } from '@binnacle/core';
import { readToken } from '@binnacle/daemon';
import { DaemonUnreachableError, OperationFailedError } from './client.ts';
import { EXIT, type ExitCode } from './exit.ts';
import { say, T } from './text.ts';

/** No token in the home: `auth.missing` for `binn mcp` and `binn call`, with the home named for a person. */
class TokenMissingError extends OperationFailedError {
  home: string;

  constructor(home: string) {
    super('auth.missing', `No Binnacle API token in ${home}.`);
    this.home = home;
  }
}

/** Both command groups need the token and report its absence identically. */
export function requireToken(home: string): string {
  const token = readToken(home);
  if (!token) throw new TokenMissingError(home);
  return token;
}

/**
 * Maps a failed call to the exit code that says why, so that scripts can branch on the cause, and
 * says the cause in the person's language, without its code.
 */
export function reportFailure(error: unknown): ExitCode {
  if (error instanceof DaemonUnreachableError) {
    console.error(`binn: ${T.unreachable(error.address)}`);
    return EXIT.unreachable;
  }
  if (error instanceof TokenMissingError) {
    console.error(`binn: ${T.tokenMissing(error.home)}`);
    return EXIT.failed;
  }
  if (error instanceof OperationFailedError) {
    // A detail can quote the user's manifest, a key or a line of it: no control or bidi character reaches the terminal.
    console.error(terminalText(`binn: ${say(error)}`));
    for (const detail of error.details ?? []) console.error(terminalText(`  ${detail.path}: ${say(detail)}`));
    return EXIT.failed;
  }
  throw error;
}
