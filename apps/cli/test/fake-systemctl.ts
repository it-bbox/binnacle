/**
 * A fake `systemctl` that records its arguments and answers as the real one does, keeping
 * whether the unit is enabled and active in files. Shell builtins only, so that its PATH
 * holds nothing else: the real `systemctl` is never reachable from these tests. With the
 * `runs` flag set, starting the unit runs what its ExecStart names, with its Environment,
 * and stopping it signals that process and waits, as the user manager would.
 */
export const fakeSystemctl = (log: string, state: string, unit: string): string => `#!/bin/sh
printf '%s\\n' "$*" >> '${log}'
flag() { [ -e '${state}'/"$1" ] && { read v < '${state}'/"$1"; [ "$v" = yes ]; }; }
set_flag() { printf '%s\\n' "$2" > '${state}'/"$1"; }
run() {
  flag runs || return 0
  while IFS= read -r line; do
    case "$line" in
      ExecStart=*) cmd=\${line#ExecStart=} ;;
      Environment=*) eval "export \${line#Environment=}" ;;
    esac
  done < '${unit}'
  eval "set -- $cmd"
  "$@" < /dev/null > /dev/null 2>&1 &
  echo $! > '${state}'/pid
}
halt() {
  [ -e '${state}'/pid ] || return 0
  read p < '${state}'/pid
  : > '${state}'/pid
  [ -n "$p" ] || return 0
  kill "$p" 2> /dev/null
  n=0
  while kill -0 "$p" 2> /dev/null; do n=$((n + 1)); [ $n -eq 500000 ] && kill -9 "$p"; done
}
case "$*" in
  "--user show-environment") flag no-manager && { echo 'Failed to connect to bus: No medium found' >&2; exit 1; }
    flag stand-in && { echo '"systemd" is not running in this container due to its overhead.'; exit 0; }
    echo 'PATH=/usr/bin:/bin' ;;
  "--user is-enabled binnacle") flag enabled && { echo enabled; exit 0; }; echo disabled; exit 1 ;;
  "--user is-active binnacle") flag active && { echo active; exit 0; }; echo inactive; exit 3 ;;
  "--user enable binnacle") flag refuse && { echo 'Failed to enable unit: Access denied' >&2; exit 1; }; set_flag enabled yes ;;
  "--user start binnacle") flag refuse && { echo 'Job for binnacle.service failed' >&2; exit 1; }; flag active || run; set_flag active yes ;;
  "--user restart binnacle") halt; run; set_flag active yes ;;
  "--user stop binnacle") halt; set_flag active no ;;
  "--user disable --now binnacle") halt; set_flag enabled no; set_flag active no ;;
esac
exit 0
`;
