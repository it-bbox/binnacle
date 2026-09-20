/** Exit codes are part of the CLI contract so that scripts can branch on the cause. */
export const EXIT = {
  ok: 0,
  usage: 2,
  failed: 3,
  unreachable: 4,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
