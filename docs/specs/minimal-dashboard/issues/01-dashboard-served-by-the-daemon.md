# 01: The dashboard opens, served by the daemon

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/minimal-dashboard/spec.md`

**What to build:** `binn dashboard` opens the dashboard in the browser, already authorised. Its main screen shows each registered project's roadmap position and attention, and the Projects page lists every project. The daemon serves the generated files at its own address, and nothing outside them. Decided in the spec, under *Serving the dashboard*, *Opening it: `binn dashboard`* and *The pages*, and in ADR-0031.

- [x] `apps/dashboard` is the package `@binnacle/dashboard`: Nuxt 4 with `ssr: false`, generated to static files by one workspace script. Nuxt is a build-time dependency of this package only. The daemon, the CLI and the MCP server gain no dependency, and `pnpm test` needs no generated dashboard.
- [x] The package's TypeScript passes Nuxt's typecheck.
- [x] The daemon serves the generated directory after `/health` and `/ops/`. `/` is `index.html`, a file in the directory is served with its content type, and any other path is `200.html`. Only `GET` and `HEAD` are accepted; any other method is `request.method_not_allowed`.
- [x] No path whose resolution leaves the directory is served: `..`, its percent-encoded forms, backslashes and absolute paths are all `request.not_found`.
- [x] Every static response carries a `Content-Security-Policy` that limits loading and connecting to the page's own origin, `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
- [x] HTML is not cached.
- [x] A foreign `Host` is refused, as on every route.
- [x] Without a generated directory, every static path answers a short page naming the command that generates it.
- [x] `/ops/` still requires the token.
- [x] `DaemonOptions` takes the directory, so that tests point it at a temporary one.
- [x] `binn dashboard` prints `http://<host>:<port>/#token=<token>` and opens it in the default browser. `--print` prints it without opening. With no daemon answering, the command gives `daemon.unreachable` and `binn daemon start`.
- [x] The page moves the token from the fragment into local storage and drops the fragment from the address. With no token, or on `auth.missing` or `auth.invalid`, it shows one line: run `binn dashboard`.
- [x] The Overview lists every registered project with its current epic, that epic's status, and its attention items with their codes.
- [x] The Projects page lists every registered project with:
  - its path;
  - its roadmap position;
  - its registered checkout's branch, commit and dirty state;
  - the reason, when the project is unavailable.
- [x] A visible page refreshes every 15 seconds, and a hidden one does not.
- [x] Repository text is rendered as text, never as HTML.
- [x] The UI is in English, with no UI kit and no chart library.
- [x] `README.md` and `README.ru.md` describe `binn dashboard` and the command that generates the dashboard.
- [x] Tests through the daemon seam cover each static-route case above, and the write guarantee also requests static files.
- [x] `binn dashboard --print` is tested as a subprocess, with and without a daemon.

## Comments

- **What exists.**
  - `apps/dashboard` is `@binnacle/dashboard`: `nuxt.config.ts` (`ssr: false`, telemetry and devtools off), `app/app.vue` (the navigation and the one sign-in line), `app/plugins/token.client.ts` (the fragment to local storage), `app/composables/daemon.ts` (`call`, `usePolling`, `useAuthorised`), `app/composables/projects.ts` (what the two pages load and format), `app/pages/index.vue` (Overview) and `app/pages/projects.vue` (Projects). Its devDependencies are `nuxt`, `vue-tsc` and `typescript`; nothing else in the workspace depends on it.
  - `pnpm dashboard:generate` at the root runs `nuxt generate`, which writes `apps/dashboard/.output/public`. Nuxt's typecheck is `pnpm --filter @binnacle/dashboard typecheck`.
  - The static route is `serveStatic` in `apps/daemon/src/server.ts`. The daemon finds the directory from its own source location (`DASHBOARD_DIRECTORY`), so a linked `binn` serves the main checkout's generated dashboard. `DaemonOptions.dashboard` overrides it, and `startTestDaemon` defaults it to a missing directory inside the test home, so no test depends on a generated dashboard.
  - `binn dashboard [--print]` is `apps/cli/src/dashboard.ts`. It opens the address with `xdg-open`, `open` or `cmd /c start`, detached.
- **Decided while building, within the spec.**
  - **The not-generated page answers `503`.** The spec asks for a page and leaves the status open. A refused path is still `request.not_found` when nothing is generated.
  - **The CSP allows the served HTML's own inline scripts by hash.** Nuxt's generated `index.html` carries an inline import map and its runtime configuration, which `script-src 'self'` alone would block. The daemon hashes every inline `<script>` of the HTML it serves, so the policy still loads and connects to the page's own origin only. It also sets `object-src`, `base-uri`, `form-action` and `frame-ancestors` to `'none'`.
  - **The content types are the four `nuxt generate` writes**: HTML, JavaScript, CSS and JSON. Anything else is `application/octet-stream`. Add a type here when the dashboard gains a file of another kind, such as a favicon.
  - **"No daemon answering"** is no runtime file, or a runtime file whose daemon does not answer `/health`. Both give `binn: daemon.unreachable: …` with `binn daemon start`, exit 4.
  - **The fragment is dropped once the app is mounted.** Nuxt's router makes its initial navigation to the URL it started on, fragment included, so replacing the history entry any earlier puts the fragment back.
  - **A page that becomes visible again refreshes at once**, rather than up to 15 seconds later.
