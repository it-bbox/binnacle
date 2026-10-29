# 01: The daemon binds and accepts the addresses the user sets

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/dev-container/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** a daemon started with `BINNACLE_HOST=0.0.0.0` and `BINNACLE_ALLOWED_HOSTS=127.0.0.1:7718` inside a container answers a request whose `Host` is `127.0.0.1:7718` and which carries the token, from the host through a published port; and with nothing set, a daemon behaves exactly as in 0.6.0. This ticket covers the spec's *Two variables*, *The runtime file*, *The `Host` check*, *The `Origin` check*, *The OpenTelemetry endpoint*, `binn dashboard`, `binn daemon status`, `binn --help` and *Docs* (ADR-0048).

`BINNACLE_HOST` is `127.0.0.1`, the default, or `0.0.0.0`; `BINNACLE_ALLOWED_HOSTS` is comma-separated `host:port` values, trimmed and lower-cased. Both are resolved like `BINNACLE_PORT` and passed to `startDaemon` as options. The runtime file's `host` stays where a client on this machine connects, `127.0.0.1` when the daemon binds `0.0.0.0`, and the file gains `bind` and `allowedHosts`. The `Host` check accepts the daemon's own address and each allowed value; the `Origin` check accepts an absent `Origin` or `http://` and an accepted value. The OpenTelemetry endpoint takes a call only from a loopback peer, and refuses any other with `request.forbidden_peer`, 403. The token and the routes that need it are unchanged.

- [x] Through `startDaemon` and raw requests in `apps/daemon/test/daemon.test.ts`:
  - with nothing set, the bind is `127.0.0.1`, and `localhost:<port>` is still refused;
  - an allowed value with the token succeeds, and the same value without the token gets `auth.missing`;
  - a `Host` neither own nor allowed gets `request.forbidden_host`, with the accepted addresses in its params;
  - an `Origin` of `http://` and an allowed value passes, any other gets `request.forbidden_origin`;
  - bound to `0.0.0.0`, the runtime file has `host` `127.0.0.1`, `bind` `0.0.0.0` and `allowedHosts`, and a request over loopback succeeds.
- [x] A `BINNACLE_HOST` other than the two values, and an allowed value without a port, are refused when the daemon starts, each with a message naming what it takes.
- [x] In `apps/daemon/test/opentelemetry.test.ts`: a call from loopback is accepted as today; with the daemon bound to `0.0.0.0`, a call over the machine's own non-loopback address gets `request.forbidden_peer`, the case skipped when the machine has no such address.
- [x] `request.forbidden_peer` is worded in both languages in `@binnacle/core`, and the codes test covers it.
- [x] `binn dashboard --print` gives the first allowed value with the token in the fragment when the runtime file has one, and the runtime file's address otherwise, in `apps/cli/test/dashboard.test.ts`; when the opener fails, the printed address stands and the failure is said.
- [x] `binn daemon status` shows the bound address and the accepted addresses, in both languages.
- [x] The telemetry export's address is the runtime file's `host`, never `0.0.0.0`.
- [x] `binn --help` lists `BINNACLE_HOST` and `BINNACLE_ALLOWED_HOSTS` beside `BINNACLE_PORT`, in both languages.
- [x] `docs/01-architecture.md`, *Security boundary*, says the default bind stays loopback and what the user may set, citing ADR-0048; ADR-0031 says the dashboard's address is the first allowed `Host` when one is set.

## Comments

### Decisions

- **Where things live.** `resolveBind` and `resolveAllowedHosts` sit beside `resolvePort` in `apps/daemon/src/home.ts`, with `LOOPBACK` and `EVERY_INTERFACE`; `bin.ts` passes them to `startDaemon` as `bind` and `allowedHosts`, which replace its unused `host` option. `startTestDaemon` takes both too.
- **The runtime file** has `host` (always `127.0.0.1` now), `port`, `bind` and `allowedHosts`. `readRuntime` fills `bind` from `host` and `allowedHosts` with none for a file a daemon older than 0.7.0 wrote, and `binn daemon status` does the same for such a daemon's `daemon.status`.
- **`request.forbidden_host`'s params** are `host` and `accepted`, the daemon's own address and each allowed value, comma-joined; the old `address` param is gone.
- **An allowed value** is `host:port` with a port from 1 to 65535 and no second colon: IPv6 values are out of scope (spec, *Contested points*).
- **The peer check** covers `/v1/logs`, `/v1/metrics` and `/v1/traces`, after the `Host` and `Origin` checks: peers `127.0.0.1`, `::1` and `::ffff:127.0.0.1`.
- **`binn daemon start` and `status`** print the new `bound` and `accepts` rows, since they share one report; `accepts` lists the daemon's own address first.
- **The user guides the change made untrue** were corrected in both languages: `docs/operations/04-security-resilience` (the bind, the `Host` and `Origin` rules, the OpenTelemetry endpoint's peer) and `05-installation-checklist`'s *Environment variables* (seven variables, the two new rows).

### For the next tickets

- Ticket 02's start command sets `BINNACLE_HOST=0.0.0.0` and `BINNACLE_ALLOWED_HOSTS=127.0.0.1:<hostPort>,localhost:<hostPort>`. `binn dashboard` prints the first allowed value, so list `127.0.0.1:<hostPort>` first.
- A bad value stops the daemon at start: `binn daemon start` exits non-zero and shows the daemon log's tail with the message.

### Review

Against `main`, in a sub-agent, on the standards, the spec and the ticket's Security role. Typecheck and the full suite pass; the `request.forbidden_peer` case ran on this machine, not skipped.

1. **The installation checklist's *Environment variables* was untrue**: "all five" variables, `BINNACLE_PORT` called the loopback port, and no row for the two new ones, in `docs/operations/05-installation-checklist.md` and its twin. **Fixed**: seven variables, the two rows, both languages.
2. **An allowed value took port 0, 99999 and `a:b:80`.** **Fixed**: the port must be 1 to 65535, with no second colon; the resolver test pins it.
3. **The new no-browser test did not check that the token stays unprinted.** **Fixed**: it asserts the token is in neither stdout nor stderr.
4. **`docs/01-architecture.md` repeated the default and read awkwardly.** **Fixed**: one sentence for the default, one for the two variables.
5. **`forbidden_host` lists every accepted address to a caller without a token.** **Kept**: the spec asks for it, and it reveals port numbers only.
6. **`bound` and `accepts` also show in `binn daemon start`.** **Kept**: one shared report, and harmless.

#### Security

No findings. With nothing set the daemon binds `127.0.0.1` and accepts `127.0.0.1:<port>` alone, as in 0.6.0, and `localhost:<port>` is still refused. The peer check reads the socket's remote address, which a client cannot forge; a call through a published port arrives from Docker's gateway, not loopback, and is refused. The token on `/ops/` is unchanged, and `binn dashboard` prints it only with `--print`.
