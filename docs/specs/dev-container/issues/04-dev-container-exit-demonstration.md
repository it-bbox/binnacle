# 04: The exit demonstration of epic 23, and 0.7.0

Status: READY
Triage: ready-for-human
Blocked by: 01, 02, 03
Spec: `docs/specs/dev-container/spec.md`

**What to build:** epic 23's exit criterion, demonstrated by the owner, then the 0.7.0 release and the feature's 1.0.0 (spec, the exit criterion, *The exit demonstration*, *The release*).

- [ ] The CLI package's version is 0.7.0 and the feature's 1.0.0; 0.7.0 is published by `CONTRIBUTING.md`'s *Releasing*, and the feature to `ghcr.io/it-bbox`.
- [ ] In a clean dev container naming the published feature, with port 7717 published on `127.0.0.1`, the daemon starts with the container and `binn daemon status` gives 0.7.0.
- [ ] `binn init` registers the project inside the container, and the address `binn dashboard` prints opens the dashboard in the host's browser.
- [ ] A rebuild of the container keeps the registration and the token.
- [ ] A second container on host port 7718 runs beside the first, and both dashboards open.
- [ ] The OpenTelemetry endpoint of one container refuses a call from the other.
- [ ] A host install of 0.7.0 with nothing set binds `127.0.0.1` and behaves as 0.6.0 did.
- [ ] One daemon's resident memory and its home's size, one project per container, are measured and written into the guide and its twin, with the date and the setup.

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
