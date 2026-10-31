# 07: The launch checklist

Status: DONE
Triage: ready-for-agent
Blocked by: 03, 04, 05, 06
Spec: `docs/specs/showcase-and-launch/spec.md`
Roles: Developer, Reviewer

**What to build:** a Markdown checklist that orders the launch — the README, the site, the listings, the posts — so the owner runs it without missing a step.

- [x] The checklist orders the steps: README, site, listings, posts.
- [x] The posts are marked as the owner's.
- [x] The checklist names where each artifact lives and what "done" looks like for it.

## Comments

### The checklist

`docs/showcase/launch-checklist.md` orders the four steps and, under each, names where the artifact lives, lists the owner's checkboxes and states what done looks like. The listings step carries the owner's ordered steps from `docs/showcase/listings.md`, *What the owner must do, in order*; the posts step turns on GitHub Discussions, where questions go.

Nothing was applied, published, filed or posted: every step is the owner's hand, as the spec's *Further Notes* say.

### Review

Reviewed the branch against `main` on 2026-10-31, in a sub-agent separate from the implementation.

#### Standards

Fixed:
- `apps/cli/test/checklist.test.ts`: the artifact checks covered only some of what the checklist names. The README step now also pins the four screenshots, the site step the Russian write-up, and a new check pins the repository and site URLs.
- `apps/cli/test/checklist.test.ts`: the checkbox count and the Discussions mention were checked document-wide, so a section that lost its checkbox, or a Discussions mention that moved out of the posts step, passed. Each section must now carry a checkbox, and Discussions must sit in the posts section.

Kept:
- The test's exact `deepEqual` over the four headings pins the order the ticket asks for; renaming or reordering a step fails it.

#### Spec

Fixed:
- `docs/showcase/launch-checklist.md`: *The site* said to "rebuild" the page later, but `pages.yml` only copies `site/index.html`, which carries the write-up as embedded text. The step now names the write-up files and the copies in the page as one set to update together.

Left:
- The spec's *Implementation Decisions* say "The listings are filed by the epic" while its *Further Notes* and `listings.md` leave filing to the owner. The checklist follows the latter, which the brief and the epic's out-of-scope list confirm; correcting the spec line is a Product session's, outside this ticket.

Checked:
- All paths the checklist names exist: `README.md`, `README.ru.md`, the GIF and four screenshots under `assets/`, `site/index.html`, `.github/workflows/pages.yml`, `write-up.md`, `write-up.ru.md`, `identity.md`, `listings.md`.
- The URLs are the ones the README, the site and the listings use; `identity.md` holds exactly the twelve topics the checklist calls twelve; the five owner steps match `listings.md`'s ordered list.
- The posts are marked as the owner's and set apart from the epic, and the channels match the spec's out-of-scope list: Reddit, Hacker News, X, Habr and Telegram.
- The checklist is public-safe and its two relative links resolve; the change adds no dependency and touches nothing outside the ticket.
- `node --test apps/cli/test/checklist.test.ts`: 7 pass, 0 fail. `pnpm typecheck`: exit 0. `LANGUAGE=C pnpm test`: 999 pass, 1 skipped, 0 fail.

### Notes for the next tickets

- Ticket 08 (the exit demonstration) is the owner's. The launch checklist is `docs/showcase/launch-checklist.md`; its third and fourth steps and every listing remain the owner's, since nothing is filed or posted from this repository.

