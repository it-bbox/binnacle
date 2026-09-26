# 01: The dashboard opens, served by the daemon

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** `binn dashboard` opens the dashboard in the browser, already authorised. Its main screen shows each registered project's roadmap position and attention, and the Projects page lists every project. The daemon serves the generated files at its own address, and nothing outside them. Decided in the spec, under *Serving the dashboard*, *Opening it: `binn dashboard`* and *The pages*, and in ADR-0031.

- [ ] `apps/dashboard` is the package `@binnacle/dashboard`: Nuxt 4 with `ssr: false`, generated to static files by one workspace script. Nuxt is a build-time dependency of this package only. The daemon, the CLI and the MCP server gain no dependency, and `pnpm test` needs no generated dashboard.
- [ ] The package's TypeScript passes Nuxt's typecheck.
- [ ] The daemon serves the generated directory after `/health` and `/ops/`. `/` is `index.html`, a file in the directory is served with its content type, and any other path is `200.html`. Only `GET` and `HEAD` are accepted; any other method is `request.method_not_allowed`.
- [ ] No path whose resolution leaves the directory is served: `..`, its percent-encoded forms, backslashes and absolute paths are all `request.not_found`.
- [ ] Every static response carries a `Content-Security-Policy` that limits loading and connecting to the page's own origin, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
- [ ] HTML is not cached.
- [ ] A foreign `Host` is refused, as on every route.
- [ ] Without a generated directory, every static path answers a short page naming the command that generates it.
- [ ] `/ops/` still requires the token.
- [ ] `DaemonOptions` takes the directory, so that tests point it at a temporary one.
- [ ] `binn dashboard` prints `http://<host>:<port>/#token=<token>` and opens it in the default browser. `--print` prints it without opening. With no daemon answering, the command gives `daemon.unreachable` and `binn daemon start`.
- [ ] The page moves the token from the fragment into local storage and drops the fragment from the address. With no token, or on `auth.missing` or `auth.invalid`, it shows one line: run `binn dashboard`.
- [ ] The Overview lists every registered project with its current epic, that epic's status, and its attention items with their codes.
- [ ] The Projects page lists every registered project with:
  - its path;
  - its roadmap position;
  - its registered checkout's branch, commit and dirty state;
  - the reason, when the project is unavailable.
- [ ] A visible page refreshes every 15 seconds, and a hidden one does not.
- [ ] Repository text is rendered as text, never as HTML.
- [ ] The UI is in English, with no UI kit and no chart library.
- [ ] `README.md` and `README.ru.md` describe `binn dashboard` and the command that generates the dashboard.
- [ ] Tests through the daemon seam cover each static-route case above, and the write guarantee also requests static files.
- [ ] `binn dashboard --print` is tested as a subprocess, with and without a daemon.
