# 11: /binnacle:init says when a new session is needed, and the skills name /binnacle:register

Status: DONE
Triage: ready-for-agent
Blocked by: 10
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** two defects found in epic 9's exit demonstration (2026-10-05).

1. Claude Code reads `.mcp.json` only when a session starts. After `/binnacle:init` created it, the same session had no `binnacle` MCP server, and `/binnacle:product` there could not run. When the Summary shows that init created or changed `.mcp.json`, `/binnacle:init` ends by saying: open a new session in this repository, and approve the project's `binnacle` server when Claude Code asks.
2. After `/binnacle:daemon start`, and in `/binnacle:init` when the notes say the daemon was not running, the skills say to run `/binnacle:init` again to add the registration. `/binnacle:register` (ticket 04) does exactly that: name it instead.

Blocked by 10 so that, merged by autopilot, it is also the live check of epic 9's third exit criterion: a skill changed by a merge is the one the next session runs.

- [x] `/binnacle:init` says to open a new session and approve the `binnacle` server when init created or changed `.mcp.json`, and says nothing of it otherwise.
- [x] `/binnacle:daemon start` and `/binnacle:init` name `/binnacle:register` for a missing registration, not `/binnacle:init` again.
- [x] A test in `apps/cli/test/pack.test.ts` holds both.

## Comments

- **"Created or changed" is "created".** `binn init` never rewrites an existing JSON file (ADR-0026): when `.mcp.json` exists without `binnacle`, it prints the entry for the human to add, and the Summary says `printed  the entry for .mcp.json`. So `created  .mcp.json` is the only Summary line in which init changed it, and the skill's step 7 keys on that line alone. A `.vscode/mcp.json` line does not count.
- **`/binnacle:daemon start`** did not name `/binnacle:init` again; it said only that daemon-dependent skills could run again. It now adds that a project not registered yet is registered by `/binnacle:register`, which the criterion asks for.
- **The old wording elsewhere.** `README.md`, `README.ru.md`, `docs/03-mcp-and-skills.md` and the epic spec's story 12 and *`/binnacle:init`'s procedure* said `/binnacle:daemon start` then `/binnacle:init` again; they now name `/binnacle:register`, and the README, docs/03 and the spec's procedure say when init asks for a new session. Ticket 03's text is a finished ticket's record and is left as it was.
- **The live check of epic 9's third exit criterion** happens only after this branch is merged and the plugin refreshed: it is the owner's, below.

### Review

Code review against `main`, both axes.

- **Fixed.** Step 7 said "created or extended", but an existing `.mcp.json` is never extended, only printed for the human; it now says "created", and the test holds that wording.
- **Fixed.** When init ran on a path other than the session's repository, step 7 said "this repository" and step 6 a bare `/binnacle:register`, which registers the session's main checkout. Step 7 now names the repository at the `root` init set up, and step 6 passes the same path to `/binnacle:register`.
- **Fixed.** The epic spec's story 12 and init procedure still sent the registration back to `/binnacle:init`; they now name `/binnacle:register`.
- **Left.** When `.mcp.json` already exists without `binnacle`, init prints the entry, and the human who adds it by hand also needs a new session. The criterion says to say nothing of it "otherwise", and init did not change the file, so the skill says nothing.
- **Left.** Step 6 fires on a daemon that is not running, not on registration skipped for another reason, such as no usable manifest. That is unchanged and outside this ticket.
- **Kept.** The same sentence is repeated in two skills, two READMEs, docs/03 and the spec: that is how this repository documents its skills.
- **Kept.** The test matches the skills' sentences word for word, as every other skill test in `pack.test.ts` does.

### Hand check (the owner's)

After the merge, in a scratch Git repository with no `.mcp.json`, and once autopilot or `claude plugin update binnacle@binnacle` has refreshed the plugin:

```sh
repo=$(mktemp -d) && git -C "$repo" init -q && cd "$repo" && claude
```

In that session, type `/binnacle:init`, then yes. The Summary shows `created  .mcp.json`, and the answer ends by saying to open a new session in that repository and approve the project's `binnacle` server. That this session gives the new ending is the live check of epic 9's third exit criterion. Run it again in a second scratch repository, with Claude Code started as `BINNACLE_HOME=$(mktemp -d) claude` so that no daemon is found and yours keeps running: the answer names `/binnacle:daemon start` then `/binnacle:register`. In a repository whose `.mcp.json` already names `binnacle`, it says nothing of a new session.
