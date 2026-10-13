# Audit, completed: what the grilling decided

Epic 12's material is `docs/05-mvp-plan.md`, phase 12, its floor: three more areas of `binn audit` and a migration plan. It is released as 0.2.0, which also carries `docs/product-inbox.md`'s *For the next release* (the owner, 2026-10-13). This brief is what `/to-spec` starts from.

## The problem

`docs/baseline.md` asks the audit to check Docker, secrets and security basics and to give a migration plan; epic 7's audit has none of them. Its findings come as a flat list by area, so a developer adopting a project is not told what to do first. 0.1.0's release also left a handful of rough edges: in its release guide, in the autostart service, in `binn project register`, in the skills' wording and in this repository's Dependabot.

## The outcome wanted

`binn audit` on any repository also says whether a container setup leaks what it should not, whether a secret is committed, and whether the project has a lockfile, dependency updates and a security policy, and ends with numbered steps in the order to take them. Binnacle's own report stays clean. 0.2.0 ships it with the rough edges of 0.1.0 fixed.

## Who it concerns

A developer adopting an existing project, who runs `binn audit` or `/binnacle:audit` first; the owner, who releases 0.2.0 and runs Binnacle on their own machine; anyone installing Binnacle from npm.

## The systems it touches

- `binn audit` (`apps/cli/src/audit*.ts`), `AUDIT_AREAS` and `Finding` in the core package, and the `/binnacle:audit` skill;
- `binn init`, `/binnacle:init` and `binn daemon autostart`;
- `binn project register`, the dashboard's projects and the pages that list projects;
- the current epic (`currentEpic`), read by the snapshot, the Suggested step and the dashboard;
- the plugin's skills, `CONTRIBUTING.md` and `CONTRIBUTING.ru.md`, `.github/dependabot.yml`.

## Decided in the grilling, 2026-10-13

- **Secrets: Binnacle's own patterns, over the working tree.** A short list of exact token formats (GitHub, GitLab, AWS, npm, Slack, Anthropic and OpenAI, Google, PEM private keys) matched in the files `git ls-files` lists, and a committed `.env`. Git's history is not read; the recommendation names gitleaks for a scan with history. The audit still runs nothing but Git.
- **No allowlist.** A match is a `gap` with its path and line; the human judges it. Exact formats keep false matches rare, and a fixture can be shortened out of the format. An allowlist waits for a real project that needs one.
- **No container setup is `ok`.** Many projects need none. A `gap` only when a Dockerfile or compose file exists and `.dockerignore` is missing or does not exclude `.env` and `.git`.
- **The migration plan is always in the report**: after the findings in the text, as `plan` in `--json`, and first in `/binnacle:audit`. Steps: what `binn init` closes, then the secrets, then the rest in the order of the areas (`CONTEXT.md`, *Migration plan*).
- **Four items of the product inbox join the epic**, beside *For the next release*:
  - a check that `extensions.worktreeconfig` is set with no `config.worktree`, a `gap` naming the harness it breaks, Antigravity;
  - autostart from the chat: `/binnacle:init` asks the owner and passes the answer as a flag;
  - the current epic by its furthest-along status, `in progress`, then `tickets`, then `spec`, then `not started`, the table's order only between equals;
  - a registration whose directory is gone: the registry is untouched; the project drops off the overview and the other pages and stays a row on the projects page with `binn project unregister <path>` ready to copy. Skills and briefs that try a CLI on a throwaway repository say to use a temporary `BINNACLE_HOME`.
- **Tracker tokens and the autostart service**: `binn daemon autostart on` and `binn init`, finding a tracker token in the environment and none in `credentials.json`, say the service will not see it and to put it in `credentials.json`, and so does the guide. Binnacle copies no secret anywhere.
- **Dependabot's failed npm update** is a ticket of this epic: an epic that adds a check for dependency updates does not ship beside a broken one.

Defaults, from the docs and Ponytail, not put to the owner:

- The audit stays read-only and offline, with no new dependency (epic 7). The new areas, Docker, secrets and security, come after the existing ones in `AUDIT_AREAS`; findings keep `ok`, `gap` and `unknown`.
- A secret is given by path and line, never by value. `.env.example`, `.env.sample` and `.env.template` are allowed. The recommendation: remove it and rotate the key; rewriting history is the owner's.
- Security basics: a lockfile of any known ecosystem; a Dependabot or Renovate configuration in any of its places; `SECURITY.md` at the root, in `.github/` or in `docs/`.
- Which findings fall into the `binn init` step is a field of the finding, not a match on its recommendation's text.
- The audit in MCP and the dashboard stays out of scope, as in epic 7.
- *For the next release*, each a ticket or part of one: `CONTRIBUTING.md`'s *Releasing* and its twin gain npm's 2FA, the browser prompt, a recovery code's 72-hour hold and `0.0.0-stage` shown as `latest`; `@ast-grep/cli`'s postinstall under npm's `allowScripts`, looked up in npm's documentation first; `binn project register` without a manifest names `binn init` rather than a template only a checkout has; the skills drop "until the npm package is published"; the tokens warning above.
- The last ticket is the exit demonstration: a clean report on this repository, the expected findings and plan on a fixture with a committed `.env`, a key and a Dockerfile with no `.dockerignore`; then the 0.2.0 release by *Releasing*, published by the owner, whose npm account has 2FA.

## Constraints and open questions

- 0.2.0 is epic 12 and nothing else; epic 13 is 0.3.0 (the roadmap's current focus).
- Open for `/to-spec`: the exact list of token formats and their lengths; which of today's findings `binn init` closes; what npm's `allowScripts` asks of an installer.
