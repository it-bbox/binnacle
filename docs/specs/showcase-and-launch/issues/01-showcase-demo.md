# 01: The demo GIF and the dashboard screenshots

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** an animated GIF of the dashboard in action, and static screenshots of its pages, that the README and the site embed, so a visitor sees the tool working in seconds (the spec's *The demo is an animated GIF everywhere*).

- [x] One animated GIF shows the dashboard working: it opens, a project and its tasks show, and the view is readable at a glance.
- [x] Static screenshots cover the dashboard's main pages — the overview, the tasks, usage and attention.
- [x] The GIF and the screenshots are checked into the repository and are the targets the README and the site link to, so the user-guides test passes.

## Comments

### Review

Reviewed the branch against `main` on 2026-10-31, in a sub-agent separate from the implementation. Re-captured and reviewed again after the autopilot's verification found two things to fix in the images.

**The owner's instruction, recorded for the review:** the dashboard screenshots and the demo GIF must show the interface in English, not Russian. Checked again after the re-capture: every GIF frame and all four screenshots show English UI only; the Russian twin's alt text stays Russian.

**Autopilot's verification, and what changed:**
- The captures showed this machine's home and this worktree in the project path. The demo project stays in the gitignored `.scratch/`, as the unattended brief requires; the rendered text is swapped to a neutral `/home/demo/binnacle-demo` just before each capture, so no `/home/mikhail` and no worktree path appears in any image.
- The usage page showed derived metrics as unavailable. The demo project now has two `DONE` Tasks with runs: `usage-and-attention/01` taken through implementation, review and rework, and `02` through implementation and review only. The page shows tokens per completed Task, runs per Task, Ponytail before and after, a rework share of 25% and first-pass acceptance of 50%, all consistent with the demo's own sessions and commits.

Fixed:
- The screenshot table's second label row was bold while the first was not, in both READMEs. Both rows are plain now.

Kept:
- The attention page shows one item: `docs/specs/usage-and-attention/spec.md` is a spec no roadmap row links. That is the demo project's real state, and it shows the page doing its work.

Checked:
- `assets/demo.gif` is a 6-frame animated GIF, 1280x800, 2 s per frame: overview, board, ticket, usage, attention, overview.
- `assets/overview.png`, `tasks.png`, `usage.png` and `attention.png` are 2560x1800 and cover the four pages the ticket names; none shows `/home/mikhail`, a worktree path or Russian UI.
- Both READMEs embed the GIF and the screenshots from `assets/`; `node --test apps/cli/test/user-guides.test.ts` passes, so every relative link resolves.
- `pnpm typecheck` passes. `LANGUAGE=C pnpm test`: 982 pass, 1 skipped, 0 fail. Without `LANGUAGE=C`, `apps/cli/test/locale.test.ts` fails on this machine's `LANG=ru_RU.UTF-8`, because the systemd D-Bus error it prints is localized ("Операция не позволена" against "Operation not permitted"); that test is byte-for-byte and unrelated to this change.

### Notes for the next tickets

- Ticket 03 (README storefront): the demo section is in `README.md` and `README.ru.md`, after the intro and before *The problem*. Keep the embeds; the assets are at `assets/demo.gif`, `assets/overview.png`, `assets/tasks.png`, `assets/usage.png` and `assets/attention.png`, outside `docs/`, so leading with the demo does not put a `docs/` reference before the install path.
- Ticket 05 (site): the same five paths are the images to show. If GitHub Pages serves the repository root, link them as `../assets/<name>` from a page under `docs/`; if it serves `/docs`, copy them into the site's directory or point Pages at the root. The images are in English, as the owner asked; do not add a Russian set.
