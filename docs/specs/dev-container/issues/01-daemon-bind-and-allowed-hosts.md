# 01: The daemon binds and accepts the addresses the user sets

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/dev-container/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** a daemon started with `BINNACLE_HOST=0.0.0.0` and `BINNACLE_ALLOWED_HOSTS=127.0.0.1:7718` inside a container answers a request whose `Host` is `127.0.0.1:7718` and which carries the token, from the host through a published port; and with nothing set, a daemon behaves exactly as in 0.6.0. This ticket covers the spec's *Two variables*, *The runtime file*, *The `Host` check*, *The `Origin` check*, *The OpenTelemetry endpoint*, `binn dashboard`, `binn daemon status`, `binn --help` and *Docs* (ADR-0048).

`BINNACLE_HOST` is `127.0.0.1`, the default, or `0.0.0.0`; `BINNACLE_ALLOWED_HOSTS` is comma-separated `host:port` values, trimmed and lower-cased. Both are resolved like `BINNACLE_PORT` and passed to `startDaemon` as options. The runtime file's `host` stays where a client on this machine connects, `127.0.0.1` when the daemon binds `0.0.0.0`, and the file gains `bind` and `allowedHosts`. The `Host` check accepts the daemon's own address and each allowed value; the `Origin` check accepts an absent `Origin` or `http://` and an accepted value. The OpenTelemetry endpoint takes a call only from a loopback peer, and refuses any other with `request.forbidden_peer`, 403. The token and the routes that need it are unchanged.

- [ ] Through `startDaemon` and raw requests in `apps/daemon/test/daemon.test.ts`:
  - with nothing set, the bind is `127.0.0.1`, and `localhost:<port>` is still refused;
  - an allowed value with the token succeeds, and the same value without the token gets `auth.missing`;
  - a `Host` neither own nor allowed gets `request.forbidden_host`, with the accepted addresses in its params;
  - an `Origin` of `http://` and an allowed value passes, any other gets `request.forbidden_origin`;
  - bound to `0.0.0.0`, the runtime file has `host` `127.0.0.1`, `bind` `0.0.0.0` and `allowedHosts`, and a request over loopback succeeds.
- [ ] A `BINNACLE_HOST` other than the two values, and an allowed value without a port, are refused when the daemon starts, each with a message naming what it takes.
- [ ] In `apps/daemon/test/opentelemetry.test.ts`: a call from loopback is accepted as today; with the daemon bound to `0.0.0.0`, a call over the machine's own non-loopback address gets `request.forbidden_peer`, the case skipped when the machine has no such address.
- [ ] `request.forbidden_peer` is worded in both languages in `@binnacle/core`, and the codes test covers it.
- [ ] `binn dashboard --print` gives the first allowed value with the token in the fragment when the runtime file has one, and the runtime file's address otherwise, in `apps/cli/test/dashboard.test.ts`; when the opener fails, the printed address stands and the failure is said.
- [ ] `binn daemon status` shows the bound address and the accepted addresses, in both languages.
- [ ] The telemetry export's address is the runtime file's `host`, never `0.0.0.0`.
- [ ] `binn --help` lists `BINNACLE_HOST` and `BINNACLE_ALLOWED_HOSTS` beside `BINNACLE_PORT`, in both languages.
- [ ] `docs/01-architecture.md`, *Security boundary*, says the default bind stays loopback and what the user may set, citing ADR-0048; ADR-0031 says the dashboard's address is the first allowed `Host` when one is set.
