/**
 * A fake `systemctl` that records its arguments and answers as the real one does, keeping
 * whether the unit is enabled and active in files. Shell builtins only, so that its PATH
 * holds nothing else: the real `systemctl` is never reachable from these tests.
 */
export const fakeSystemctl = (log: string, state: string): string => `#!/bin/sh
printf '%s\\n' "$*" >> '${log}'
flag() { [ -e '${state}'/"$1" ] && { read v < '${state}'/"$1"; [ "$v" = yes ]; }; }
set_flag() { printf '%s\\n' "$2" > '${state}'/"$1"; }
case "$*" in
  "--user show-environment") flag no-manager && { echo 'Failed to connect to bus: No medium found' >&2; exit 1; } ;;
  "--user is-enabled binnacle") flag enabled && { echo enabled; exit 0; }; echo disabled; exit 1 ;;
  "--user is-active binnacle") flag active && { echo active; exit 0; }; echo inactive; exit 3 ;;
  "--user enable binnacle") flag refuse && { echo 'Failed to enable unit: Access denied' >&2; exit 1; }; set_flag enabled yes ;;
  "--user restart binnacle") set_flag active yes ;;
  "--user disable --now binnacle") set_flag enabled no; set_flag active no ;;
esac
exit 0
`;
