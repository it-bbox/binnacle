---
name: register
description: Register a repository with the running Binnacle daemon from the chat, the main checkout of this session's repository by default, by running `binn project register`. Needs no daemon to be started; registering needs a running daemon, and it names /binnacle:daemon start when none is running.
argument-hint: "[path]"
disable-model-invocation: true
---

This skill needs no daemon to be started and no `binnacle` MCP server: it runs the CLI command `binn project register` in this harness's shell. Registering itself is done by the daemon, so it fails while the daemon is stopped, and says so.

1. Choose the path:
   - If the human passed one (`$ARGUMENTS`), use it.
   - Otherwise use the main checkout: the first path `git worktree list` prints, run in the current directory. If that path differs from this session's checkout (`git rev-parse --show-toplevel`), this session runs in a linked worktree: say that the main checkout at that path is registered instead, because every Binnacle step uses the registered checkout.
   - If the current directory is not in a Git repository and no path was passed, stop and say so; register nothing.
2. Run `binn project register <path>` once, with the path quoted for the shell.
   - If the shell cannot find `binn` (`command not found`, exit 127), stop. Say that `binn` is not on this harness's PATH, and point to the README's setup section (*Install*, and *From this repository* until the npm package is published).
   - Exit 4 means the daemon is not running. Stop, quote what it printed, and name `/binnacle:daemon start`, or `binn daemon start` at a terminal, then `/binnacle:register` again.
   - Any other non-zero exit means the registration failed, for example a path with no `.binnacle/project.yaml`. Stop, give the exit code and quote what it printed on stderr. A missing or invalid manifest is fixed by `binn init` on that repository, which is the human's to run.
3. Show what it printed: the project's id, path, name and registration time, and any warning it printed on stderr after it registered.

Run no other command than the ones above, and change nothing in the repository.
