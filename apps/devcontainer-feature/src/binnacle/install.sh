#!/bin/sh
# Binnacle's dev container feature: installs @it-bbox/binnacle from npm and writes the command that starts its daemon
# with the container. The one shell script the dev container features format requires (dev-container spec).
set -e

VERSION=${VERSION:-latest}
HOSTPORT=${HOSTPORT:-7717}
HOME_DIR=/var/lib/binnacle
START=/usr/local/share/binnacle-start.sh

case $HOSTPORT in
  '' | *[!0-9]*) echo "binnacle: hostPort must be a port number, not \"$HOSTPORT\"." >&2; exit 1 ;;
esac

if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 24 ]; then
  echo 'binnacle: Binnacle needs Node 24 or later. Add the Node feature to devcontainer.json:' >&2
  echo '  "ghcr.io/devcontainers/features/node:1": { "version": "24" }' >&2
  exit 1
fi

npm install -g "@it-bbox/binnacle@$VERSION"

# The volume mounted here starts out as this directory is in the image: the container's user's, and theirs alone.
mkdir -p "$HOME_DIR"
chown "${_REMOTE_USER:-root}" "$HOME_DIR"
chmod 700 "$HOME_DIR"

cat > "$START" <<EOF
#!/bin/sh
# Written by Binnacle's dev container feature: starts the daemon with the container.
export BINNACLE_ALLOWED_HOSTS=127.0.0.1:$HOSTPORT,localhost:$HOSTPORT
# A daemon that answers is already running, which is not an error.
binn daemon status >/dev/null 2>&1 && exit 0
# Anything else in the runtime file is stale: the container's processes died with its last run, and the pid the file
# names may now be another process's. ponytail: a daemon too slow to answer is replaced; none can be at a start.
rm -f "\$BINNACLE_HOME/runtime.json"
binn daemon start
EOF
chmod 755 "$START"
