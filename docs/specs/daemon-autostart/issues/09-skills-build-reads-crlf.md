# 09: The skills build reads a Windows checkout

Status: READY
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/daemon-autostart/spec.md`

**What to build:** `pnpm install` works in a Windows checkout, so that ticket 07's live test runs on the Windows runner (spec, *CI*). On `windows-latest` Git checks files out with CRLF, and the CLI package's `prepare` (`apps/cli/src/prepare.ts`) refuses every `SKILL.md`, whose frontmatter it expects to open with `---\n`: `answer/SKILL.md: no frontmatter between two --- lines` (`main`'s CI at `e1916be`, job `autostart-live (windows-latest)`). The build reads a skill whether its lines end in LF or CRLF, and what it writes is the same either way; or the repository fixes its line endings, whichever is smaller and holds for a user cloning on Windows too.

- [x] The package build's test builds the skills from a `SKILL.md` with CRLF line endings, and the output equals the LF one's.
- [ ] `main`'s CI after the merge: `autostart-live (windows-latest)` gets past `pnpm install` and runs the live test; ticket 07's Windows diagnostics are recorded in ticket 07.

## Comments

- The fix is in the code, not in a `.gitattributes`: `prepareSkills` turns every `\r\n` into `\n` as it reads a `SKILL.md`, so the skills copy is byte for byte the LF one's, whatever the clone's `core.autocrlf` or the editor wrote. The test (`apps/cli/test/pack.test.ts`, the skills copy's test) rewrites every plugin skill with CRLF and compares the two builds.
- Decision: `preparePlugin`'s version still hashes the source's raw bytes, so a CRLF checkout gets another version than an LF one, and its plugin copy keeps CRLF. Harmless: the version only has to change when a skill does, within one checkout, and nothing compares it across machines. `prepare` is the workspace's only install script, and `JSON.parse` reads a CRLF `plugin.json`.

### Verify after the merge

The second criterion is read from the CI run of `main` after the merge:

1. On GitHub, *Actions*, workflow *CI*, the run of the merge commit on `main`, job `autostart-live (windows-latest)`.
2. Its `pnpm install --frozen-lockfile` step is green, and the next step runs `node --test apps/cli/test/autostart.live.ts`.
3. Record that step's two diagnostics in ticket 07, as its *Verify after the merge* says: "Task Scheduler restarted / did not restart a daemon killed with a failure" and "schtasks /End ended / left the daemon".
4. If `pnpm install` passes but the live test finds no `apps/cli/plugin` or `apps/cli/skills`, look first at `prepare.ts`'s last block: it compares `process.argv[1]` with the module's path as raw strings, which a drive letter's case could make differ on Windows.

### Review

Against `main`, on the standards and the spec, in a sub-agent.

1. **Kept**: the plugin's version differs on a CRLF checkout; nothing compares it across machines (above).
2. **Kept**: no `.gitattributes`; about as small, but it would not hold for an existing checkout or an editor saving CRLF, which the code fix does.
3. **Kept**: a file with lone `\r` line endings still fails with `no frontmatter`; Git never writes one.
4. **Left**: `prepare.ts`'s run guard compares paths as raw strings, older than this ticket; it is unlikely to differ on the runner, and step 4 above names it if it does.
5. None on the standards: one line in the source, no dependency, the commit's subject and authorship as `AGENTS.md` says.
