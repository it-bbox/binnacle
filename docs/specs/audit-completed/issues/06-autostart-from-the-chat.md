# 06: Autostart from the chat

Status: READY
Triage: ready-for-agent
Blocked by: 05
Spec: `docs/specs/audit-completed/spec.md`

**What to build:** `/binnacle:init` asks the owner whether the daemon should start at login, as a terminal's `binn init` does (spec, *Autostart from the chat*). `binn init --plan --json` reports whether autostart could be asked: off and available for this home. A flag for the answer, as `--window` carries the window, is accepted by `--plan` and `--apply`; with a yes the plan has the autostart item as its last, with a no the Summary names `binn daemon autostart on`. The skill asks in the chat only when the plan says it could be asked, and passes the answer to both calls. Without the flag the chat forms behave as today.

- [x] Through the `binn` process: `--plan --json` says whether autostart could be asked; with autostart on, or not available, it says no.
- [x] `--plan` with the yes flag shows the autostart item last; `--apply` with the same flag runs it, through a stand-in service manager.
- [x] With the no flag, or none, nothing is installed and the Summary names `binn daemon autostart on`.
- [x] The `/binnacle:init` skill asks only when the plan says so, and passes the same answer to `--plan` and `--apply`.

## Comments

- Decisions where the ticket is silent: the flag is `--autostart <yes|no>`, accepted by every form of `binn init`, as `--window` is; anything else is a usage error (exit 2). `--plan --json` carries `autostart: { ask }`, true while autostart is off and available for this home, whatever answer is passed. A given answer is taken unasked in every form, the terminal's included; a yes where autostart is on, broken or not available plans nothing, as without the flag. A no is the terminal's decline: `skipped autostart: declined, \`binn daemon autostart on\` turns it on later`. The plan's id differs with a yes, so `--apply` needs the same answer `--plan` was given. The skill asks the autostart question first, alone, and runs `--plan` again with the answer before it shows the plan.
- For the Product session: the product-inbox entry on autostart from the chat (`docs/product-inbox.md`) is closed by this ticket.

### Review

Against `main`, in a sub-agent, on the standards and the spec. Typecheck and the full suite pass (853 tests); criteria 1 to 3 are pinned through the `binn` process with a stand-in `systemctl`, criterion 4 in review and by the skill's wording in `pack.test.ts`.

1. **The skill's autostart wording was not pinned**, as its `--window` wording is. **Fixed**: `apps/cli/test/pack.test.ts` holds the question, the flag and the answer passed to `--apply`.
2. **The guide's step 1 did not say the autostart answer can be changed** at the plan question, as the skill's step 3 allows. **Fixed** in `docs/operations/01-new-project.md` and its twin.
3. ADR-0043 says that without a terminal init installs nothing; `--apply --autostart yes` now does. **Kept**: the chat's yes is the confirmation ADR-0037 gives, the spec decided it, and the ADR's rule still holds for every form without an answer.
