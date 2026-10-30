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
- **Criterion 1, the feature.** `docker login ghcr.io -u <github-user>` with a token that has `write:packages`, then `devcontainer features publish --registry ghcr.io --namespace it-bbox/binnacle apps/devcontainer-feature/src`; once, make the package `binnacle/binnacle` public in the organisation's packages on GitHub; `devcontainer features info manifest ghcr.io/it-bbox/binnacle/binnacle:1` prints `1.0.0`.
- **Criterion 2.** In an empty directory `demo-a`, a Git repository with one commit, the guide's `.devcontainer/devcontainer.json` from *With the dev container feature*, as written, with `hostPort` `7717`. `devcontainer up --workspace-folder demo-a`, then `devcontainer exec --workspace-folder demo-a binn daemon status`: version `0.7.0`, bound `0.0.0.0`, accepting `127.0.0.1:7717` and `localhost:7717`. On the host, `ss -ltn | grep 7717` shows `127.0.0.1:7717`, not `0.0.0.0:7717`.
- **Criterion 3.** `devcontainer exec --workspace-folder demo-a binn init`, accepting the plan: the project is registered. `devcontainer exec --workspace-folder demo-a binn dashboard --print` prints `http://127.0.0.1:7717/#…`; opened in the host's browser, the dashboard shows the project `demo-a`. Plain `binn dashboard` prints the address without the token and says it could not open a browser.
- **Criterion 4.** `devcontainer up --workspace-folder demo-a --remove-existing-container`: `binn daemon status` answers again, `binn project list` still lists `demo-a`, and the dashboard's address printed before still opens it, the token unchanged.
- **Criterion 5.** A second directory `demo-b`, the same file with `hostPort` `7718` and `appPort` `127.0.0.1:7718:7717`; `devcontainer up`, `binn init` and `binn dashboard --print` in it. Both addresses open, side by side, each dashboard with its own project.
- **Criterion 6.** `docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <demo-a's container>` gives A's address. From B: `devcontainer exec --workspace-folder demo-b curl -s -w ' %{http_code}\n' -X POST -H 'Host: 127.0.0.1:7717' -H 'Content-Type: application/json' -d '{}' http://<A's address>:7717/v1/logs` prints `request.forbidden_peer` and `403`. The same call inside A, to `http://127.0.0.1:7717/v1/logs`, is not refused.
- **Criterion 7.** On a host with nothing set (a `node:24-slim` container with no port published will do): `npm i -g @it-bbox/binnacle@0.7.0`, `binn --version` prints `0.7.0`, `binn daemon start`, and `binn daemon status` gives bound `127.0.0.1` and accepts its own address alone; `binn dashboard --print` gives `http://127.0.0.1:7717/#…` as 0.6.0 did.
- **Criterion 8.** In `demo-a`, after `binn init` and one harness session in the container: `devcontainer exec --workspace-folder demo-a sh -c 'ps -o rss= -p $(cat "$BINNACLE_HOME/runtime.json" | node -pe "JSON.parse(require(\"fs\").readFileSync(0)).pid") ; du -sh "$BINNACLE_HOME"'` gives the daemon's resident memory in KiB and the home's size. Write both into *What one container costs* in `docs/operations/07-containers.md` and its twin, with the date and the setup: the host's OS and Docker version, the image, one project, one session.
