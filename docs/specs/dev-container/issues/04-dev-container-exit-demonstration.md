# 04: The exit demonstration of epic 23, and 0.7.0

Status: DONE
Triage: ready-for-human
Blocked by: 01, 02, 03
Spec: `docs/specs/dev-container/spec.md`

**What to build:** epic 23's exit criterion, demonstrated by the owner, then the 0.7.0 release and the feature's 1.0.0 (spec, the exit criterion, *The exit demonstration*, *The release*).

- [x] The CLI package's version is 0.7.0 and the feature's 1.0.0; 0.7.0 is published by `CONTRIBUTING.md`'s *Releasing*, and the feature to `ghcr.io/it-bbox`.
- [x] In a clean dev container naming the published feature, with port 7717 published on `127.0.0.1`, the daemon starts with the container and `binn daemon status` gives 0.7.0.
- [x] `binn init` registers the project inside the container, and the address `binn dashboard` prints opens the dashboard in the host's browser.
- [x] A rebuild of the container keeps the registration and the token.
- [x] A second container on host port 7718 runs beside the first, and both dashboards open.
- [x] The OpenTelemetry endpoint of one container refuses a call from the other.
- [x] A host install of 0.7.0 with nothing set binds `127.0.0.1` and behaves as 0.6.0 did.
- [x] One daemon's resident memory and its home's size, one project per container, are measured and written into the guide and its twin, with the date and the setup.

## Comments

### Run on 2026-10-30

From `feat/dev-container-exit-demonstration`, with the built package and a temporary `BINNACLE_HOME` under `.scratch/demo-04/`, removed afterwards.

- **0.7.0 and 1.0.0, steps 1 to 4 of *Releasing***: `apps/cli/package.json` is `0.7.0`, and `SECURITY.md` and its twin name `0.7.x`, which `security-policy.test.ts` asked for once the version moved (red first, then green); the feature's `devcontainer-feature.json` is `1.0.0`, its first published version. `pnpm typecheck` passes; `pnpm test` gives 980 of 981, the one failure, `locale.test.ts`'s `init --plan --json` under two locales, failing the same on `main` in this session's sandbox, where yesterday's runs of epic 23 passed it: left to the owner's run below. The build writes `@it-bbox/binnacle` 0.7.0 to `apps/cli/dist/`; `node --test apps/cli/test/tarball.live.ts` passes.
- Started from `apps/cli/dist/` with `BINNACLE_PORT=0` and nothing else set, `binn daemon status` gives `0.7.0`, bound `127.0.0.1`, accepting its own address alone; with `BINNACLE_HOST=0.0.0.0` and `BINNACLE_ALLOWED_HOSTS=127.0.0.1:7718,localhost:7718`, it binds `0.0.0.0` and accepts the three addresses. Both daemons were stopped.
- Not run here: Docker, the dev container CLI and the registries are the owner's, so every criterion below waits for the owner's run.

### For the owner

The branch is merged into `main` with `git merge --no-ff` while this ticket still says `Status: READY`, then *After a pull or a merge* in `CONTRIBUTING.md`; `DONE` comes after the criteria, on this branch, merged again. Docker and the dev container CLI (`npm install -g @devcontainers/cli`) are installed on the host.

