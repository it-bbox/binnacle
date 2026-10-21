# ADR-0045: The Person's Language and the Repository's

**Status:** Accepted. Amends epic 6's rule, in `docs/04-telemetry-dashboard.md`, that Task, Epic, Next action, Suggested step, Backlog, Ready, In progress, Done, Review and Unmet dependency stay English in every language.

## Context

Binnacle writes text for two readers. A person reads its chat reports, its terminal output and its dashboard. Agents, and the person later, read the files it writes into a repository: `binn init`'s templates, the roadmap and tickets its skills write, the vault it projects. Until epic 13 all of it was English, except the dashboard, which spoke Russian but kept the domain's terms English. This repository is the case that forces a rule: its documentation is English by `AGENTS.md`, while its owner speaks Russian (`docs/specs/human-output/brief.md`).

## Decision

- **Text for a person is in the person's language**: in the chat, the language of the conversation; in `binn`, the system locale; on the dashboard, the browser's language or the Settings page's choice. English and Russian are supported.
- **Text in a repository is in the repository's documentation language**, stated in the project manifest and proposed by `binn init`. It is never translated to the person's language. A manifest that states none is English.
- **The markers Binnacle parses stay English in every repository**: `Status:`, `Blocked by:`, `## Current focus`, `Next action:` and the rest of the formats that are a contract.
- **The domain's terms are translated in Russian output**, the dashboard included. Commands, paths, Task ids and branch names are never translated.

## Considered Options

- **Everything in the repository's language.** Rejected: an English-documented project would answer a Russian speaker in English, which is the problem epic 13 exists to fix.
- **Everything in the person's language.** Rejected: one contributor's language would decide the language of files every agent and contributor reads, and two contributors would write in two.
- **The repository's language told from its documents each time.** Rejected: a new project has nothing to tell it from, and a guess can be wrong where a stated field is not.
- **Domain terms kept English in Russian output**, as epic 6 decided. Rejected by the owner on 2026-10-21: the mixed text is what made the output read as written for an agent.

## Consequences

- One person may see Russian in the chat and English in the files the same chat writes; that is intended.
- The skills need the repository's language before they write a file, and `binn init` asks it once.
- Every Russian string is in a dictionary or worded by the model; the daemon's own messages stay English with their codes, for agents and for `--json`.
