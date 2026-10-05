---
name: daemon
description: Start, stop or check the Binnacle daemon from the chat by running `binn daemon start`, `stop` or `status` (the default), and show what it printed. Needs no daemon.
argument-hint: "[start|stop|status]"
disable-model-invocation: true
---

This skill needs no daemon and no `binnacle` MCP server: it runs the CLI command `binn daemon <action>` in this harness's shell, so it works while the daemon is stopped.

1. The action is `$ARGUMENTS`: `start`, `stop` or `status`, and `status` when no action was passed. For anything else, stop and say these are the three actions; run nothing.
2. Run `binn daemon <action>` once.
   - If the shell cannot find `binn` (`command not found`, exit 127), stop. Say that `binn` is not on this harness's PATH, and point to the README's setup section (*Install*, and *From this repository* until the npm package is published).
   - `status` exits 4 when no daemon is running. That is its answer, not a failure: show what it printed.
   - Any other non-zero exit means the action failed. Stop, give the exit code and quote what it printed on stderr. A failed `start` prints its reason and then the log tail of the daemon: quote both as printed, and add no diagnosis of your own.
3. Show what it printed, as printed: whether a daemon is running, and its address, pid, start time and version. `start` on a running daemon says it is already running; that is a success.
4. After a `start` that succeeded, say that the Binnacle skills that need the daemon, such as `/binnacle:product`, can be run again, and that a project not registered yet is registered by `/binnacle:register`. After a `stop`, say that they will report `daemon.unreachable` until `/binnacle:daemon start`.

Run no other command, and never stop or start the daemon on your own initiative: only the action the human passed, once.