- **First, the suite.** `pnpm test` in the main checkout passes in full, `locale.test.ts` included; if it fails there too, that test is fixed before anything is published.
- **Criterion 1, npm.** Push `main` with this branch merged and wait for CI's `check`, `tarball-live` and `autostart-live` to go green there; rebuild at that commit, then `npm whoami`, `npm publish --dry-run` and `npm publish --access public` from `apps/cli/dist/`, confirming the second factor in the browser, until `npm view @it-bbox/binnacle version` prints `0.7.0`.
- **Ticket 02's live test**, between npm and `ghcr.io`: `node --test apps/cli/test/devcontainer.live.ts` passes, which closes ticket 02's last two criteria.
- **Criterion 1, the feature.** `docker login ghcr.io -u <github-user>` with a token that has `write:packages`, authorised for the organisation's SSO if it has one; then `devcontainer features publish --registry ghcr.io --namespace it-bbox/binnacle apps/devcontainer-feature/src`; once, make the package `binnacle/binnacle` public in the organisation's packages on GitHub; `devcontainer features info manifest ghcr.io/it-bbox/binnacle/binnacle:1` prints `1.0.0`. Then `docker logout ghcr.io`, so that the token does not stay in `~/.docker/config.json`.
- **Criterion 2.** In an empty directory `demo-a`, a Git repository with one commit, the guide's `.devcontainer/devcontainer.json` from *With the dev container feature*, with `hostPort` `7717` and an image added, which the guide's fragment leaves to the reader: `"image": "mcr.microsoft.com/devcontainers/javascript-node:24"`, which has the user `node`, `sudo`, `curl` and `ps`. `devcontainer up --workspace-folder demo-a`, then `devcontainer exec --workspace-folder demo-a binn daemon status`: version `0.7.0`, bound `0.0.0.0`, accepting `127.0.0.1:7717` and `localhost:7717`. On the host, `ss -ltn | grep 7717` shows `127.0.0.1:7717`, not `0.0.0.0:7717`.
- **Criterion 3.** `devcontainer exec --workspace-folder demo-a binn init`, accepting the plan: the project is registered. `devcontainer exec --workspace-folder demo-a binn dashboard --print` prints `http://127.0.0.1:7717/#…`; opened in the host's browser, the dashboard shows the project `demo-a`. Plain `binn dashboard` prints the address without the token and says it could not open a browser. The part after `#` is the token: into this ticket goes only `http://127.0.0.1:7717/`.
- **Criterion 4.** Before the rebuild, `devcontainer exec --workspace-folder demo-a sh -c 'binn dashboard --print | sha256sum'`. Then `devcontainer up --workspace-folder demo-a --remove-existing-container`: `binn daemon status` answers again, `binn project list` still lists `demo-a`, the same command gives the same hash, the token unchanged, and the address opens the dashboard.
- **Criterion 5.** A second directory `demo-b`, the same file with `hostPort` `7718` and `appPort` `127.0.0.1:7718:7717`; `devcontainer up`, `binn init` and `binn dashboard --print` in it. Both addresses open, side by side, each dashboard with its own project.
- **Criterion 6.** A's address: `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' $(docker ps -q --filter label=devcontainer.local_folder=$(realpath demo-a))`. From B: `devcontainer exec --workspace-folder demo-b curl -s -w ' %{http_code}\n' -X POST -H 'Host: 127.0.0.1:7717' -H 'Content-Type: application/json' -d '{}' http://<A's address>:7717/v1/logs` prints `request.forbidden_peer` and `403`. The same call inside A, to `http://127.0.0.1:7717/v1/logs`, prints `{} 200`.
- **Criterion 7.** On a host with nothing set (a `node:24-slim` container with no port published will do): `npm i -g @it-bbox/binnacle@0.7.0`, `binn --version` prints `0.7.0`, `binn daemon start`, and `binn daemon status` gives bound `127.0.0.1` and accepts its own address alone; `binn dashboard --print` gives `http://127.0.0.1:<port>/#…` as 0.6.0 did. A `Host` it does not accept is refused as before: `node -e "require('http').get({host:'127.0.0.1',port:<port>,path:'/health',headers:{Host:'localhost:<port>'}},r=>{r.pipe(process.stdout);r.on('end',()=>console.log(' '+r.statusCode))})"` prints `request.forbidden_host` and `403`.
- **Criterion 8.** In `demo-a`, after `binn init` and one Claude Code session in the container (`npm i -g @anthropic-ai/claude-code`, then `claude`, signed in, one message): `devcontainer exec --workspace-folder demo-a sh -c 'grep VmRSS /proc/$(node -pe "JSON.parse(require(\"fs\").readFileSync(process.env.BINNACLE_HOME+\"/runtime.json\")).pid")/status; du -sh "$BINNACLE_HOME"'` gives the daemon's resident memory and the home's size. Write both into *What one container costs* in `docs/operations/07-containers.md` and its twin, with the date and the setup: the host's OS and Docker version, the image, one project, one session.

### Review

Run in a sub-agent, 2026-10-30, on the branch's first two commits.

#### Standards

None found: 0.7.0 moved where 0.6.0's did (`apps/cli/package.json`, `SECURITY.md` and its twin, the test's comment), the feature's 1.0.0 matches the guide's `:1`; subjects within 72 characters, one author, no trailers. The roadmap's "at 0.1.0" for the feature is left to the Product session that closes the epic.

#### Spec

