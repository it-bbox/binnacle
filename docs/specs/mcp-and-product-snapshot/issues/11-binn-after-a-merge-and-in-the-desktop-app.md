# 11: `binn` after a merge and in the desktop app

Status: READY
Triage: ready-for-agent
Blocked by: None (can start immediately)
Spec: `docs/specs/mcp-and-product-snapshot/spec.md`

Found by ticket 04's hand check and recorded in ticket 07's Comments.

**What is wrong:** two setup gaps leave `binn`, and with it every session's `binnacle` MCP server, broken until fixed by hand.

- After a merge that adds a workspace package, the main checkout's `node_modules` lacks it, and the linked `binn` fails with `ERR_MODULE_NOT_FOUND` until `pnpm install` runs there. The README says `pnpm install` once, before linking, and not after pulling.
- `pnpm setup` puts its global bin directory on PATH in `~/.bashrc`, which the desktop app does not read, so `.mcp.json` cannot start `binn`. A symlink from `~/.local/bin` does not work, because pnpm's shim resolves the CLI relative to its own location; a two-line wrapper script there does.

**What to build:** the README's setup section says both, in `README.md` and `README.ru.md` in the same change. No code.

- [ ] The setup section says to run `pnpm install` in the main checkout after pulling a change that touches the workspace, and why.
- [ ] It says how to make `binn` visible to the desktop app: a wrapper script in a directory already on the app's PATH, with its two lines, and why a symlink fails.
- [ ] `README.ru.md` says the same.

## Comments
