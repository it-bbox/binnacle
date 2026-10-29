# ADR-0031: The Daemon Serves the Dashboard, and the Page Takes the Token From Its URL

**Status:** Accepted. Amended by ADR-0048: when the daemon accepts `Host` values beyond its own address, `binn dashboard`'s address is the first of them, with the token in the fragment as before.

## Context

Epic 5 builds the dashboard, in Nuxt (ADR-0008). The daemon's API is loopback HTTP: `POST /ops/<operation>` with a Bearer token read from a `0600` file under `~/.binnacle/`, and every request's `Host` and `Origin` must name the address the daemon bound (`docs/01-architecture.md`, *Security boundary*). A page in a browser cannot read that file, and a page served from any other address fails the `Origin` check.

## Decision

- The dashboard is a Nuxt single-page application, generated to static files. **The daemon serves them** at its own address, `http://127.0.0.1:7717/` by default, beside `/health` and `/ops/`. The files hold no project data, so serving them needs no token. The `Host` check covers them like every other route.
- `binn dashboard` opens `http://127.0.0.1:7717/#token=<token>`. The page moves the token from the fragment to the browser's storage, drops the fragment from the address, and sends the token as the Bearer header on every call. A fragment never reaches the server, so the token appears in no request line and no log.
- The daemon's authentication is unchanged: one token, one header, the same checks.

## Considered Options

- **Nuxt's own server** holding the token and proxying the API. Rejected: a second process to start and supervise beside `binnd`, against ADR-0008's one runtime and the absence of microservices in v1.
- **A cookie session** after a one-time login URL. Rejected: it adds a second credential path to the daemon, and the cross-site handling that comes with cookies, for a page that the fragment already serves.
- **The token written into the served page.** Rejected: any local process that can reach loopback would read it without the `0600` file, which is the boundary the file exists for.

## Consequences

- The dashboard runs whenever the daemon does, and nowhere else. With the daemon stopped there is no dashboard, and the project stays developable as before (`docs/01-architecture.md`, *Failure model*).
- After the first `binn dashboard`, the plain address works as a bookmark in that browser until the token file changes.
- A script running in the page can use the token, so the page never renders repository text — tickets, reviews, the roadmap — as HTML. It shows that text as text.
- The generated files must exist before the daemon can serve them. Until they do, the daemon answers `/` with a page naming the command that builds them. Publishing `@binnacle/cli` to npm, under *Later* on the roadmap, has to ship them built.
