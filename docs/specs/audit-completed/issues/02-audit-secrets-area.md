# 02: Secrets in the audit

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/audit-completed/spec.md`
Roles: Developer, Reviewer, Security

**What to build:** `binn audit` gains the `secrets` area, after `docker` (spec, *Secrets*). It matches exact token formats in the text files `git ls-files` lists, skipping binary files and files over a size limit: GitHub `ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_` and `github_pat_`; GitLab `glpat-`; AWS `AKIA` and `ASIA`; npm `npm_`; Slack `xoxb-`, `xoxp-`, `xoxa-`, `xoxr-`, `xoxs-`; Anthropic `sk-ant-`; OpenAI `sk-proj-` and the classic `sk-`; Google `AIza`; a PEM private key header. Each prefix's length and character set is confirmed against the provider's documentation, and a match must not run on into more token characters. A match is a `gap` with its path, line and kind, and never any part of its value. A tracked `.env` or `.env.<suffix>` is its own `gap`, except `.env.example`, `.env.sample` and `.env.template`. The recommendation: remove the value, rotate the key, rewriting history is the owner's, gitleaks for a scan with history. None found is `ok` with the number of files read. No allowlist.

- [x] Through `binn audit --json` on a fixture with one token of each format in a tracked file: each is a `gap` with its path, line and kind.
- [x] No part of any planted value appears in the text output or the JSON.
- [x] The same tokens in an ignored or untracked file are not reported; tokens one character short are not reported.
- [x] A tracked `.env` and `.env.local` are gaps; `.env.example`, `.env.sample` and `.env.template` are not.
- [x] The audit on this repository gives no gap in `secrets`: its test fixtures stay out of the formats.
- [x] The formats and lengths, with the documentation each was checked against, are listed in the ticket's comments.

## Comments

- Codes: `secrets.token`, one `gap` per match, its reason `<path>:<line>: a token in the format of the <kind>; the value is not shown.`; `secrets.env`, one `gap` per tracked environment file; `secrets.scan`, `ok` with the number of text files read and skipped when there is neither, `unknown` when `git ls-files` fails. The code is `secrets()` in `apps/cli/src/audit-files.ts`, beside `docker()`, on the same `tracked()` list.
- Decisions where the ticket is silent: the size limit is 1 MiB; a file is binary when its first 8000 bytes hold a NUL, as Git decides; anything not a regular file (a symbolic link, a submodule) is skipped, so a tracked link to a key outside the repository is never followed; a format's own characters may not stand right before or right after a match; the `.env` rule matches by name in any directory; OpenAI's `sk-svcacct-` and `sk-admin-` and Anthropic's `sk-ant-admin01-` are matched beside the ticket's prefixes, being the same formats.
- For ticket 04 (the plan): every non-`ok` finding of the `secrets` area, `secrets.token` and `secrets.env`, belongs to step 2; neither is closed by `binn init`.
- AWS's documented example access key id, `AKIA` and 16 characters ending in `EXAMPLE`, is in the format and is reported wherever a project quotes it: no allowlist, as the spec decides (user story 19 over 9).
- The recommendation's `git rm --cached -- <path>` gives the path as one shell word, single-quoted when it holds anything but plain characters.

### Review

Against `main`, in a sub-agent, on the standards, the spec and, for the Security role, secrets and trust boundaries. Typecheck and the 840 tests pass; each pattern was probed at its length, one longer and one shorter, and across formats for double matches, with none.

1. **A planted `.env` name ran in the pasted command** (security): `git rm --cached ${path}` printed a name such as `.env.$(command)` unquoted. **Fixed**: the path is one single-quoted shell word after `--`; a test plants such a name.
2. **No test for a token running on** (spec): only one character short was pinned. **Fixed**: `long.txt` plants each exact-length token with one more character; a ranged length (the stateless `ghs_`, `xoxa-`, `xoxr-`, `xoxs-`) or the PEM header has no "one more".
3. **Character classes half in constants, half inline; "1 MiB" written beside its constant.** **Fixed**: the classes are inline throughout, and the text is drawn from the limit.
4. **A directory replaced locally by a link out of the repository is followed** (security): `lstat` sees only the last component. **Kept**: Git never checks a file out behind a link, and what leaves is a path, a line and a kind.
5. **A file name is printed as Git lists it**, a token or a control character in a name included. **Kept**: every area prints paths so; no value from a file's content is ever printed.
6. **A binary or very large file is a way round the scan** (security). **Kept**: user story 17 asks for it; the `ok` counts what it skipped.
7. **AWS's example key is reported.** **Kept**: no allowlist, recorded above.

#### Security

Findings 1, 4, 5 and 6 above. Values: only the path, the line and the kind reach a finding; a read error is swallowed without its message. Trust boundaries: links, submodules, FIFOs and devices are not regular files and are skipped, so nothing outside the repository is read through a tracked link and nothing blocks. Backtracking: each pattern starts with a literal prefix that its own characters may not precede, and adversarial 1 MiB lines ran every pattern in under 12 ms. Silencing: no setting, allowlist or comment hides a match.

### Formats

Providers document their prefixes, rarely their lengths: where the documentation stops, the length and character set are gitleaks' rules (`config/gitleaks.toml` in gitleaks/gitleaks, read 2026-10-15), which encode the formats as observed. Each pattern below is followed and preceded by none of its own characters.

| Kind | Format | Checked against |
| --- | --- | --- |
| GitHub classic PAT, OAuth, App user, App refresh | `ghp_`, `gho_`, `ghu_`, `ghr_` + 36 of `[A-Za-z0-9]` (40 in all) | GitHub Docs, *About authentication to GitHub*, "GitHub's token formats" (the prefixes); GitHub blog, *Behind GitHub's new authentication token formats* (2021: length unchanged at 40, Base62, a 6-character checksum); gitleaks `github-pat`, `github-oauth`, `github-app-token`, `github-refresh-token` |
| GitHub App installation | `ghs_` + 36 of `[A-Za-z0-9]`, or the stateless `ghs_<digits>_<JWT>`: two `eyJ…` base64url parts and a signature of at least 43 | the same page, and GitHub changelog 2026-04-24, *Notice about upcoming new format for GitHub App installation tokens* (`ghs_APPID_JWT`, about 520 characters, length varies); 43 is an HS256 signature, the shortest |
| GitHub fine-grained PAT | `github_pat_` + 82 of `[A-Za-z0-9_]` | GitHub Docs (the prefix); gitleaks `github-fine-grained-pat` |
| GitLab PAT | `glpat-` + 20 of `[A-Za-z0-9_-]`; or the routable `glpat-` + 27 to 300 of them, `.`, 2 + 7 of `[0-9a-z]` | GitLab Docs, *GitLab token overview* (the `glpat-` prefix) and *Personal access tokens* ("must be 20 characters long"); gitleaks `gitlab-pat`, `gitlab-pat-routable` |
| AWS access key id | `AKIA` or `ASIA` + 16 of `[A-Z0-9]` (20 in all) | AWS IAM User Guide, *IAM identifiers*, "Understanding unique ID prefixes" (`AKIA` access key, `ASIA` temporary STS key); gitleaks `aws-access-token`, which narrows to `[A-Z2-7]`, kept wider here |
| npm | `npm_` + 36 of `[A-Za-z0-9]` | GitHub changelog 2021-09-23, *npm has a new access token format* (the prefix, Base62, a CRC32 checksum); gitleaks `npm-access-token` |
| Slack bot | `xoxb-` + 10–13 digits `-` 10–13 digits `-` 24 of `[A-Za-z0-9]` | Slack docs, *Tokens* (the prefix; no length published); gitleaks `slack-bot-token`, narrowed to the 24-character secret of Slack's own example |
| Slack user | `xoxp-` + three groups of 10–13 digits, then 32 of `[a-f0-9]` | Slack docs, *Tokens* (sections separated by `-`, a 32-character secret; tokens before August 2016 have 6 or 10, not matched); gitleaks `slack-user-token` |
| Slack workspace, refresh | `xoxa-`, `xoxr-`, an optional `<digit>-`, then 8–48 of `[A-Za-z0-9]` | legacy, absent from Slack's current docs; gitleaks `slack-legacy-workspace-token` |
| Slack session | `xoxs-` + three digit groups, then at least 10 of `[a-fA-F0-9]` | legacy, absent from Slack's current docs; gitleaks `slack-legacy-token`, with a 10-character floor so that a cut token is not one |
| Anthropic | `sk-ant-api03-` or `sk-ant-admin01-` + 93 of `[A-Za-z0-9_-]` + `AA` (108 or 110 in all) | Claude API docs, *Retrieve API Key (Admin API)* (its example `partial_key_hint` shows `sk-ant-api03-` and the `AA` ending); gitleaks `anthropic-api-key`, `anthropic-admin-api-key` |
| OpenAI | `sk-proj-`, `sk-svcacct-` or `sk-admin-` + 74 or 58 of `[A-Za-z0-9_-]`, `T3BlbkFJ`, 74 or 58 more; classic `sk-` + 20 of `[A-Za-z0-9]`, `T3BlbkFJ`, 20 more (51 in all) | OpenAI publishes no format; gitleaks `openai-api-key` (`T3BlbkFJ` is "OpenAI" in base64) |
| Google API key | `AIza` + 35 of `[A-Za-z0-9_-]` (39 in all) | Google Cloud docs, *Manage API keys* (its example key: `AIza`, 39 characters, `-` and `_` among them); gitleaks `gcp-api-key` |
| PEM private key | `-----BEGIN`, a space, optionally `RSA`, `DSA`, `EC`, `OPENSSH`, `ENCRYPTED` or `PGP` and a space, then `PRIVATE KEY`, optionally ` BLOCK`, then `-----` | RFC 7468 (`PRIVATE KEY`, `ENCRYPTED PRIVATE KEY`), OpenSSL's traditional forms, OpenSSH's key file, RFC 4880 (`PGP PRIVATE KEY BLOCK`) |
