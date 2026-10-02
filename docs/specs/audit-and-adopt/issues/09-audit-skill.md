# 09: /binnacle:audit runs the audit from the chat

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/audit-and-adopt/spec.md`

**What to build:** the owner asked on 2026-10-02 that everything be done from the chat, without going back and forth to a terminal. A new skill in the `binnacle` plugin, `/binnacle:audit [path]`, runs `binn audit --json` on the path, the current repository by default, and presents its findings in the chat: grouped by area, the gaps first with their recommendations, then what is `unknown` and why, then a count of what is `ok`. It writes nothing and fixes nothing. Where a recommendation names `binn init`, it says so, and that running init is the human's. If `binn` is not on the harness's PATH, it says so and gives the README's setup section, as the other skills do. The skill works without the daemon, as the command does.

- [ ] `/binnacle:audit` with no argument audits the current repository; with a path, that path.
- [ ] The findings are shown grouped by area, gaps first with their recommendations, then `unknown` with its reason, then the number of `ok`.
- [ ] Nothing is written, and no recommendation is carried out.
- [ ] A missing `binn` and an audit that could not run (its non-zero exit) are each reported with their reason.
- [ ] The skill ships in the plugin beside the others, and the plugin's packaging test covers it.
- [ ] `docs/03-mcp-and-skills.md`, which says the audit is not a skill, and the README's skill list, mirrored in `README.ru.md`, name `/binnacle:audit`.
