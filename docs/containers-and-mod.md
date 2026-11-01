# Containers and the Claude Code mod

Two optional paths: run Binnacle inside the container your app already runs in, and put Binnacle's state beside the chat in Claude Code. Neither is needed for Binnacle itself.

## In a container

Binnacle goes where the harness runs, so each app container gets its own Binnacle: its own daemon, home, token and dashboard, for the one project in it. Without a container, `binn init` and the skills are all you need. The full steps, including the dev container feature and the port rules, are in [Binnacle in a container](operations/07-containers.md).

## The Claude Code mod

`binnacle-mod` is an optional Claude Code plugin from the same package: a status line with the session's Task, tokens, context and usage limits, a *Waiting for you* band, a pane opened by its own command, and toasts, all read from the daemon. It writes nothing, and shows nothing without the daemon.

`binn init` asks whether to install it — no by default, and only where Claude Code 2.1.308 or later is found. To install it later, and to turn it off or remove it:

```bash
claude plugin install binnacle-mod@binnacle --scope user
claude plugin disable binnacle-mod
claude plugin enable binnacle-mod
claude plugin uninstall binnacle-mod
```

What `binn init` asks and what it writes is in [the installation checklist](operations/05-installation-checklist.md#the-binnacle-mod-for-claude-code).