- The guide's `devcontainer.json` is a fragment without an `image`, so `devcontainer up` would fail at criterion 2 and every criterion after it. **Fixed**: the script adds `mcr.microsoft.com/devcontainers/javascript-node:24`, which has `node`, `sudo`, `curl` and `ps`. Whether the guide itself names an image: kept for the owner's run, the guide reading as a fragment to add to.
- Criterion 6 said the call inside A "is not refused". **Fixed**: it prints `{} 200`; A's container found by its `devcontainer.local_folder` label.
- Criterion 8 measured with `ps`, which slim Debian images lack, and assumed a harness session. **Fixed**: `VmRSS` from `/proc`, checked on a runtime file here; Claude Code installed and signed in for the session.
- Criterion 7 checked the bind alone. **Fixed**: a `Host` it does not accept is refused with `request.forbidden_host`, as in 0.6.0.
- Criterion 4 compared the address from memory. **Fixed**: by the hash of `binn dashboard --print`.

#### Security

- `binn dashboard --print` prints the token in the fragment, and nothing said to keep it out of the ticket. **Fixed**: only the address before `#` goes into the ticket, and criterion 4 compares a hash.
- The `ghcr.io` token: **fixed**: authorised for the organisation's SSO where it has one, and `docker logout ghcr.io` after publishing.
- The port published on `127.0.0.1` only, checked with `ss -ltn`: none found.

### The owner's run

The branch merged into `main` with `git merge --no-ff` (`22141f6`) while this ticket said `Status: READY`; the daemon restarted on it, `binn daemon status` giving `0.7.0`, bound `127.0.0.1`, accepting its own address alone.

- `pnpm test` in the main checkout passes in full (981), `locale.test.ts` included: its failure here was this session's sandbox.
- **0.7.0 published** (the owner, 2026-10-30): `npm publish --dry-run` gave `@it-bbox/binnacle@0.7.0`, 83 files; after `npm login`, `npm publish --access public`, the second factor confirmed in the browser; `npm view @it-bbox/binnacle version` gave `0.7.0`.
- **Ticket 02's live test passes** (the owner, 2026-10-30): `node --test apps/cli/test/devcontainer.live.ts`, 2 of 2, closing ticket 02's last two criteria. Docker Desktop on Linux shares only the home directory with its VM, so the test's directories under `/tmp` could not be mounted; it passes with `TMPDIR` inside the home, `TMPDIR=~/.cache/binnacle-live`.
- **The feature 1.0.0 published** (the owner, 2026-10-30): `docker login` could not store the token, the Docker config naming `pass` with an empty store; `DEVCONTAINERS_OCI_AUTH="ghcr.io|<user>|$(gh auth token)"` with `devcontainer features publish …` published tags `1`, `1.0`, `1.0.0` and `latest`, after `gh auth refresh -s write:packages`, removed again after. The organisation allowed public packages first, then `binnacle/binnacle` was made public; `devcontainer features info manifest ghcr.io/it-bbox/binnacle/binnacle:1`, with no credentials, gives `1.0.0`. The collection's own package, `binnacle`, lists the feature for catalogues and is no container's.
- **Criterion 2** holds on 0.7.0 (the owner, 2026-10-30): the host's daemon stopped to free 7717; `~/binnacle-demo/demo-a`, the guide's file with `mcr.microsoft.com/devcontainers/javascript-node:24`; `devcontainer up` started the daemon from the feature's `postStartCommand`, version `0.7.0`, bound `0.0.0.0`; `ss -ltn` shows `127.0.0.1:7717` alone.
- Found in criterion 3: `binn init` in that container offered autostart, though the guide says it does not, and once accepted it stopped the running daemon and left none: `binn daemon status` gave not running, autostart on. The image's `systemctl` is a stand-in that, with systemd not running, prints a notice and exits 0, so `systemctl --user show-environment` looked like a user manager. **Fixed** (`4c22079`): the manager counts only when that output holds a `KEY=VALUE` line, as a real user manager's always does; pinned in `autostart.test.ts` with a stand-in in `fake-systemctl.ts`. The owner chose a fix and 0.7.1 before the rest of the demonstration.
- Found in criterion 2: `binn daemon status` listed `127.0.0.1:7717` twice, the host port being the daemon's own. **Fixed** in the same commit: each accepted address once; pinned in `dashboard.test.ts`.
- **0.7.1** (`0f5d98b`): the CLI at 0.7.1, the guide's pins with it; the feature unchanged at 1.0.0, its default `latest` taking 0.7.1.

