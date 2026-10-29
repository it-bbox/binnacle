# Binnacle in a Container

_Русская версия: [07-containers.ru.md](07-containers.ru.md)._

How to put Binnacle into each app container, beside the harness, and open its dashboard from the host's browser without opening it to your network. It needs Binnacle 0.7.0 or later: earlier versions bind the container's own loopback, which a published port does not reach.

## Why inside each app container

Binnacle goes where the harness runs. Its daemon reads the harness's session files and the checkout from disk, and the harness starts `binn mcp` as a local process. A Binnacle in a container of its own would see neither: no session, no checkout, no `binn` to start.

So each app container gets its own Binnacle: its own daemon, home, token and dashboard, for the one project in it. Twenty containers are twenty daemons, each on a host port of its own. What one costs is under [What one container costs](#what-one-container-costs).

## With the dev container feature

Binnacle's feature installs `@it-bbox/binnacle` from npm, keeps Binnacle's home on a volume of this container's own, binds the daemon to every interface inside the container, accepts the host-side address, and starts the daemon with the container. A `devcontainer.json` adds it after Node 24, publishes the port and keeps the harness's home on a volume:

```jsonc
{
  "features": {
    "ghcr.io/devcontainers/features/node:1": { "version": "24" },
    "ghcr.io/it-bbox/binnacle/binnacle:1": { "version": "0.7.0", "hostPort": "7717" }
  },
  "appPort": ["127.0.0.1:7717:7717"],
  "containerEnv": { "CLAUDE_CONFIG_DIR": "/home/node/.claude" },
  "mounts": ["source=claude-${devcontainerId},target=/home/node/.claude,type=volume"],
  "postCreateCommand": "sudo chown node /home/node/.claude"
}
```

| Option | Default | Meaning |
| --- | --- | --- |
| `version` | `latest` | The npm version of `@it-bbox/binnacle` to install. Pin it, so that a rebuild does not upgrade Binnacle behind your back. |
| `hostPort` | `7717` | The host port the container's 7717 is published or forwarded on. The daemon accepts `127.0.0.1` and `localhost` at it. |

- **The port.** `appPort` publishes the container's 7717 on the host's loopback, `127.0.0.1:<hostPort>:7717`; never write it as a bare `<hostPort>:7717` ([why](#publish-on-127001-only)). An editor that forwards ports can forward it instead, `"forwardPorts": [7717]`: it takes 7717 on the host when that port is free and another otherwise, and `hostPort` must name the port it shows.
- **The harness's home.** Claude Code keeps its settings, its session files and Binnacle's plugin in `~/.claude`, and its MCP servers, the one `binn init` registers included, in `~/.claude.json`. A volume holds a directory, not a file, so `CLAUDE_CONFIG_DIR` puts both in one directory, here `/home/node/.claude`, and the volume keeps them through a rebuild. Binnacle reads them there without being told. Docker creates a new volume's mount point as root when the image has no such directory, so `postCreateCommand` gives it to the container's user; `/home/node` and `node` are the Node images' user, so write your own.
- The feature writes nothing into your repository, publishes no port and mounts no harness home: the three are your `devcontainer.json`'s.

## By hand

For an image built without features, or a `docker compose` service. The image installs Binnacle and sets what every container of it shares:

```dockerfile
FROM node:24-bookworm-slim
RUN npm install -g @it-bbox/binnacle@0.7.0 \
 && mkdir -p /var/lib/binnacle /home/node/.claude \
 && chown node:node /var/lib/binnacle /home/node/.claude
ENV BINNACLE_HOME=/var/lib/binnacle/home \
    BINNACLE_HOST=0.0.0.0 \
    CLAUDE_CONFIG_DIR=/home/node/.claude
USER node
```

- `BINNACLE_HOST=0.0.0.0` binds every interface inside the container, so that a published port reaches the daemon. Clients inside still reach it over the container's loopback.
- `BINNACLE_HOME` is a directory on the volume mounted at `/var/lib/binnacle`, which keeps the registration, the token and the history through a rebuild. The two directories are made in the image, the user's own, so that a new volume starts out as theirs.

Each container then gives four things: the port, published on the host's loopback; `BINNACLE_ALLOWED_HOSTS`, naming that host port; the two volumes; and the start command, run each time the container starts:

```yaml
services:
  app:
    build: .
    ports:
      - "127.0.0.1:7717:7717"
    environment:
      BINNACLE_ALLOWED_HOSTS: 127.0.0.1:7717,localhost:7717
    volumes:
      - .:/workspace
      - binnacle:/var/lib/binnacle
      - claude:/home/node/.claude
    command: sh -c 'binn daemon status >/dev/null 2>&1 || { rm -f "$$BINNACLE_HOME/runtime.json"; binn daemon start; }; exec sleep infinity'

volumes:
  binnacle:
  claude:
```

The start command removes the runtime file a stopped container left, since the process it names died with the container, then starts the daemon; a daemon already answering is left running. Replace `exec sleep infinity` with your app's own command. A dev container built from this image runs the same line as its `postStartCommand`, with `$` for `$$`, and gives the port, the variable and the volumes in `appPort`, `containerEnv` and `mounts`. A container whose daemon does not start is developed as before, without Binnacle.

## Publish on 127.0.0.1 only

Publish the port as `127.0.0.1:<port>:7717`, never as a bare `<port>:7717`. A bare port listens on every interface of the host, and Docker writes its own firewall rules for it, ahead of `ufw`'s: a `ufw` that denies the port does not stop your local network from reaching the dashboard. On the host's loopback, only your own machine reaches it.

The token still guards every operation, but `/health` and the dashboard's files need none, and nothing on your network should be calling them.

## A port for each container

Every daemon listens on 7717 inside its own container. On the host, each container needs its own port: 7717 for the first, 7718 for the second, and so on.

| Container | `appPort` or `ports` | `hostPort`, or `BINNACLE_ALLOWED_HOSTS` |
| --- | --- | --- |
| first | `127.0.0.1:7717:7717` | `7717`, or `127.0.0.1:7717,localhost:7717` |
| second | `127.0.0.1:7718:7717` | `7718`, or `127.0.0.1:7718,localhost:7718` |

The allowed `Host` must name the host-side port. The browser sends `Host: 127.0.0.1:7718`, and the daemon, listening on 7717, refuses any `Host` it is not told to accept: with a port published under one number and allowed under another, the dashboard answers with a refusal. `binn daemon status` lists the addresses the daemon accepts.

## Set up the project and open the dashboard

Run `binn init` once per project, inside the container, in the checkout: it registers the project with the container's Binnacle and Binnacle's MCP server with the harness, both on their volumes, so a rebuild keeps them. Run on the host, it would register the project with the host's Binnacle, which sees none of the container's sessions. Answer no to its autostart: a container has no service manager, and the feature or the start command starts the daemon.

Then, inside the container:

```bash
binn dashboard --print
```

It prints the address the host opens, `http://127.0.0.1:<hostPort>/` with the token in its fragment, which never reaches a server. Open it in the host's browser. Plain `binn dashboard` prints the same address without the token, and says it could not open a browser, since the container has none. After the first time, the plain address works as a bookmark in that browser.

The rest is as on a host: [Installation checklist](05-installation-checklist.md#5-set-up-a-project), and [Security and resilience](04-security-resilience.md#the-local-network) for what the daemon accepts.

## What one container costs

One daemon's resident memory and its home's size, with one project per container, are measured in epic 23's exit demonstration and written here, with the date and the setup.

| Measure | Value |
| --- | --- |
| The daemon's resident memory | not measured yet |
| The Binnacle home's size | not measured yet |
| Measured on | not measured yet |
