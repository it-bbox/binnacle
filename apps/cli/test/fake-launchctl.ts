/**
 * A fake `launchctl` that records its arguments and answers as the real one does, keeping
 * whether the service is loaded, and whether its daemon has exited, in files. Shell builtins
 * only, so that its PATH holds nothing else: the real `launchctl` is never reachable from
 * these tests. With the `runs` flag set,
 * bootstrapping the property list runs its ProgramArguments with its EnvironmentVariables,
 * and booting it out signals that process and waits, as launchd would.
 */
export const fakeLaunchctl = (log: string, state: string, plist: string): string => `#!/bin/sh
printf '%s\\n' "$*" >> '${log}'
flag() { [ -e '${state}'/"$1" ] && { read v < '${state}'/"$1"; [ "$v" = yes ]; }; }
set_flag() { printf '%s\\n' "$2" > '${state}'/"$1"; }
run() {
  flag runs || return 0
  set --
  section=
  while IFS= read -r line; do
    line=\${line#"\${line%%[![:space:]]*}"}
    case "$line" in
      '<key>ProgramArguments</key>') section=args ;;
      '<key>EnvironmentVariables</key>') section=env ;;
      '</array>'|'</dict>') section= ;;
      '<key>'*) key=\${line#<key>}; key=\${key%</key>} ;;
      '<string>'*)
        value=\${line#<string>}; value=\${value%</string>}
        case $section in args) set -- "$@" "$value" ;; env) export "$key=$value" ;; esac ;;
    esac
  done < '${plist}'
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
case "$1" in
  print)
    case "$2" in
      */binnacle)
        flag loaded || { echo 'Could not find service "binnacle" in domain for user gui' >&2; exit 113; }
        printf '%s = {\\n\\tstate = %s\\n}\\n' "$2" "$(flag exited && echo 'not running' || echo running)" ;;
      *) flag no-gui && { echo 'Could not find domain for user gui' >&2; exit 113; }; echo "$2 = {" ;;
    esac ;;
  bootstrap)
    { flag refuse || flag loaded; } && { echo 'Bootstrap failed: 5: Input/output error' >&2; exit 5; }
    run; set_flag loaded yes ;;
  bootout) flag loaded || { echo 'Boot-out failed: 3: No such process' >&2; exit 3; }; halt; set_flag loaded no ;;
esac
exit 0
`;
