# 11: `binn` after a merge and in the desktop app

Status: DONE
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

Found by ticket 04's hand check and recorded in ticket 07's Comments.

**What is wrong:** two setup gaps leave `binn`, and with it every session's `binnacle` MCP server, broken until fixed by hand.

- After a merge that adds a workspace package, the main checkout's `node_modules` lacks it, and the linked `binn` fails with `ERR_MODULE_NOT_FOUND` until `pnpm install` runs there. The README says `pnpm install` once, before linking, and not after pulling.
- `pnpm setup` puts its global bin directory on PATH in `~/.bashrc`, which the desktop app does not read, so `.mcp.json` cannot start `binn`. A symlink from `~/.local/bin` does not work, because pnpm's shim resolves the CLI relative to its own location; a two-line wrapper script there does.

**What to build:** the README's setup section says both, in `README.md` and `README.ru.md` in the same change. No code.

- [x] The setup section says to run `pnpm install` in the main checkout after pulling a change that touches the workspace, and why.
- [x] It says how to make `binn` visible to the desktop app: a wrapper script in a directory already on the app's PATH, with its two lines, and why a symlink fails.
- [x] `README.ru.md` says the same.

## Comments

- **Where it went.** Three paragraphs under *Install* → *From this repository*, after the linking steps, in `README.md` and `README.ru.md`. No code, as the ticket says.
- **The wrapper's two lines** are the ones in the owner's working `~/.local/bin/binn`. The README writes pnpm's bin directory out as `$HOME/.local/share/pnpm`, pnpm's Linux default, and says to take the real one from `echo $PNPM_HOME`, because the desktop app has no `$PNPM_HOME` either. macOS and Windows are not covered: the finding was on Linux, and the ticket asks for no more.
- **The symlink claim was checked** against pnpm's shim on this machine: it takes its base directory from `dirname "$0"` with no `readlink`, then reaches the CLI by a relative path from there.
- **Not verified here:** starting the desktop app with the wrapper in place. The owner's machine already runs this exact wrapper (ticket 07's Comments), so no new hand check is filed.

### Review

`/code-review` ran against `main` on both axes, after the first README commit.

**Standards: no hard violation.** English and Russian updated in one change, commit authorship clean, work on a `feat/` branch. Judgement calls:

1. "so there `.mcp.json` cannot find `binn`" — *there* was vague. **Fixed:** "in the desktop app".
2. The Russian «его не читает» could mean the file or PATH. **Fixed:** «этот файл не читает».

**Spec: all three criteria met, no scope creep.** Findings:

1. "Make it visible" could be read as `.mcp.json`. **Fixed:** "Make `binn` visible", in both versions.
2. The Russian dropped *bin* from "pnpm's global bin directory", which reads as pnpm's global packages directory. **Fixed:** «глобальный каталог pnpm для исполняемых файлов», twice.
3. Neither version said why the wrapper hardcodes the path instead of using `$PNPM_HOME`. **Fixed:** one clause saying the app has no `$PNPM_HOME` either.
4. On most distributions `~/.profile` adds `~/.local/bin` to PATH only if it existed at login, so a user who creates it for the wrapper may need to log in again. **Left:** it holds on the owner's machine, and the README names `~/.local/bin` as an example of a directory already on the app's PATH.