- **For the next tickets.**
  - The **current epic** on both pages is worked out in the page (`position` in `app/composables/projects.ts`): the first roadmap row that is not `done`, the rule the Suggested step uses. The snapshot has no field for it yet. Ticket 05's `next` should replace it, so that the page computes nothing beyond formatting.
  - New pages go under `app/pages/`, load through `usePolling(() => call(...))`, and get a link in `app/app.vue`'s navigation. Render repository text with `{{ }}` only, never `v-html`.
  - `pnpm install` warns that it ignored `esbuild`'s build script. Generation works without it, because esbuild's platform binary arrives as an optional dependency.
- **Checked by hand on 2026-09-26**, with a daemon on a temporary `BINNACLE_HOME` and an ephemeral port, this worktree registered, and the dashboard generated. In the built-in browser:
  - The address `binn dashboard --print` gave opened the Overview: `Binnacle`, `Epic 5, Minimal dashboard: tickets`, `Nothing needs attention.` The address bar kept no fragment, and local storage held the token.
  - `/projects#token=…` opened the Projects page with the path, the position and `feat/dashboard-served-by-the-daemon at ff2c3af5a29c, dirty`.
  - With no token, and with a wrong one (two `401`s), the page showed only `Run binn dashboard to open the dashboard.`
  - The console showed no CSP violation.
  - With the pane hidden, no call was made in 17 seconds. With the page visible, `project.list` and `project.snapshot` were called again within 16 seconds.
- **To see it yourself** (the exit demonstration, ticket 09, does the same on your own daemon):
  1. In the main checkout, once this branch is merged: run `pnpm install`, then `pnpm dashboard:generate`.
  2. Run `binn daemon stop`, then `binn daemon start`, so that the daemon runs the new code.
  3. Run `binn dashboard`. The browser opens the Overview, and the address bar shows `http://127.0.0.1:7717/` with no `#token=`.
  4. Open Projects. Every registered project is listed with its path, its position and its checkout.
  5. Bookmark the plain address and reopen it. It still works. In a private window it shows only `Run binn dashboard to open the dashboard.`

### Review

`/code-review` ran against `main` on both axes, with its sub-agents in the foreground.

**Standards: no hard violations.** The reviewer found no path-traversal or token-handling bug. It checked the CSP against the real generated `index.html`. Judgement calls:

1. **Speculative content types** (`.mjs`, `.txt`, `.svg`, `.png`, `.ico`, `.woff2`) that `nuxt generate` does not write. **Fixed**: the map holds the four it does write.
2. **Synchronous file reads on every static request.** **Fixed**: a `ponytail:` comment names the ceiling and the upgrade, streaming.
3. **The token is in the opener's argv** while `xdg-open` runs, and the browser keeps the URL in its history. **Kept**: ADR-0031 chose the fragment for this, and `binn dashboard --print` prints the same address to the terminal. Neither puts the token in a request line or a log.
4. **Duplicated error and empty states** on the two pages. **Left**: two pages; extract a component when later tickets add the other four and the repetition is real.
5. **Three wordings of `daemon.unreachable`** (`dashboard.ts`, `mcp.ts`, and `project-commands.ts`, which predates the code). **Left**: each is one line, and the new one carries the code the spec asks for.
6. **`startTestDaemon`'s option type repeats part of `DaemonOptions`.** **Left**: the existing pattern, with one field added.
7. **`DASHBOARD_DIRECTORY` depends on the workspace layout.** **Kept**: ADR-0031 leaves shipping a built dashboard to npm publishing, under *Later*.

**Spec: every criterion holds.** Findings:

1. **Nuxt's typecheck.** The reviewer did not run it, because it writes `.nuxt/`. **Checked**: `pnpm --filter @binnacle/dashboard typecheck` passes, and it fails on a deliberate type error.
2. **The page works out the current epic.** **Kept**, and recorded above for ticket 05.
3. **Small additions**: the refresh on becoming visible, the empty-state line naming `binn project register`, the test that an unknown option exits 2, and the `.gitignore` entry for the `dist` link `nuxt generate` makes. **Kept**: each is a line or two and follows the spec.
4. **The fragment's token is not URL-decoded.** **Left**: the daemon's token is hex.
