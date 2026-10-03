# 09: /binnacle:help

Status: DONE
Triage: ready-for-agent
Blocked by: None
Spec: `docs/specs/everything-from-the-chat/spec.md`

**What to build:** `/binnacle:help`, a plain-language guide to working with Binnacle, in the language the user writes in (stories 51 to 53). The skill's text is the guide: what Binnacle is in two sentences, each skill of the plugin with one plain line on when to use it, grouped as setting up, a day's work and planning, and the usual order of a day (`/binnacle:product`, the work, `/binnacle:checkpoint`). It calls no tool, runs no command and needs no daemon. See the spec's *Implementation Decisions*, the `/binnacle:help` entry.

- [x] The skill exists in the `binnacle` plugin with `disable-model-invocation: true`, and says to answer in the language the user writes in.
- [x] A test in `apps/cli/test/pack.test.ts` checks that it names every skill directory of the plugin, so a skill added later fails the test until the guide names it.
- [x] It calls no tool and runs no command.
- [x] The plugin's description, the marketplace listing and `docs/03-mcp-and-skills.md` name `/binnacle:help`.

## Comments

Hand check, optional: after refreshing the plugin as the README says, start a new session, write `/binnacle:help` and then a question in Russian, such as `Как начать работу?`. The answer is the guide in Russian, with the skill names as they are, every skill of the plugin in it, and no tool call or shell command in the transcript.

### Review

Code review against `main`, both axes.

Standards:
- Fixed: `/binnacle:help` sat in the Planning group; the guide now names it on its own line after the order of a day.
- Fixed: the order of a day suggested closing a ticket session with `/binnacle:checkpoint`; the guide now says checkpoint closes the `/binnacle:product` session, as the checkpoint skill does.
- Fixed: the dashboard's line now says it needs the running service.
- Kept: `/grill-with-docs` → `/to-spec` → `/to-tickets`, the names the spec and `CLAUDE.md` use, though an installed Matt Pocock plugin may namespace them.
- Kept: the test's check that the skill has no `argument-hint`; the spec says the skill takes no argument.
- Left: adding a skill means editing the plugin's description, the marketplace listing, `docs/03-mcp-and-skills.md` and the guide; that is the pattern this ticket asks for, and the test now enforces the guide.

Spec:
- Fixed: the test checked only that the guide names every skill directory; it now checks that the guide names exactly those, so a removed or renamed skill fails it too (story 53).
- Kept: the guide's "each ticket in a session of its own, on its own branch" and its "translate the guide, keep the skill names" are within the spec's plain guide and the user's language.
- Kept: `/binnacle:status` under setting up; the spec leaves the grouping of each skill open.
