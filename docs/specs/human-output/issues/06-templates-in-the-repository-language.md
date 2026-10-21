# 06: binn init's templates in the repository language

Status: READY
Triage: ready-for-agent
Blocked by: 01
Spec: `docs/specs/human-output/spec.md`
Roles: Developer, Reviewer, QA

**What to build:** the files `binn init` writes are in the repository language (spec, *Templates in the repository language*). The roadmap skeleton, the issue tracker's file with its ticket-header section, the triage labels' file, the domain file, the *Agent skills* block and a new `AGENTS.md`'s heading each have an English and a Russian text, chosen by the language the plan carries (ticket 01). The markers stay English in both: the roadmap's `| # | Epic | Status | Spec |`, its statuses, `## Current focus`, `Next action:`, the ticket header's field names and state values, the triage label strings, `## Ticket header` and `## Agent skills`. The *Agent skills* block gains one line stating the documentation language when it is not English, so that any agent writes its specs and tickets in it.

- [ ] Through the `binn` process: a Russian repository's plan holds the Russian templates, an English one's the English templates as today.
- [ ] On a fixture `binn init` wrote in Russian, `binn audit` finds no gap in the roadmap and the ticket-header section, and the roadmap parser gives no diagnostic.
- [ ] The *Agent skills* block names Russian on a Russian repository and says nothing of language on an English one.
