# 07: CI state and open pull requests from GitHub in the snapshot

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/the-state-of-work/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** the snapshot's `ci` section, replacing its placeholder: the forge — the tracker when it is GitHub or GitLab, else the first GitHub or GitLab Git remote — read with the token Binnacle holds for its host or anonymously; the default branch's latest commit with its CI state from its check runs and combined status; the open pull requests, each with its head's CI state and the Task its branch maps to (spec, *The forge*, *CI on GitHub*, *The `ci` section*). A failing default branch is `ci.failing`. `/binnacle:product` presents it, the project page shows it in place of *Not available*, and the vault's snapshot note carries it. GitLab is ticket 09.

- [ ] Loopback-forge tests: passing, failing, running and `none`; check runs and statuses combined as the spec says; open pull requests with their Task; `ci.failing`; the forge taken from the remote when the tracker is local; no forge at all, and 401, 403 and 429, each giving the section unavailable with the reason.
- [ ] Every state is `provider_reported`; the token appears in nothing returned; requests go to the forge's host only.
- [ ] `/binnacle:product` (plugin and copy) presents *CI*.
- [ ] The project page shows it, strings in English and Russian, checked in a browser; the vault's snapshot note carries it.
