# 02: Secrets in the audit

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** `binn audit` gains the `secrets` area, after `docker` (spec, *Secrets*). It matches exact token formats in the text files `git ls-files` lists, skipping binary files and files over a size limit: GitHub `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` and `github_pat_`; GitLab `glpat-`; AWS `AKIA` and `ASIA`; npm `npm_`; Slack `xoxb-`, `xoxp-`, `xoxa-`, `xoxr-`, `xoxs-`; Anthropic `sk-ant-`; OpenAI `sk-proj-` and the classic `sk-`; Google `AIza`; a PEM private key header. Each prefix's length and character set is confirmed against the provider's documentation, and a match must not run on into more token characters. A match is a `gap` with its path, line and kind, and never any part of its value. A tracked `.env` or `.env.<suffix>` is its own `gap`, except `.env.example`, `.env.sample` and `.env.template`. The recommendation: remove the value, rotate the key, rewriting history is the owner's, gitleaks for a scan with history. None found is `ok` with the number of files read. No allowlist.

- [ ] Through `binn audit --json` on a fixture with one token of each format in a tracked file: each is a `gap` with its path, line and kind.
- [ ] No part of any planted value appears in the text output or the JSON.
- [ ] The same tokens in an ignored or untracked file are not reported; tokens one character short are not reported.
- [ ] A tracked `.env` and `.env.local` are gaps; `.env.example`, `.env.sample` and `.env.template` are not.
- [ ] The audit on this repository gives no gap in `secrets`: its test fixtures stay out of the formats.
- [ ] The formats and lengths, with the documentation each was checked against, are listed in the ticket's comments.
