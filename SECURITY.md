# Security policy

_Русская версия: [SECURITY.ru.md](SECURITY.ru.md)._

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.2.x   | Yes       |

Fixes go only into the latest `0.2.x` release of `@it-bbox/binnacle`.

## Reporting a vulnerability

Report it privately, through GitHub's private vulnerability reporting: [open a report](https://github.com/it-bbox/binnacle/security/advisories/new), or *Security* → *Report a vulnerability* on the repository.

Do not open a public issue or pull request for a vulnerability.

A good report says what is affected, how to reproduce it and what an attacker gains.

## Scope

In scope:

- the daemon's loopback API, `binnd`, and its token;
- the dashboard the daemon serves;
- the CLI, `binn`, including `binn mcp`;
- the published package, `@it-bbox/binnacle`.

The security boundary these rely on is in [the architecture's *Security boundary*](docs/01-architecture.md#security-boundary).

Out of scope: a vulnerability in a harness, tracker or tool Binnacle talks to, which goes to its own project.