A review in a sub-agent, 2026-10-30, of the two fixes:

- A container where 0.7.0 already wrote the unit still starts and reports through the stand-in, `binn daemon start` timing out. Kept in code: the unit is in the container's `~/.config`, not on a volume, so a rebuild removes it; only an upgrade in place keeps it. **Fixed** in the guide (`60fe6de`): such a container turns it off with `binn daemon autostart off`.
- The guide said every version before 0.7.1 binds loopback. **Fixed**: versions before 0.7.0 do; 0.7.0's `binn init` turns on the autostart.
- The test of the repeated address repeats an allowed value, not the daemon's own, whose port a test daemon picks. Kept: the same set folds both.
- The real user manager's environment always holds `PATH`: none found. Standards: none found.

Next, by the owner: push `main` with this branch merged again, publish 0.7.1 by the same steps, then criteria 2 and 3 again on a fresh `demo-a` (`devcontainer up --remove-existing-container`, the feature's `version` at `0.7.1`), and on to criterion 8.

### The owner's run on 0.7.1

0.7.1 published (the owner, 2026-10-30), after CI went green at `0281767`; `npm view @it-bbox/binnacle@0.7.1 version` gave `0.7.1` a few minutes later, the first `devcontainer up` having found it not yet available. The feature unchanged at 1.0.0. The criteria name 0.7.0, which was published and is replaced by 0.7.1 for the fix above; criteria 2 to 8 hold on 0.7.1.

- **Criterion 1** holds: 0.7.0 and 0.7.1 on npm, the feature 1.0.0 on `ghcr.io/it-bbox`, public.
- **Criterion 2** holds: `demo-a` cleaned (`git clean`, its container and both volumes removed) and brought up again with the feature's `version` at `0.7.1`: the daemon started with the container, `0.7.1`, bound `0.0.0.0`, accepting `127.0.0.1:7717, localhost:7717`, once each; the port on `127.0.0.1:7717` alone, as `ss -ltn` showed before.
- **Criterion 3** holds: `binn init` in the container registered `demo-a` and skipped autostart, "no systemd user manager answers" with the stand-in's notice; the plan had no autostart item, and the daemon kept running. `binn dashboard --print` gave `http://127.0.0.1:7717/`, which opened the dashboard with `demo-a` in the host's browser.
- **Criterion 4** holds: `devcontainer up --remove-existing-container` made a new container on the same volumes; `binn project list` still lists `demo-a`, and the hash of `binn dashboard --print` is the same before and after, `434bd18d…21b25ff`.
- **Criterion 5** holds: `demo-b` with `hostPort` `7718` and `127.0.0.1:7718:7717`, accepting `127.0.0.1:7717, 127.0.0.1:7718, localhost:7718`; after `binn init` there, `http://127.0.0.1:7718/` and `http://127.0.0.1:7717/` open side by side, each with its own project.
- **Criterion 6** holds: from `demo-b` (`172.17.0.3`) to `demo-a`'s `http://172.17.0.2:7717/v1/logs`, with an accepted `Host`: `request.forbidden_peer`, 403, naming `172.17.0.3`; the same call inside `demo-a` over loopback: `{} 200`.
- **Criterion 7** holds: in a `node:24-slim` container with nothing set, `npm i -g @it-bbox/binnacle@0.7.1`: `binn --version` `0.7.1`, bound `127.0.0.1`, accepting `127.0.0.1:7717` alone, autostart off, `binn dashboard --print` `http://127.0.0.1:7717/`, and a `Host` of `localhost:7717` refused with `request.forbidden_host`, 403, as in 0.6.0.
- **Criterion 8** holds: in `demo-a`, after `binn init` and with no harness session, the owner choosing not to sign a harness in for it: `VmRSS` 84,380 kB and the home 284 KiB, on Docker Desktop 4.89.0 (Engine 29.7.2), Ubuntu 24.04.5; written into the guide and its twin (`a757210`), saying the home grows with the sessions imported.

For the product inbox, found on the way and outside this epic:

- `binn init`'s skipped autostart prints the stand-in's notice whole, over four lines; its first line would do.
- `binn init` plans `code --add-mcp` where VS Code is not installed, as in a container, and the item fails; it reads better as a skip with its reason.
- The skills step reports "PromptScript does not support global skill installation" on every run, as found in epic 22.
