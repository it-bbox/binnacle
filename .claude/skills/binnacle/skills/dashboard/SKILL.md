---
name: dashboard
description: Open the Binnacle dashboard in the browser, already authorised, from the chat by running `binn dashboard`, and show its address without the token. Needs no daemon to be started; the dashboard needs a running daemon, and it names /binnacle:daemon start when none is running.
disable-model-invocation: true
---

This skill needs no daemon to be started and no `binnacle` MCP server: it runs the CLI command `binn dashboard` in this harness's shell. The daemon serves the dashboard, so it fails while the daemon is stopped, and says so.

The dashboard's token authorises the daemon's local API, and this shell's output reaches the model's provider and the session's transcript (ADR-0031). `binn dashboard` hands the token to the browser alone and prints the address without its token. Never run `binn dashboard --print`, which prints the token, and never show, read or ask for the token in any other way.

1. Run `binn dashboard` once, with no option.
   - If the shell cannot find `binn` (`command not found`, exit 127), stop. Say that `binn` is not on this harness's PATH, and point to the README's setup section (*Install*, and *From this repository* until the npm package is published).
   - Exit 4 means the daemon is not running. Stop, quote what it printed, and name `/binnacle:daemon start`, or `binn daemon start` at a terminal, then `/binnacle:dashboard` again.
   - Any other non-zero exit means the dashboard could not be opened. Stop, give the exit code and quote what it printed on stderr.
2. Show what it printed on stdout: the address without its token.
3. If it printed on stderr that it could not open a browser, no browser opened: quote that line, and say that the human runs `binn dashboard --print` at a terminal, which gives the address with its token, to open it by hand. Otherwise say that the opener was started on the default browser with the dashboard already authorised, and that if no browser appeared, `binn dashboard --print` at a terminal gives the address with its token.

Run no other command, and change nothing.
